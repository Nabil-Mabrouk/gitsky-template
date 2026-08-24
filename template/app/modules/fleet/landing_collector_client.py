"""Client HTTP vers le landing collector partagé (Chap 19, onglet Leads).

Même contrat fail-closed que llm_client.py/mailer.py : LANDING_COLLECTOR_URL
absent -> stub dev (liste vide, pas d'appel réseau) ; absent ET
ENVIRONMENT=production -> RuntimeError (refus d'échouer silencieusement).

Lecture directe de os.environ (pas de app.core.config.get_settings, qui est
mis en cache via @lru_cache) : comme llm_client.py/mailer.py, cette fonction
doit réagir à un changement d'environnement au moment de l'appel, pas au
premier import du process — condition testée par test_failclosed_contract.py
via monkeypatch.setenv.
"""

import os

import httpx


async def fetch_leads(project: str) -> list[dict]:
    base_url = os.environ.get("LANDING_COLLECTOR_URL", "")
    if not base_url:
        if os.environ.get("ENVIRONMENT", "").lower() == "production":
            raise RuntimeError(
                "LANDING_COLLECTOR_URL manquant alors que ENVIRONMENT=production — "
                "refus d'échouer silencieusement (fail-closed)"
            )
        return []

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/leads/{project}",
            headers={"X-Collector-Token": os.environ.get("COLLECTOR_STATS_TOKEN", "")},
            timeout=5.0,
        )
        response.raise_for_status()
        return response.json()
