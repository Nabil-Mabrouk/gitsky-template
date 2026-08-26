"""fleet: add github_repo and github_webhook_installed to fleet_projects

Revision ID: 0004_fleet_github_fields
Revises: 0003_fleet_drop_tier
Create Date: 2026-08-26

Intégration GitHub (Chap 26, Phase D) : mémorise le dépôt lié à un projet
(créé via l'API ou lié manuellement à un dépôt existant) et si un webhook
push a pu y être installé — sinon le redeploy automatique reste indisponible
pour ce projet, le redeploy restant manuel.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_fleet_github_fields"
down_revision: Union[str, None] = "0003_fleet_drop_tier"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fleet_projects", sa.Column("github_repo", sa.String(), nullable=True))
    op.add_column(
        "fleet_projects",
        sa.Column(
            "github_webhook_installed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("fleet_projects", "github_webhook_installed")
    op.drop_column("fleet_projects", "github_repo")
