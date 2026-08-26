"""Client du générateur Copier (Chap 27, Phase E) : matérialise un projet
depuis les réponses du wizard de création du fleet dashboard.

`GITSKY_GENERATOR_PATH` doit pointer vers le dossier du générateur — celui qui
contient `copier.yml` (`src/generator` dans ce monorepo ; un checkout du dépôt
`gitsky-template` en déploiement réel, Chap 17 : le générateur est un
sous-module git séparé, pas embarqué dans chaque projet généré). L'image du
fleet dashboard doit l'embarquer (ou le monter) pour que la création de
projet fonctionne — une dépendance d'infra explicite, pas une hypothèse
silencieuse.

Contrairement aux autres clients externes de ce module (github_client.py,
stripe_client.py...), il n'y a PAS de stub dev déterministe ici : « générer un
faux projet sur disque » n'est pas une simulation utile, contrairement à
« renvoyer un faux id de webhook ». Un chemin absent ou invalide lève TOUJOURS
(dev comme prod) — c'est une dépendance d'infra manquante, pas un secret
oublié qu'on peut se permettre de contourner en développement.
"""

import os
import re
from pathlib import Path

from app.core.config import MODULE_FLAGS

# Slug DNS-safe : devient un nom de répertoire, un identifiant PostgreSQL
# (après substitution des tirets), un sous-domaine (Chap 1) et potentiellement
# un nom de dépôt GitHub (Chap 26) — un seul format contraignant en amont évite
# une erreur de rendu Jinja ou un rejet de l'API GitHub en aval, plus difficile
# à diagnostiquer pour l'opérateur.
_NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")


class GeneratorNotConfigured(RuntimeError):
    """GITSKY_GENERATOR_PATH absent ou introuvable — pas de stub possible."""


def is_valid_project_name(name: str) -> bool:
    return bool(_NAME_RE.match(name))


def build_config(
    name: str, modules: dict[str, bool] | None, domain: str = "", workers: int = 0
) -> dict:
    """Assemble le payload `data=` de copier.run_copy (Chap 17 §config.yaml)
    depuis les champs du wizard.

    `modules` attend des clés courtes (sans `module_`), comme `config.yaml` —
    ex. `{"admin": True}`. Toute clé hors du catalogue canonique (MODULE_FLAGS)
    est ignorée plutôt que de lever : le formulaire du wizard ne propose que
    des cases du catalogue, mais un appel API direct avec un flag inconnu ne
    doit pas faire échouer la génération pour autant.
    """
    project: dict = {"name": name}
    if domain:
        project["domain"] = domain
    if workers:
        project["workers"] = workers

    catalog = {flag.removeprefix("module_") for flag in MODULE_FLAGS}
    resolved_modules = {k: bool(v) for k, v in (modules or {}).items() if k in catalog}

    return {"project": project, "modules": resolved_modules}


def _template_path() -> Path:
    raw = os.environ.get("GITSKY_GENERATOR_PATH", "")
    if not raw:
        raise GeneratorNotConfigured(
            "GITSKY_GENERATOR_PATH non configuré — impossible de générer un projet"
        )
    path = Path(raw)
    if not (path / "copier.yml").exists():
        raise GeneratorNotConfigured(
            f"GITSKY_GENERATOR_PATH={raw} ne contient pas de copier.yml"
        )
    return path


def generate_project(name: str, config: dict, dest_root: Path) -> Path:
    """Matérialise le projet dans `dest_root/name` via Copier — génère les
    fichiers ET exécute les `_tasks` réelles (`git init`/`add`/`commit`,
    Chap 17) : contrairement aux tests du générateur (`skip_tasks=True`, pour
    rester rapides et déterministes), cette fonction produit un vrai dépôt git
    local avec un premier commit, prêt à être poussé (Chap 26 §premier push).
    """
    template = _template_path()
    dest = dest_root / name

    import copier  # import paresseux : dépend du paquet `copier` en prod,
    # comme `import stripe` dans stripe_client.py — absent des projets qui
    # n'activent pas module_fleet, une image de fleet dashboard doit l'ajouter
    # (Chap 27 §infra), pas un crash au démarrage de tout projet non-fleet.

    copier.run_copy(
        str(template),
        str(dest),
        data=config,
        defaults=True,
        quiet=True,
        unsafe=True,
    )
    return dest
