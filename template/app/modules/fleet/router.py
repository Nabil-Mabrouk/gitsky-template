"""Routeur du module fleet (Chap 19 / Chap 23).

- POST /projects/register : inscription d'un projet (appelé par le générateur).
  Un projet « n'existe » dans la flotte que s'il est enregistré ici.
- GET  /projects           : grille des projets (réservé à l'opérateur).
- POST /maintenance/report : reporting des jobs de maintenance (Chap 23,
  scripts shared_services/scripts/) — onglet Maintenance.
Monté sous /api/fleet par le core (module_fleet, app dashboard uniquement).
"""

import logging
import os
import secrets
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timezone

from app.core import mailer
from app.core.auth.dependencies import require_admin
from app.core.config import MODULE_FLAGS, get_settings
from app.core.database import get_db
from app.core.models import User
from app.modules.fleet import (
    generator_client,
    git_client,
    github_client,
    github_integration,
    health_monitor,
    landing_collector_client,
    publish,
)
from app.modules.fleet.models import FleetLifecycleEvent, MaintenanceRun, Project
from app.modules.fleet.schemas import (
    ActivityEntry,
    CreateProjectRequest,
    CreateProjectResult,
    GithubCreateRepoRequest,
    GithubLinkRepoRequest,
    GithubRepoResult,
    HealthSweepRequest,
    HealthSweepResult,
    LeadRead,
    MaintenanceReport,
    MaintenanceRunRead,
    ProjectRegister,
    ProjectRead,
    PromoteRequest,
    PromoteResult,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def verify_fleet_service_token(
    x_fleet_token: str | None = Header(default=None),
) -> None:
    """Garde machine-à-machine partagée par register et health-sweep.

    Ni le générateur (register) ni le poller cron `fleet-health.sh`
    (health-sweep) n'ont de compte/JWT — ce sont des scripts non-interactifs,
    pas des sessions opérateur. Un secret machine-à-machine suffit pour les
    deux. Sémantique alignée sur les stubs du châssis : ouvert en dev sans
    token, fail-closed en prod.
    """
    settings = get_settings()
    expected = settings.fleet_register_token
    if not expected:
        if settings.environment == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="FLEET_REGISTER_TOKEN non configuré",
            )
        return  # dev : ouvert, comme les autres stubs
    if x_fleet_token is None or not secrets.compare_digest(x_fleet_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token fleet invalide"
        )


@router.post(
    "/projects/register",
    response_model=ProjectRead,
    dependencies=[Depends(verify_fleet_service_token)],
)
async def register_project(
    payload: ProjectRegister, db: AsyncSession = Depends(get_db)
) -> Project:
    existing = (
        await db.execute(select(Project).where(Project.name == payload.name))
    ).scalar_one_or_none()
    if existing is None:
        project = Project(
            name=payload.name,
            domain=payload.domain,
            template_version=payload.template_version,
        )
        db.add(project)
        db.add(
            FleetLifecycleEvent(project_name=payload.name, event_type="born")
        )
    else:
        existing.domain = payload.domain
        existing.template_version = payload.template_version
        project = existing
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/module-catalog", response_model=list[str])
async def module_catalog(_admin: User = Depends(require_admin)) -> list[str]:
    """Catalogue plat de modules (Chap 2), clés courtes sans `module_` — ce
    que le wizard de création (Chap 27) affiche en cases à cocher. `auth` et
    le SEO n'y figurent pas : ils sont core, jamais un choix (Chap 2 §1).
    """
    return [flag.removeprefix("module_") for flag in MODULE_FLAGS]


