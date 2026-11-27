"""Modèle du module `security` (Chap 4 / Chap 14).

`security` stocke l'IP en clair (la mesure d'audience, elle, est déléguée à
Umami, sans IP stockée) :
les attaquants ne sont pas des utilisateurs légitimes, la traçabilité prime.
"""

from sqlalchemy import JSON, Column, DateTime, Integer, String, func

from app.core.database import Base


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True, nullable=False)  # path_scan, ...
    severity = Column(String, index=True, nullable=False)  # low..critical
    ip_address = Column(String, index=True)
    path = Column(String)
    user_agent = Column(String)
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
