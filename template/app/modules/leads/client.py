"""Client HTTP vers le landing collector partagé — vue projet-locale du même
service que app/modules/fleet/landing_collector_client.py.

Duplication délibérée (pas un import cross-module — frontière déjà
respectée partout ailleurs, voir schemas.LeadRead) : la SEULE différence
réelle avec le client fleet est le jeton envoyé. Fleet envoie
COLLECTOR_STATS_TOKEN (jeton maître, accès fleet-wide à landing_collector) ;
ce module envoie LEADS_COLLECTOR_TOKEN, un jeton DÉRIVÉ — HMAC-SHA256 de
COLLECTOR_STATS_TOKEN par le nom de CE SEUL projet — jamais le jeton maître
lui-même, qui donnerait à un projet ordinaire accès aux leads de toute la
flotte s'il venait à le détenir. Voir landing_collector.main._derived_token
pour la formule exacte et scripts/provision_leads_token.sh pour comment ce
jeton arrive dans .env.local.

Même contrat fail-closed que landing_collector_client.py/mailer.py/llm_client.py
(os.environ direct, jamais get_settings() qui est @lru_cache).
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
            headers={"X-Collector-Token": os.environ.get("LEADS_COLLECTOR_TOKEN", "")},
            timeout=5.0,
        )
        response.raise_for_status()
        return response.json()
