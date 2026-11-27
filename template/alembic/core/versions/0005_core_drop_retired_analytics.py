"""core: supprime les tables de l'ancien module analytics

Revision ID: 0005_core_drop_retired_analytics
Revises: 0004_core_user_password_reset
Create Date: 2026-11-27

Le module analytics maison (table `visits`, chaîne `alembic_version_analytics`)
a été retiré du châssis au profit d'Umami (Chap 13, 2026-11-27). Sa chaîne
n'existe plus : ses tables resteraient orphelines dans chaque base déjà
déployée.

Garde-fou : `visits` n'est supprimée QUE si `alembic_version_analytics`
existe aussi — la preuve qu'elle a été créée par l'ancien module, et pas par
un modèle métier qui s'appellerait lui aussi `visits` (app/domain).

Irréversible : l'historique des visites est perdu (une sauvegarde nocturne de
la base le conserve). `downgrade` ne recrée rien.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_core_drop_retired_analytics"
down_revision: Union[str, None] = "0004_core_user_password_reset"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "alembic_version_analytics" not in tables:
        return
    if "visits" in tables:
        op.drop_table("visits")
    op.drop_table("alembic_version_analytics")


def downgrade() -> None:
    # Rien à recréer : le module n'existe plus.
    pass
