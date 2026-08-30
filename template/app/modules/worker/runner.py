"""Entrypoint du service `worker` (docker-compose `worker: command`, Chap X).

Boucle planifiée minimale : rattrapage au boot, puis répète `run_cycle()` à
intervalle fixe jusqu'à SIGTERM/SIGINT. Le contenu métier du cycle vit dans
`app.domain.worker_cycle` — ce fichier ne fait QUE la mécanique (audit,
arrêt propre, cadence), jamais de logique métier.

`docker compose up -d --build` redémarre CE service à chaque déploiement
(push), pas seulement ceux qui le touchent (Chap 26 §pipeline) — d'où le
soin apporté à l'arrêt propre plutôt qu'à compter sur `stop_grace_period`
seul.
"""

import asyncio
import signal
import traceback
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.domain.worker_cycle import run_cycle
from app.modules.worker.models import WorkerRun
from app.modules.worker.recovery import recover_interrupted_runs

settings = get_settings()


async def _start_run() -> int:
    async with SessionLocal() as db:
        run = WorkerRun(status="running")
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return run.id


async def _finish_run(run_id: int, status: str, error: str | None = None) -> None:
    async with SessionLocal() as db:
        run = await db.get(WorkerRun, run_id)
        if run is None:
            return
        run.status = status
        run.error = error
        run.finished_at = datetime.now(timezone.utc)
        await db.commit()


async def main() -> None:
    shutdown = asyncio.Event()

    def _handle_signal(_signum, _frame) -> None:
        shutdown.set()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    recovered = await recover_interrupted_runs(SessionLocal)
    if recovered:
        print(f"worker: {recovered} exécution(s) interrompue(s) rattrapée(s) au boot")

    while not shutdown.is_set():
        run_id = await _start_run()
        try:
            async with SessionLocal() as db:
                # `shutdown` passé pour qu'un cycle bien élevé puisse s'arrêter
                # AU MILIEU d'un travail long, pas seulement entre deux cycles.
                await run_cycle(db, shutdown)
            await _finish_run(run_id, "success")
        except Exception as exc:  # noqa: BLE001 — un cycle cassé ne doit pas tuer la boucle
            await _finish_run(run_id, "failed", error=f"{exc}\n{traceback.format_exc()}")

        try:
            await asyncio.wait_for(
                shutdown.wait(), timeout=settings.worker_interval_seconds
            )
        except asyncio.TimeoutError:
            pass


if __name__ == "__main__":
    asyncio.run(main())
