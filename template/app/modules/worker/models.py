"""Modèle du module `worker` (Chap X, round worker).

`WorkerRun` est un audit opérationnel pur (début/fin/statut/erreur) — pas un
event store ni un mécanisme de checkpoint générique. Si le cycle métier a
besoin de reprendre au milieu de son travail, c'est au projet de le gérer
dans `app/domain/worker_cycle.py`, pas au châssis.
"""

from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.core.database import Base


class WorkerRun(Base):
    __tablename__ = "worker_runs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    # running -> success | failed | interrupted (recovery.py, au boot du worker).
    status = Column(String, nullable=False, default="running", index=True)
    error = Column(Text, nullable=True)