@router.post(
    "/projects",
    response_model=CreateProjectResult,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    payload: CreateProjectRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CreateProjectResult:
    """Wizard de création (Chap 27, Phase E) : nom + modules + GitHub +
    domaine -> projet généré, enregistré, et (si GitHub demandé) dépôt créé
    ou lié avec un premier push.

    Ordre délibéré : la génération sur disque est la seule étape qui n'a AUCUN
    filet — pas de projet généré, pas de projet enregistré (409/503 francs,
    pas d'entrée fantôme dans la flotte). Tout ce qui suit (GitHub, push) est
    en best-effort journalisé : un projet fonctionnel sans dépôt lié reste un
    résultat utile, jamais une raison de tout annuler.
    """
    if not generator_client.is_valid_project_name(payload.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nom de projet invalide (slug DNS : minuscules, chiffres, tirets)",
        )
    if payload.github_mode == "link" and not payload.github_repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="github_repo requis quand github_mode=link",
        )

    existing = (
        await db.execute(select(Project).where(Project.name == payload.name))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Projet déjà enregistré"
        )

    config = generator_client.build_config(
        payload.name, payload.modules, payload.domain, payload.workers
    )
    projects_dir = Path(os.environ.get("PROJECTS_DIR", "/opt/gitsky/projects"))
    try:
        project_dir = generator_client.generate_project(payload.name, config, projects_dir)
    except generator_client.GeneratorNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    domain = payload.domain or f"{payload.name}{publish.FLEET_SUBDOMAIN_SUFFIX}"
    project = Project(name=payload.name, domain=domain, template_version="")
    db.add(project)
    db.add(FleetLifecycleEvent(project_name=payload.name, event_type="born"))
    await db.commit()
    await db.refresh(project)

    settings = get_settings()
    warnings: list[str] = []
    github_repo: str | None = None
    webhook_installed = False
    clone_url: str | None = None

    if payload.github_mode == "create":
        try:
            repo = await github_client.create_repo(payload.name, private=payload.github_private)
            github_repo = repo["full_name"]
            clone_url = repo["clone_url"]
        except httpx.HTTPError:
            logger.exception("Échec de création du dépôt GitHub pour %s", payload.name)
            warnings.append(
                "Génération et enregistrement OK, mais la création du dépôt GitHub a "
                "échoué — réessayez depuis l'onglet Actions (create-repo/link-repo)."
            )
    elif payload.github_mode == "link":
        github_repo = payload.github_repo
        clone_url = f"https://github.com/{payload.github_repo}.git"

    if github_repo:
        webhook_installed, message = await _install_webhook(settings, github_repo, payload.name)
        if message:
            warnings.append(message)
        project.github_repo = github_repo
        project.github_webhook_installed = webhook_installed
        db.add(
            FleetLifecycleEvent(
                project_name=payload.name,
                event_type="github_repo_created"
                if payload.github_mode == "create"
                else "github_repo_linked",
                reason=github_repo,
            )
        )

    pushed = False
    if clone_url:
        try:
            git_client.push_initial_commit(
                project_dir, clone_url, settings.fleet_github_deploy_branch
            )
            pushed = True
        except Exception:
            logger.exception("Échec du premier push pour %s", payload.name)
            warnings.append(
                "Dépôt lié, mais le premier push a échoué — poussez le code généré "
                f"({project_dir}) à la main vers {github_repo}."
            )

    # Bootstrap du tout premier déploiement : si le webhook GitHub n'a pas pu
    # être installé, rien d'autre ne journalisera jamais un deploy_triggered
    # pour ce projet — deploy-on-push.sh (Chap 26) ne le trouverait donc jamais
    # tant qu'un opérateur ne redéploie pas à la main. S'il EST installé, la
    # vraie livraison webhook GitHub s'en chargera d'elle-même : pas de double
    # déclenchement ici.
    deploy_triggered = False
    if pushed and not webhook_installed:
        db.add(
            FleetLifecycleEvent(
                project_name=payload.name, event_type="deploy_triggered", reason="initial_push"
            )
        )
        deploy_triggered = True

    await db.commit()
    await db.refresh(project)

    return CreateProjectResult(
        project=project,
        generated=True,
        github_repo=github_repo,
        webhook_installed=webhook_installed,
        pushed=pushed,
        deploy_triggered=deploy_triggered,
        warnings=warnings,
    )


