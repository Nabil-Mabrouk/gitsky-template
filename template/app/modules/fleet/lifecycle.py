"""État de cycle de vie opérateur d'un projet (Chap 20/23, round sécurisation).

Distinct de `health_monitor` (disponibilité mesurée, /health) : ici c'est
l'INTENTION la plus récente d'un opérateur (arrêt, démarrage, mise en
maintenance) — dérivée de `fleet_lifecycle_events`, jamais stockée
séparément (même principe que `bulk_health_status`, Chap 28).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.fleet.models import FleetLifecycleEvent

# event_type -> état affiché. `archived` journalise aussi `stop_requested`
# (router.archive_project) : un projet archivé apparaît donc "stopped" ici,
# sans registre séparé à maintenir en double.
STATE_EVENTS: dict[str, str] = {
    "stop_requested": "stopped",
    "start_requested": "normal",
    "maintenance_requested": "maintenance",
    "maintenance_cleared": "normal",
}

# event_type -> action consommée par lifecycle-fleet.sh (shared_services),
# même contrat texte brut que /deploys/pending (Chap 26) : `id\tproject\taction`.
PENDING_ACTIONS: dict[str, str] = {
    "stop_requested": "stop",
    "start_requested": "start",
    "maintenance_requested": "maintenance",
    "maintenance_cleared": "maintenance-clear",
}


async def bulk_lifecycle_state(
    db: AsyncSession, project_names: list[str]
) -> dict[str, str]:
    """État courant de chaque projet, en UNE requête (pas de N+1 pour la
    grille, même patron que `health_monitor.bulk_health_status`).

    Défaut implicite "normal" pour tout projet sans événement pertinent —
    à l'appelant de retomber dessus (absent du dict retourné).
    """
    if not project_names:
        return {}
    rows = (
        await db.execute(
            select(FleetLifecycleEvent.project_name, FleetLifecycleEvent.event_type)
            .where(
                FleetLifecycleEvent.project_name.in_(project_names),
                FleetLifecycleEvent.event_type.in_(tuple(STATE_EVENTS)),
            )
            .order_by(FleetLifecycleEvent.id)
        )
    ).all()
    # Ordre croissant : la dernière écriture pour un projet donné écrase les
    # précédentes dans ce dict — c'est elle qui doit gagner.
    last_state: dict[str, str] = {}
    for name, event_type in rows:
        last_state[name] = STATE_EVENTS[event_type]
    return last_state
