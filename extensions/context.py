"""Context hook Copier — résout le catalogue de modules du projet.

Équivalent réel du « _pre_generation » du livre : au lieu d'un script Python
lancé avant génération (style Cookiecutter), Copier expose un *context hook* qui
enrichit le contexte Jinja avant le rendu des fichiers.

La liste des flags est VENDORISÉE (copie autonome de `app.core.config`) car le
template génère depuis un checkout git où `src/backend` n'est pas importable. La
synchro générateur↔runtime est garantie par un test (test_generator_modules_match_backend).
"""

import re

import yaml

from copier_template_extensions import ContextHook

MODULE_FLAGS: tuple[str, ...] = (
    "module_admin",
    "module_analytics",
    "module_onboarding",
    "module_tutorials",
    "module_security_middleware",
    "module_i18n",
    "module_agentic",
    "module_monetization_shop",
    "module_monetization_subscription",
    "module_fleet",
)

# Workers Gunicorn par défaut (Chap 21) — une simple valeur de configuration
# par projet, ajustable via `project.workers`, plus dérivée d'un palier.
DEFAULT_WORKERS = 2

# Types config.yaml -> expression de colonne SQLAlchemy.
_SA_TYPES: dict[str, str] = {
    "str": "String",
    "text": "Text",
    "int": "Integer",
    "bool": "Boolean",
    "float": "Float",
    "datetime": "DateTime(timezone=True)",
}


def _as_obj(value, default):
    """Normalise une réponse Copier en objet Python.

    Via `--data-file config.yaml`, Copier fournit déjà des listes/dicts. Via
    `--data key=...`, la valeur arrive comme chaîne : on la parse en YAML.
    """
    if value is None or value == "":
        return default
    if isinstance(value, str):
        return yaml.safe_load(value) or default
    return value


def _pluralize(name: str) -> str:
    """Nom de table à partir du nom de modèle (Company -> companies)."""
    lower = name.lower()
    if lower.endswith("y") and (len(lower) < 2 or lower[-2] not in "aeiou"):
        return lower[:-1] + "ies"
    if lower.endswith(("s", "x", "z", "ch", "sh")):
        return lower + "es"
    return lower + "s"


def _resolve_domain_routes(domain_routes: list) -> list:
    """Dérive un nom de routeur (identifiant Python) depuis le préfixe.

    Ex. { prefix: /api/pains } -> name "pains" -> `pains_router`.
    """
    resolved = []
    for route in domain_routes:
        prefix = route.get("prefix", "/")
        last = prefix.rstrip("/").split("/")[-1] or "root"
        name = re.sub(r"\W", "_", last) or "root"
        resolved.append(
            {"prefix": prefix, "name": name, "handlers": route.get("handlers", "")}
        )
    return resolved


def _resolve_domain_models(data_models: list) -> list:
    """Enrichit chaque modèle avec son nom de table et ses colonnes SQLAlchemy."""
    resolved = []
    for model in data_models:
        fields = [
            {"name": fname, "column": _SA_TYPES.get(ftype, "String")}
            for fname, ftype in (model.get("fields") or {}).items()
        ]
        resolved.append(
            {
                "name": model["name"],
                "table": _pluralize(model["name"]),
                "fields": fields,
            }
        )
    return resolved


class ModuleResolver(ContextHook):
    def hook(self, context: dict) -> None:
        # Dérive les valeurs plates depuis le bloc imbriqué `project` du livre.
        project = _as_obj(context.get("project"), {}) or {}
        project_name = project.get("name", "mon-projet")
        context["project_name"] = project_name
        context["project_domain"] = (
            project.get("domain") or f"{project_name}.mystudio.com"
        )
        context["gunicorn_workers"] = project.get("workers", DEFAULT_WORKERS)

        # db_name : identifiant PostgreSQL valide (pas de tiret).
        # secret_key / postgres_password : plus générés ici — ce sont de vraies
        # questions Copier (voir copier.yml) depuis que la génération à chaque
        # invocation (y compris `update`) cassait la base/session de chaque
        # projet à chaque propagation de fix du chassis.
        context["db_name"] = re.sub(r"\W", "_", project_name)

        # Catalogue de modules à plat (Chap 2) : chaque flag est un booléen
        # indépendant, activé explicitement par `modules` (clés courtes, sans
        # le préfixe module_) — absent = False, aucun profil ne le pré-remplit.
        overrides = _as_obj(context.get("modules"), {})
        resolved: dict[str, bool] = {
            flag: bool(overrides.get(flag.removeprefix("module_"), False))
            for flag in MODULE_FLAGS
        }
        context["resolved_modules"] = resolved

        # Scaffolding métier : app/domain/ depuis data_models et domain_routes.
        context["domain_models"] = _resolve_domain_models(
            _as_obj(context.get("data_models"), [])
        )
        context["domain_routers"] = _resolve_domain_routes(
            _as_obj(context.get("domain_routes"), [])
        )

        # Branding : garantit les 3 clés même si le branding fourni est partiel.
        branding = _as_obj(context.get("branding"), {})
        context["branding"] = {
            "primary_color": "#4F46E5",
            "primary_foreground": "#FFFFFF",
            "font_family": "Inter",
            "display_font_family": "Inter",
            **(branding or {}),
        }

        # Vitrine : garantit skin + liste de blocs (Chap 24).
        landing = _as_obj(context.get("landing"), {}) or {}
        context["landing"] = {
            "skin": landing.get("skin", "clean"),
            "blocks": landing.get("blocks", []),
            "hero_image": landing.get("hero_image", ""),
        }