@router.get("/projects", response_model=list[ProjectRead])
async def list_projects(
    status: str | None = None,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[Project]:
    stmt = select(Project).order_by(Project.name)
    if status is not None:
        stmt = stmt.where(Project.status == status)
    result = await db.execute(stmt)
    projects = list(result.scalars().all())

    # `health` calculé en une seule requête pour toute la grille (Chap 28) —
    # pas de N+1, pas de colonne dupliquée : attribut transitoire posé sur
    # chaque instance avant sérialisation, lu par ProjectRead.health (défaut
    # "unknown" si jamais posé, cf. schemas.py).
    statuses = await health_monitor.bulk_health_status(db, [p.name for p in projects])
    for project in projects:
        project.health = statuses.get(project.name, "unknown")

    return projects


@router.get("/projects/{name}/leads", response_model=list[LeadRead])
async def project_leads(name: str, _admin: User = Depends(require_admin)) -> list[dict]:
    # Lecture seule via le landing collector (Chap 19, onglet Leads) — pas de
    # vérification que `name` correspond à un projet enregistré, même
    # exposition qu'un /stats déjà pensé public-au-fleet.
    return await landing_collector_client.fetch_leads(name)


@router.post(
    "/maintenance/report",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_fleet_service_token)],
)
async def report_maintenance(
    payload: MaintenanceReport, db: AsyncSession = Depends(get_db)
) -> None:
    """Reporting des jobs de maintenance (Chap 23, onglet Maintenance).

    Même garde M2M que /register et /health-sweep : ce sont des scripts
    shared_services/scripts/ non-interactifs, pas des sessions opérateur.
    """
    db.add(
        MaintenanceRun(
            job=payload.job,
            status=payload.status,
            summary=payload.summary,
            project=payload.project,
        )
    )
    await db.commit()

    # L'alerte est un enrichissement, jamais un bloqueur — même raisonnement
    # que le double opt-in des leads (Chap 18) : la ligne est déjà persistée
    # au moment où on tente l'email, un échec d'envoi ne doit rien remettre
    # en cause. Destinataire = SMTP_FROM : l'opérateur s'auto-alerte, pas de
    # réglage dédié pour un opérateur seul.
    if payload.status == "failure":
        recipient = os.environ.get("SMTP_FROM", "")
        if recipient:
            try:
                mailer.send_email(
                    to=recipient,
                    subject=f"[GitSky] Échec maintenance : {payload.job}",
                    body=payload.summary or "(aucun détail fourni)",
                )
            except Exception:
                logger.exception("Échec d'envoi de l'alerte maintenance pour %s", payload.job)


