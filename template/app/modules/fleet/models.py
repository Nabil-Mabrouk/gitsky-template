"""Modèles du module `fleet` (Chap 19 / Chap 20 / Chap 23).

Le fleet dashboard ne duplique PAS les métriques (agrégées en direct), mais il
possède trois tables : le registre des projets, le journal de cycle de vie
(`fleet_lifecycle_events`) et le journal des opérations de maintenance
(`fleet_maintenance_runs`) — distinct du précédent : celui-ci suit des
opérations de FLOTTE (backup, test de restauration, disque), pas toujours
rattachées à un seul projet, alors que `fleet_lifecycle_events` suit le cycle
de vie d'UN projet.
"""

from sqlalchemy import Column, DateTime, Integer, String, func

from app.core.database import Base


class Project(Base):
    __tablename__ = "fleet_projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    domain = Column(String)
    status = Column(String, nullable=False, default="active")  # active/archived
    publish_status = Column(String, nullable=False, default="draft")  # draft/preview/live
    template_version = Column(String)
    first_deployed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FleetLifecycleEvent(Base):
    __tablename__ = "fleet_lifecycle_events"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, index=True, nullable=False)
    event_type = Column(String, nullable=False)  # born/publish_*/deployment_failed/deployment_recovered/archived
    reason = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MaintenanceRun(Base):
    __tablename__ = "fleet_maintenance_runs"

    id = Column(Integer, primary_key=True, index=True)
    job = Column(String, nullable=False, index=True)  # backup-fleet/restore-test/disk-check
    status = Column(String, nullable=False)  # success/failure
    summary = Column(String)
    project = Column(String, nullable=True)  # peuplé pour restore-test
    created_at = Column(DateTime(timezone=True), server_default=func.now())
