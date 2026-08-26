"""fleet: drop tier column (catalogue de modules a plat, Phase 6)

Revision ID: 0003_fleet_drop_tier
Revises: 0002_fleet_maintenance_runs
Create Date: 2026-08-26

Suppression du systeme de paliers T0/T1/T2 (Chap 2) : plus de tier par
projet, plus de mecanisme de kill automatique (Chap 20 retire). `tier` ne
figure plus dans les modeles (app/modules/fleet/models.py) ; cette migration
retire la colonne des deux tables ou elle existait encore.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_fleet_drop_tier"
down_revision: Union[str, None] = "0002_fleet_maintenance_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("fleet_projects", "tier")
    op.drop_column("fleet_lifecycle_events", "tier")


def downgrade() -> None:
    # server_default="t0" seul le temps du ADD COLUMN (colonne NOT NULL sur une
    # table qui peut deja contenir des lignes) ; on ne retire pas ce default
    # ensuite (ALTER COLUMN ... DROP DEFAULT n'est pas portable sans le mode
    # batch d'Alembic, inutile ici — downgrade est un chemin de secours, pas le
    # sens nominal de cette migration).
    op.add_column(
        "fleet_lifecycle_events", sa.Column("tier", sa.String(), nullable=True)
    )
    op.add_column(
        "fleet_projects",
        sa.Column("tier", sa.String(), nullable=False, server_default="t0"),
    )
