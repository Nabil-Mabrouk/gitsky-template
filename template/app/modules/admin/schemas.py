"""Schémas Pydantic du module admin (Chap 9)."""

from pydantic import BaseModel

from app.core.models import UserRole


class UserUpdate(BaseModel):
    """Champs modifiables par un admin — tous optionnels, seuls les champs
    fournis sont appliqués (PATCH partiel)."""

    role: UserRole | None = None
    is_active: bool | None = None
