"""core: users.must_change_password + users.reset_token

Revision ID: 0004_core_user_password_reset
Revises: 0003_core_user_invite_token
Create Date: 2026-09-09

Chap 7bis : un compte dont le mot de passe initial est choisi par un tiers
(create_admin.sh) doit être forcé à le changer à la première connexion
(`must_change_password`) ; tout compte doit pouvoir récupérer un mot de
passe oublié (`reset_token`, même mécanique que `invite_token` — jeton
stocké tel quel, comparé à égalité stricte, usage unique).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_core_user_password_reset"
down_revision: Union[str, None] = "0003_core_user_invite_token"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column("users", sa.Column("reset_token", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "reset_token")
    op.drop_column("users", "must_change_password")
