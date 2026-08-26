"""Schémas Pydantic du module fleet (Chap 5)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ProjectRegister(BaseModel):
    name: str
    domain: str = ""
    template_version: str = ""


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    domain: str | None
    status: str
    publish_status: str
    template_version: str | None
    github_repo: str | None
    github_webhook_installed: bool
    # Calculé, jamais stocké (health_monitor.bulk_health_status, Chap 28) —
    # défaut "unknown" : seul GET /projects (la grille) l'attache réellement
    # sur chaque instance avant sérialisation ; les autres endpoints qui
    # renvoient un ProjectRead (register/archive/promote/github/create...)
    # n'ont pas cette info à jour et ne doivent pas prétendre le contraire.
    health: str = "unknown"


class PromoteRequest(BaseModel):
    guardrails_pass: bool = True
    human_approved: bool = False


class PromoteResult(BaseModel):
    project: str
    publish_status: str
    allowed: bool
    reason: str


class GithubCreateRepoRequest(BaseModel):
    private: bool = True


class GithubLinkRepoRequest(BaseModel):
    repo: str  # "owner/name" — dépôt existant à lier (Chap 26 §lien manuel).


class GithubRepoResult(BaseModel):
    project: str
    repo: str
    html_url: str
    webhook_installed: bool
    message: str = ""


class CreateProjectRequest(BaseModel):
    name: str
    # Clés courtes (sans `module_`), ex. {"admin": True} — miroir du bloc
    # `modules` de config.yaml (Chap 17). Toute clé hors catalogue est ignorée
    # par generator_client.build_config, pas rejetée ici.
    modules: dict[str, bool] = {}
    domain: str = ""
    workers: int = 0
    github_mode: Literal["create", "link", "skip"] = "skip"
    github_repo: str = ""  # requis si github_mode == "link"
    github_private: bool = True


class CreateProjectResult(BaseModel):
    project: ProjectRead
    generated: bool
    github_repo: str | None = None
    webhook_installed: bool = False
    pushed: bool = False
    deploy_triggered: bool = False
    warnings: list[str] = []


class HealthSweepRequest(BaseModel):
    # Dernier succès /health par projet (le poller le tient à jour). null =
    # aucun succès connu. `now` optionnel : sinon l'heure serveur fait foi.
    last_success: dict[str, datetime | None]
    now: datetime | None = None


class HealthSweepResult(BaseModel):
    failed: list[str]
    recovered: list[str]


class LeadRead(BaseModel):
    # Miroir local de landing_collector.schemas.LeadOut (pas d'import
    # cross-service — frontière déjà respectée partout ailleurs dans ce code).
    id: int
    project: str
    email: str
    source: str | None
    utm_campaign: str | None
    created_at: datetime | None
    verified: bool


class MaintenanceReport(BaseModel):
    job: str
    status: Literal["success", "failure"]
    summary: str = ""
    project: str | None = None


class MaintenanceRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job: str
    status: str
    summary: str | None
    project: str | None
    created_at: datetime | None


class ActivityEntry(BaseModel):
    # Fusion en lecture seule de fleet_lifecycle_events et
    # fleet_maintenance_runs (Chap 28) — pas une nouvelle table, juste un
    # tri commun des deux journaux déjà existants (Chap 19 §« pas de
    # duplication »). `kind` + `id` (id dans SA table d'origine, pas unique
    # entre les deux) forment une clé d'affichage stable côté frontend.
    kind: Literal["lifecycle", "maintenance"]
    id: int
    project: str | None
    label: str  # event_type (lifecycle) ou job (maintenance)
    detail: str | None  # reason (lifecycle) ou summary (maintenance)
    status: str | None = None  # maintenance seulement (success/failure)
    created_at: datetime | None
