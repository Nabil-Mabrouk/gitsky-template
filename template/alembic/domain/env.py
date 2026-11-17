"""Environnement Alembic — chaîne `domain` (app/domain/, async).

Appliquée TOUJOURS et EN DERNIER par scripts/migrate.py (Chap 4) : app/domain/
n'est pas un module optionnel, et ses tables peuvent référencer users ou celles
des modules. Table de version : DOMAIN_VERSION_TABLE (défaut
alembic_version_domain), propre à cette chaîne dans la base unique du projet.
"""

import asyncio
import importlib.util
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.core.database import Base

# Enregistre les modèles métier sur Base.metadata (autogenerate). Absent
# uniquement dans le template brut non rendu (models.py.jinja), que les tests
# du châssis migrent tel quel — jamais dans un projet généré.
if importlib.util.find_spec("app.domain.models") is not None:
    import app.domain.models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

_settings = get_settings()
_url = config.get_main_option("sqlalchemy.url") or _settings.database_url
_version_table = config.get_main_option("version_table") or _settings.domain_version_table


def _include_object(obj, name, type_, reflected, compare_to) -> bool:
    # La base contient aussi users et les tables des modules, absentes de la
    # metadata de cette chaîne : sans ce filtre, --autogenerate proposerait de
    # les DROP. Une table présente en base mais inconnue des modèles métier
    # n'appartient pas à cette chaîne.
    return not (type_ == "table" and reflected and compare_to is None)


def _configure(connection=None, url=None) -> None:
    context.configure(
        connection=connection,
        url=url,
        target_metadata=target_metadata,
        version_table=_version_table,
        include_object=_include_object,
        compare_type=True,
    )


def run_migrations_offline() -> None:
    _configure(url=_url)
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    _configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(_url)
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
