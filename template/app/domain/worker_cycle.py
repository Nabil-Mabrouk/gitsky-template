"""Cycle métier du worker — VOTRE code (app/domain/, Chap X, module worker).

Fichier plain (pas `.jinja`, contrairement à `models.py`/`routers.py` : rien
de spécifique au projet à interpoler ici) — jamais retouché par le châssis
après le scaffold initial, même mécanisme que
`frontend/src/components/layout/Navbar.tsx` (Chap 24). Le châssis
(`app/modules/worker/runner.py`) fournit le conteneur, l'arrêt propre et la
cadence ; appelle ceci à intervalle régulier.

`stop_requested` est mis par SIGTERM (tout redéploiement redémarre ce
service, pas seulement ceux qui le touchent) : un cycle long doit le
vérifier entre ses propres étapes pour rendre la main proprement plutôt que
de compter uniquement sur `stop_grace_period` (docker-compose.yml).
"""

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession


async def run_cycle(db: AsyncSession, stop_requested: asyncio.Event) -> None:
    # TODO: implémentez votre cycle ici (allocation -> décisions -> bulletin,
    # ou tout autre traitement périodique). Gardez-le idempotent/résumable :
    # un déploiement redémarre ce service à CHAQUE push (docker compose up -d
    # --build reconstruit tous les services, pas seulement ceux modifiés),
    # donc un cycle peut être interrompu en plein milieu à tout moment.
    pass
