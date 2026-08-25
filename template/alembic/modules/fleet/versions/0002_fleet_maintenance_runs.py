"""fleet: create fleet_maintenance_runs

Revision ID: 0002_fleet_maintenance_runs
Revises: 0001_fleet_tables
Create Date: 2026-08-25

Journal des opérations de maintenance de flotte (Chap 23) : backup, test de
restauration, jauge disque — reporté par les scripts shared_services/scripts/
via POST /api/fleet/maintenance/report.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_fleet_maintenance_runs"
down_revision: Union[str, None] = "0001_fleet_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fleet_maintenance_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("project", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fleet_maintenance_runs_id", "fleet_maintenance_runs", ["id"], unique=False)
    op.create_index("ix_fleet_maintenance_runs_job", "fleet_maintenance_runs", ["job"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_fleet_maintenance_runs_job", table_name="fleet_maintenance_runs")
    op.drop_index("ix_fleet_maintenance_runs_id", table_name="fleet_maintenance_runs")
    op.drop_table("fleet_maintenance_runs")
