"""Récupération des cycles worker orphelins (durcissement, Chap X).

Contrairement à agentic (dont la récupération vit dans le lifespan du
BACKEND, parce que ce sont les asyncio.Task du backend qui sont orphelines à
son propre redémarrage), c'est le PROCESS worker lui-même qui écrit
WorkerRun — donc c'est SON propre boot qui doit rattraper toute exécution
encore "running" à ce moment-là. Appelé depuis runner.py, jamais main.py.
"""

from sqlalchemy import select

from app.modules.worker.models import WorkerRun


async def recover_interrupted_runs(session_factory) -> int:
    """Marque `interrupted` toute exécution restée `running` (redémarrage).

    Renvoie le nombre d'exécutions rattrapées.
    """
    async with session_factory() as db:
        orphans = (
            (await db.execute(select(WorkerRun).where(WorkerRun.status == "running")))
            .scalars()
            .all()
        )
        for run in orphans:
            run.status = "interrupted"
        await db.commit()
        return len(orphans)