@router.get("/maintenance/runs", response_model=list[MaintenanceRunRead])
async def list_maintenance_runs(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[MaintenanceRun]:
    result = await db.execute(
        select(MaintenanceRun)
        .order_by(MaintenanceRun.created_at.desc(), MaintenanceRun.id.desc())
        .limit(50)
    )
    return list(result.scalars().all())


@router.get("/activity", response_model=list[ActivityEntry])
async def activity(
    limit: int = 50,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityEntry]:
    """Flux d'activité consolidé (Chap 28) : fusion en lecture seule de
    `fleet_lifecycle_events` (cycle de vie, GitHub, déploiements) et
    `fleet_maintenance_runs` (backups, tests de restauration, disque) — les
    deux seuls journaux transversaux que possède réellement le fleet
    dashboard (Chap 19 §« pas de duplication »). Pas de `security_events` ici
    : ces tables vivent dans la base isolée de CHAQUE projet (Chap 18 §2),
    une requête cross-DB depuis le dashboard n'est pas construite — Chap 19 la
    mentionnait comme source de métrique, ce chapitre ne prétend pas
    l'avoir résolue.
    """
    limit = max(1, min(limit, 200))

    lifecycle = (
        await db.execute(
            select(FleetLifecycleEvent)
            .order_by(FleetLifecycleEvent.created_at.desc(), FleetLifecycleEvent.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    maintenance = (
        await db.execute(
            select(MaintenanceRun)
            .order_by(MaintenanceRun.created_at.desc(), MaintenanceRun.id.desc())
            .limit(limit)
        )
    ).scalars().all()

    entries = [
        ActivityEntry(
            kind="lifecycle",
            id=e.id,
            project=e.project_name,
            label=e.event_type,
            detail=e.reason,
            status=None,
            created_at=e.created_at,
        )
        for e in lifecycle
    ] + [
        ActivityEntry(
            kind="maintenance",
            id=m.id,
            project=m.project,
            label=m.job,
            detail=m.summary,
            status=m.status,
            created_at=m.created_at,
        )
        for m in maintenance
    ]
    entries.sort(key=lambda e: (e.created_at is not None, e.created_at), reverse=True)
    return entries[:limit]


@router.post(
    "/projects/health-sweep",
    response_model=HealthSweepResult,
    dependencies=[Depends(verify_fleet_service_token)],
)
async def health_sweep(
    payload: HealthSweepRequest,
    db: AsyncSession = Depends(get_db),
) -> HealthSweepResult:
    # Le poller (cron 60 s, fleet-health.sh) poste les derniers succès /health
    # de la flotte ; c'est un script non-interactif (même garde que register),
    # pas une session opérateur — le dashboard journalise les transitions
    # deployment_failed/recovered.
    now = payload.now or datetime.now(timezone.utc)
    changed = await health_monitor.record_health_sweep(db, payload.last_success, now)
    return HealthSweepResult(**changed)


@router.post("/projects/{name}/promote", response_model=PromoteResult)
async def promote(
    name: str,
    payload: PromoteRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PromoteResult:
    project = (
        await db.execute(select(Project).where(Project.name == name))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable"
        )

    decision = publish.evaluate_promotion(
        project.publish_status,
        project.domain or "",
        payload.guardrails_pass,
        payload.human_approved,
    )
    if decision["allowed"]:
        project.publish_status = decision["target"]
        db.add(
            FleetLifecycleEvent(
                project_name=project.name,
                event_type=f"publish_{decision['target']}",
                reason=decision["reason"],
            )
        )
    await db.commit()
    return PromoteResult(
        project=project.name,
        publish_status=project.publish_status,
        allowed=decision["allowed"],
        reason=decision["reason"],
    )


@router.post("/projects/{name}/archive", response_model=ProjectRead)
async def archive_project(
    name: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Archivage manuel (Chap 20) — remplace l'ancien kill automatique.

    Plus de scoring de signal, plus de shutdown déclenché par un cron : un
    projet s'archive uniquement quand un opérateur le décide depuis le
    dashboard. Idempotent (réarchiver un projet déjà archivé ne journalise
    pas un second événement) — ni conteneurs ni domaine ne sont libérés ici,
    c'est un marqueur d'état ; l'arrêt effectif (docker compose down, retrait
    Traefik) reste une action d'infra séparée, pas encore automatisée.
    """
    project = (
        await db.execute(select(Project).where(Project.name == name))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable"
        )

    if project.status != "archived":
        project.status = "archived"
        db.add(FleetLifecycleEvent(project_name=project.name, event_type="archived"))
        await db.commit()
        await db.refresh(project)
    return project


def _webhook_url(settings, name: str) -> str:
    return f"{settings.site_url.rstrip('/')}/api/fleet/webhooks/github/{name}"


async def _install_webhook(settings, repo_full_name: str, name: str) -> tuple[bool, str]:
    """Tente d'installer le webhook push ; jamais levé — un échec HTTP
    (403/404, typiquement un jeton sans droits admin sur ce dépôt) est
    absorbé ici et traduit en message pour l'opérateur (Chap 26 §repli) : le
    dépôt reste lié même si le webhook échoue, le redeploy restant alors
    manuel jusqu'à ce qu'il soit ajouté (à la main ou en relançant le lien).
    """
    try:
        await github_client.create_webhook(
            repo_full_name, _webhook_url(settings, name), settings.fleet_github_webhook_secret
        )
        return True, ""
    except httpx.HTTPError:
        logger.exception("Échec d'installation du webhook GitHub pour %s", repo_full_name)
        return False, (
            "Dépôt lié, mais l'installation du webhook a échoué (droits admin "
            "manquants sur ce dépôt ?) — le redeploy automatique reste "
            "indisponible tant que le webhook n'est pas ajouté."
        )


@router.post("/projects/{name}/github/create-repo", response_model=GithubRepoResult)
async def github_create_repo(
    name: str,
    payload: GithubCreateRepoRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> GithubRepoResult:
    """Crée un dépôt GitHub pour `name` et y installe le webhook push (Chap 26,
    Phase D). Le push initial du code généré et le clonage sur le VPS restent
    des étapes d'infra séparées (même statut SIMULÉ que les autres tasks du
    générateur) — cet endpoint ne fait que la partie GitHub API : créer le
    dépôt, l'enregistrer sur le projet, tenter le webhook.
    """
    project = (
        await db.execute(select(Project).where(Project.name == name))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable"
        )

    settings = get_settings()
    repo = await github_client.create_repo(name, private=payload.private)
    webhook_installed, message = await _install_webhook(settings, repo["full_name"], name)

    project.github_repo = repo["full_name"]
    project.github_webhook_installed = webhook_installed
    db.add(
        FleetLifecycleEvent(
            project_name=name, event_type="github_repo_created", reason=repo["full_name"]
        )
    )
    await db.commit()
    await db.refresh(project)

    return GithubRepoResult(
        project=name,
        repo=repo["full_name"],
        html_url=repo["html_url"],
        webhook_installed=webhook_installed,
        message=message,
    )


@router.post("/projects/{name}/github/link-repo", response_model=GithubRepoResult)
async def github_link_repo(
    name: str,
    payload: GithubLinkRepoRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> GithubRepoResult:
    """Repli manuel (Chap 26 §lien manuel) : lie un dépôt GitHub EXISTANT à un
    projet sans passer par la création via l'API — utile quand le code vit
    déjà dans un dépôt (import, dépôt créé à la main). Tente quand même
    d'installer le webhook ; si ça échoue (le jeton n'a pas les droits admin
    sur ce dépôt tiers), le dépôt reste lié et le message l'explique — le
    redeploy reste alors disponible en manuel (Chap 20/23).
    """
    project = (
        await db.execute(select(Project).where(Project.name == name))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable"
        )

    settings = get_settings()
    webhook_installed, message = await _install_webhook(settings, payload.repo, name)

    project.github_repo = payload.repo
    project.github_webhook_installed = webhook_installed
    db.add(
        FleetLifecycleEvent(
            project_name=name, event_type="github_repo_linked", reason=payload.repo
        )
    )
    await db.commit()
    await db.refresh(project)

    return GithubRepoResult(
        project=name,
        repo=payload.repo,
        html_url=f"https://github.com/{payload.repo}",
        webhook_installed=webhook_installed,
        message=message,
    )


@router.post(
    "/webhooks/github/{name}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def github_webhook(
    name: str,
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Réception des livraisons webhook GitHub (Chap 26, Phase D).

    Signature HMAC vérifiée en premier (même garde fail-open-dev/fail-closed-
    prod que /register). Seul un push sur la branche de déploiement (Chap 26
    §branche) journalise un `deploy_triggered` — un push sur une branche
    feature/WIP est reçu et vérifié, mais n'est délibérément pas traité comme
    un signal de déploiement. Le déclenchement réel du pipeline de redeploy
    (git pull + copier update + docker compose up -d --build sur le VPS)
    reste un stub SIMULÉ pour l'instant — même statut que les autres tasks du
    générateur (provision_db.py, apply_migrations.py) : la connexion à
    l'infra réelle est un chantier à part. Ici, on journalise l'événement
    pour que le dashboard puisse déjà l'afficher (onglet Activité).
    """
    settings = get_settings()
    secret = settings.fleet_github_webhook_secret
    body = await request.body()
    if not secret:
        if settings.environment == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="FLEET_GITHUB_WEBHOOK_SECRET non configuré",
            )
        # dev : ouvert, comme les autres stubs — pas de vérification possible
        # sans secret configuré.
    elif not github_integration.verify_webhook_signature(
        body, x_hub_signature_256, secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature webhook invalide",
        )

    if not github_integration.is_deploy_push(
        x_github_event, body, settings.fleet_github_deploy_branch
    ):
        # ping / autre événement GitHub, ou push sur une branche autre que la
        # branche de déploiement : accusé réception silencieux, pas de
        # déploiement.
        return

    db.add(
        FleetLifecycleEvent(
            project_name=name,
            event_type="deploy_triggered",
            reason="github_push",
        )
    )
    await db.commit()


@router.get(
    "/deploys/pending",
    response_class=PlainTextResponse,
    dependencies=[Depends(verify_fleet_service_token)],
)
async def pending_deploys(
    since_id: int = 0,
    db: AsyncSession = Depends(get_db),
) -> str:
    """Déploiements en attente pour deploy-on-push.sh (Chap 26 §Pipeline).

    Le webhook ne fait que journaliser `deploy_triggered` (verify_webhook_signature
    + is_deploy_push) ; c'est CE endpoint que le poller shared_services interroge
    pour savoir quoi redéployer réellement, avec un accès Docker que le
    conteneur dashboard n'a lui-même jamais (Chap 26 §choix d'architecture).

    Texte brut plutôt que JSON : le seul consommateur est un script shell sans
    dépendance jq (cohérent avec le reste de shared_services/scripts/, qui
    construit du JSON en chaîne mais n'en parse jamais). Une ligne par
    événement, `<id>\\t<project_name>`, id croissant — le script tient son
    propre curseur local (`since_id`) pour ne jamais retraiter un événement.
    """
    result = await db.execute(
        select(FleetLifecycleEvent)
        .where(
            FleetLifecycleEvent.event_type == "deploy_triggered",
            FleetLifecycleEvent.id > since_id,
        )
        .order_by(FleetLifecycleEvent.id)
        .limit(200)
    )
    events = result.scalars().all()
    return "\n".join(f"{e.id}\t{e.project_name}" for e in events)
