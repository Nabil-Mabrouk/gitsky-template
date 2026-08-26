"""Schémas Pydantic du module fleet (Chap 5)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ProjectRegister(BaseModel):
    name: str
    domain: str = ""
    template_version: str = ""


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    domain: str | None
    status: str
    publish_status: str
    template_version: str | None


class PromoteRequest(BaseModel):
    guardrails_pass: bool = True
    human_approved: bool = False


class PromoteResult(BaseModel):
    project: str
    publish_status: str
    allowed: bool
    reason: str


class HealthSweepRequest(BaseModel):
    # Dernier succès /health par projet (le poller le tient à jour). null =
    # aucun succès connu. `now` optionnel : sinon l'heure serveur fait foi.
    last_success: dict[str, datetime | None]
    now: datetime | None = None


class HealthSweepResult(BaseModel):
    failed: list[str]
    recovered: list[str]


class LeadRead(BaseModel):
    # Miroir local de landing_collector.schemas.LeadOut (pas d'import
    # cross-service — frontière déjà respectée partout ailleurs dans ce code).
    id: int
    project: str
    email: str
    source: str | None
    utm_campaign: str | None
    created_at: datetime | None
    verified: bool


class MaintenanceReport(BaseModel):
    job: str
    status: Literal["success", "failure"]
    summary: str = ""
    project: str | None = None


class MaintenanceRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job: str
    status: str
    summary: str | None
    project: str | None
    created_at: datetime | None
