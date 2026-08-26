"""Client GitHub REST API (Chap 26 — Phase D) : création de dépôt et
installation de webhook.

Authentification par PAT (`FLEET_GITHUB_TOKEN`) plutôt qu'une GitHub App
complète (flow d'installation, clé privée JWT, jetons d'installation à
renouveler) : un choix pragmatique pour cette itération — scope plus large
qu'une App (un jeton à l'échelle du compte/org à révoquer manuellement,
plutôt qu'une installation révocable par dépôt), mais suffisant pour créer un
dépôt et un webhook sans la complexité d'un flow d'installation OAuth. Migrer
vers une GitHub App reste une amélioration future documentée (Chap 26), pas un
prérequis de cette phase.

Même contrat fail-closed que stripe_client.py/landing_collector_client.py :
FLEET_GITHUB_TOKEN absent -> stub dev déterministe, aucun appel réseau ;
absent ET ENVIRONMENT=production -> RuntimeError. Lecture directe de
os.environ (pas app.core.config.get_settings, mis en cache via @lru_cache) :
comme les autres clients externes, ce module doit réagir à un changement
d'environnement au moment de l'appel, pas au premier import du process —
condition testée par test_failclosed_contract.py via monkeypatch.setenv.
"""

import os

import httpx

_API_BASE_DEFAULT = "https://api.github.com"


def _forbid_stub_in_production(missing: str) -> None:
    """Fail-closed : en production, un jeton manquant est une erreur, jamais
    une bascule silencieuse sur le stub (dépôt/webhook fictifs)."""
    if os.environ.get("ENVIRONMENT", "").lower() == "production":
        raise RuntimeError(
            f"{missing} manquant alors que ENVIRONMENT=production — "
            "refus du mode stub (fail-closed)"
        )


def _api_base() -> str:
    return os.environ.get("FLEET_GITHUB_API_BASE", _API_BASE_DEFAULT)


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def create_repo(name: str, private: bool = True) -> dict:
    """Crée un dépôt GitHub `name`, sous FLEET_GITHUB_ORG si configuré, sinon
    sous le compte propriétaire du jeton.

    Retourne `{"full_name", "html_url", "clone_url"}`. Sans FLEET_GITHUB_TOKEN :
    stub dev déterministe, aucun appel réseau.
    """
    token = os.environ.get("FLEET_GITHUB_TOKEN", "")
    if not token:
        _forbid_stub_in_production("FLEET_GITHUB_TOKEN")
        org = os.environ.get("FLEET_GITHUB_ORG", "") or "stub-owner"
        full_name = f"{org}/{name}"
        return {
            "full_name": full_name,
            "html_url": f"https://github.test/{full_name}",
            "clone_url": f"https://github.test/{full_name}.git",
        }

    org = os.environ.get("FLEET_GITHUB_ORG", "")
    url = f"{_api_base()}/orgs/{org}/repos" if org else f"{_api_base()}/user/repos"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers=_headers(token),
            json={"name": name, "private": private},
            timeout=10.0,
        )
        response.raise_for_status()
        payload = response.json()
        return {
            "full_name": payload["full_name"],
            "html_url": payload["html_url"],
            "clone_url": payload["clone_url"],
        }


async def create_webhook(repo_full_name: str, webhook_url: str, secret: str) -> dict:
    """Installe un webhook `push` sur `repo_full_name` (`owner/name`), vers
    `webhook_url`, signé avec `secret` (même secret que
    FLEET_GITHUB_WEBHOOK_SECRET, vérifié à la réception par
    github_integration.verify_webhook_signature).

    Sans FLEET_GITHUB_TOKEN : stub dev déterministe. Une erreur HTTP (403/404
    — le jeton n'a pas les droits admin sur ce dépôt, cas typique du lien
    manuel vers un dépôt existant) remonte telle quelle à l'appelant, qui
    décide du repli (Chap 26 : dépôt lié sans webhook, redeploy resté manuel).
    """
    token = os.environ.get("FLEET_GITHUB_TOKEN", "")
    if not token:
        _forbid_stub_in_production("FLEET_GITHUB_TOKEN")
        return {"id": 0, "url": webhook_url}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{_api_base()}/repos/{repo_full_name}/hooks",
            headers=_headers(token),
            json={
                "name": "web",
                "active": True,
                "events": ["push"],
                "config": {
                    "url": webhook_url,
                    "content_type": "json",
                    "secret": secret,
                    "insecure_ssl": "0",
                },
            },
            timeout=10.0,
        )
        response.raise_for_status()
        payload = response.json()
        return {"id": payload["id"], "url": webhook_url}
