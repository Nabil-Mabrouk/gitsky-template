"""Configuration centralisée (Phase 1).

Catalogue de modules à plat (Chap 2) : chaque flag `MODULE_*` est un booléen
indépendant, activé explicitement par variable d'environnement (Chap 3
§Config). Pas de profil ni de palier — un flag absent de l'env vaut False.

Note core : l'authentification et le SEO dynamique sont présents dans tout
projet (Chap 2 §1) — ils font partie du core, ce ne sont donc pas des flags
`MODULE_*`.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Liste canonique des modules optionnels (Chap 3 §config.py). `module_auth`
# n'y figure plus : l'authentification est core, toujours active (Chap 2 §1),
# au même titre que le SEO.
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
    "module_worker",
)


class Settings(BaseSettings):
    # .env.local est chargé en second : ses valeurs priment sur .env pour une
    # même clé (ordre du tuple, comportement pydantic-settings natif). Il
    # contient les credentials opérateur qui n'ont aucune valeur dérivable à
    # la génération (jetons GitHub, SMTP, chemins de la flotte) et qui, à
    # l'inverse de .env, ne sont JAMAIS un fichier .jinja du template — donc
    # structurellement jamais touché par `copier update`, quel que soit le
    # mécanisme de fusion de copier (root cause d'une perte de valeurs
    # manuelles observée une fois sur .env, jamais élucidée — voir chap_23).
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"), extra="ignore"
    )

    project_name: str = "gitsky-spike"
    # Placeholder DEV uniquement — ≥ 32 octets (RFC 7518 pour HS256).
    # La prod DOIT fournir une vraie clé secrète via l'environnement.
    secret_key: str = "dev-insecure-change-me-in-production-0123456789"
    frontend_url: str = "http://localhost:5173"
    environment: str = "development"

    # SEO (Chap 10, core dans tout projet). `site_url` est l'origine publique
    # canonique du projet (https://mon-projet.com) — sert de préfixe absolu aux
    # URLs du sitemap et à la ligne Sitemap: de robots.txt. En dev on retombe
    # sur frontend_url ; la prod fournit le vrai domaine via l'environnement.
    site_url: str = "http://localhost:5173"
    # Langues indexées, la première étant la langue par défaut (sans préfixe
    # d'URL). Le sitemap n'émet des alternates hreflang que si module_i18n est
    # actif ET qu'au moins deux langues sont déclarées (Chap 10 §i18n).
    supported_languages: list[str] = ["fr"]

    # SQLAlchemy async. Défaut SQLite local pour le dev ; la prod fournit une
    # URL PostgreSQL asyncpg (postgresql+asyncpg://...) via l'environnement.
    database_url: str = "sqlite+aiosqlite:///./gitsky.db"

    # Auth / JWT (Chap 7). Access court en localStorage, refresh long en cookie.
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Token partagé exigé par POST /api/fleet/projects/register (header
    # X-Fleet-Token). Vide en dev = endpoint ouvert (philosophie stub) ; en
    # production un token vide REFUSE tout register (fail-closed) — sans ça,
    # n'importe qui pouvait créer/écraser les projets de la flotte.
    fleet_register_token: str = ""

    # Secret partagé HMAC-SHA256 exigé par les livraisons webhook GitHub
    # (header X-Hub-Signature-256) sur POST /api/fleet/webhooks/github/{name}
    # (Chap 26). Même sémantique fail-open-dev/fail-closed-prod que
    # fleet_register_token — un webhook public serait un déclencheur de
    # déploiement arbitraire.
    fleet_github_webhook_secret: str = ""

    # Branche qui déclenche un redeploy (Chap 26). Un push sur toute autre
    # branche (feature/WIP) est reçu et vérifié mais N'EST PAS un déploiement
    # — seule la branche de prod fait foi, comme dans tout pipeline CD
    # standard. Un seul réglage pour toute la flotte : pas de colonne
    # par-projet pour l'instant (YAGNI tant qu'aucun projet n'en a besoin).
    fleet_github_deploy_branch: str = "main"

    # Suffixe attribué aux projets créés sans domaine explicite (wizard,
    # Chap 27) et utilisé par publish.evaluate_promotion (Chap 24) pour
    # décider si un domaine est un sous-domaine jetable de la flotte. Le
    # défaut ".mystudio.com" est celui du livre (Chap 1) — un exemple, jamais
    # un domaine réel : DÉPLOYER SANS LE SURCHARGER PRODUIT DES PROJETS SUR UN
    # DOMAINE QUI N'EXISTE PAS (aucun certificat ACME possible, bug de prod du
    # 27/08). Chaque déploiement DOIT le régler sur son propre domaine wildcard
    # (ex. ".0-hitl.com") dans .env.
    fleet_subdomain_suffix: str = ".mystudio.com"

    # Catalogue de modules à plat (Chap 2) : chaque flag est un booléen
    # indépendant, False par défaut — aucun profil ne le pré-remplit.
    module_admin: bool = False
    module_analytics: bool = False
    module_onboarding: bool = False
    module_tutorials: bool = False
    module_security_middleware: bool = False
    module_i18n: bool = False
    module_agentic: bool = False
    module_monetization_shop: bool = False
    module_monetization_subscription: bool = False
    # Module spécial : activé uniquement pour l'app fleet dashboard (mystudio.com).
    module_fleet: bool = False
    module_worker: bool = False

    # Intervalle entre deux cycles du service worker, en secondes
    # (module_worker uniquement). Défaut 1h — une valeur de configuration
    # arbitraire côté chassis, ajustable en .env sans rebuild.
    worker_interval_seconds: int = 3600

    @property
    def enabled_modules(self) -> list[str]:
        """Modules actifs, sans le préfixe `module_` — pratique pour logs/health.

        Inclut toujours `auth` : présent dans tout projet (Chap 2 §1), il ne
        porte pas de flag `MODULE_*` mais reste utile à afficher.
        """
        return ["auth"] + [
            flag.removeprefix("module_")
            for flag in MODULE_FLAGS
            if getattr(self, flag)
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
