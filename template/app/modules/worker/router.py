"""Routeur admin du module worker (Chap X) — lecture seule de l'audit des cycles.

Monté sous /api/worker par le core. Ne pilote rien (pas de start/stop ici :
le cycle de vie du conteneur worker suit celui du reste du projet, comme
backend/frontend).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.dependencies import require_admin
from app.core.database import get_db
from app.core.models import User
from app.modules.worker.models import WorkerRun
from app.modules.worker.schemas import WorkerRunOut

router = APIRouter()


@router.get("/status", response_model=list[WorkerRunOut])
async def status(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[WorkerRun]:
    rows = (
        await db.execute(
            select(WorkerRun).order_by(WorkerRun.started_at.desc()).limit(limit)
        )
    ).scalars().all()
    return list(rows)
