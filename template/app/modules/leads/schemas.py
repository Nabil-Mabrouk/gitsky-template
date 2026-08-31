"""Schémas Pydantic du module leads."""

from datetime import datetime

from pydantic import BaseModel, EmailStr


class LeadRead(BaseModel):
    # Miroir local de landing_collector.schemas.LeadOut — même doctrine que
    # app/modules/fleet/schemas.py::LeadRead (pas d'import cross-service, pas
    # d'import cross-module non plus : ce module a SA PROPRE copie plutôt
    # que d'importer app.modules.fleet.schemas.LeadRead).
    id: int
    project: str
    email: str
    source: str | None
    utm_campaign: str | None
    created_at: datetime | None
    verified: bool


class ConvertLeadRequest(BaseModel):
    email: EmailStr


class ConvertLeadResult(BaseModel):
    email: str
    user_id: int
    invited: bool
