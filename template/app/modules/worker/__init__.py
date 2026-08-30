"""Module châssis `worker` — scaffolding d'un cycle métier long-vivant.

Fournit le conteneur, l'arrêt propre (SIGTERM), le squelette de boucle
planifiée (`runner.py`) et un audit d'exécution minimal (`WorkerRun`). La
logique métier du cycle lui-même (allocation/trading/bulletin, etc.) N'EST
PAS ici : elle vit dans `app/domain/worker_cycle.py`, le point d'extension
du projet.
"""

from app.modules.worker.router import router

__all__ = ["router"]
