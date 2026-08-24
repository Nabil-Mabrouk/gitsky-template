"""core: users.invite_token (invitations Waitlist)

Revision ID: 0003_core_user_invite_token
Revises: 0002_core_token_version
Create Date: 2026-08-24

Chap 9 : un admin envoie/renvoie une invitation à un compte `role=waitlist`,
qui génère un jeton stocké ici. Comparé à égalité stricte à l'acceptation —
un renvoi écrase l'ancien jeton (l'invalide même si encore cryptographiquement
valide), et le champ est remis à NULL après acceptation (usage unique).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_core_user_invite_token"
down_revision: Union[str, None] = "0002_core_token_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("invite_token", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "invite_token")
