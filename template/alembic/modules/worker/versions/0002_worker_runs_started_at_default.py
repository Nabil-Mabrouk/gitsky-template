"""worker: add server default to worker_runs.started_at

Revision ID: 0002_worker_runs_default
Revises: 0001_worker_runs
Create Date: 2026-09-07

Bug de prod réel : le modèle (`app/modules/worker/models.py`) déclare
`started_at` avec `server_default=func.now()`, mais la migration 0001 avait
créé la colonne sans défaut côté base (`nullable=False`, rien d'autre).
`runner.py::_start_run()` insère un `WorkerRun` sans jamais fixer
`started_at` lui-même (il compte sur la base pour le remplir) — sur une
base issue de 0001 seule, chaque insertion violait donc la contrainte
NOT NULL, faisant crasher le worker en boucle dès le premier cycle. Trouvé
en observant `cryptokilla_worker` réellement en `Restarting` en production,
pas en test (la suite existante construit son schéma via
`Base.metadata.create_all`, qui lit le modèle actuel — jamais la vraie
chaîne Alembic — donc ne pouvait pas révéler cet écart).

`batch_alter_table` : SQLite (utilisé par la suite de tests) ne supporte
pas `ALTER COLUMN` nativement — le mode batch recrée la table dessous,
fonctionne aussi tel quel sur PostgreSQL (ALTER direct, pas de recréation).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_worker_runs_default"
down_revision: Union[str, None] = "0001_worker_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("worker_runs") as batch_op:
        batch_op.alter_column(
            "started_at",
            existing_type=sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        )


def downgrade() -> None:
    with op.batch_alter_table("worker_runs") as batch_op:
        batch_op.alter_column(
            "started_at",
            existing_type=sa.DateTime(timezone=True),
            server_default=None,
        )
