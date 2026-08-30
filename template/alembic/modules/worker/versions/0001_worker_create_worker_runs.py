"""worker: create worker_runs table

Revision ID: 0001_worker_runs
Revises:
Create Date: 2026-08-30

Chaîne du module worker. Crée `worker_runs` — audit opérationnel pur des
cycles (début/fin/statut/erreur), pas un event store (Chap X).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_worker_runs"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "worker_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_worker_runs_id", "worker_runs", ["id"], unique=False)
    op.create_index("ix_worker_runs_status", "worker_runs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_worker_runs_status", table_name="worker_runs")
    op.drop_index("ix_worker_runs_id", table_name="worker_runs")
    op.drop_table("worker_runs")
