"""Routeur du module admin (Chap 9).

/modules : la découverte des modules actifs, consommée par AdminLayout côté
frontend pour construire dynamiquement sa sidebar sans dupliquer la logique
de résolution des flags déjà faite par Settings.

/users* : gestion des comptes (onglet Utilisateurs) et invitations Waitlist
(onglet Waitlist) — les deux onglets SHELL du chap 9, toujours présents dès
que le dashboard admin existe (donc montés ici, sous le flag module_admin,
plutôt que dépendre d'un module d'authentification séparé : l'auth est core,
mais un projet sans dashboard admin n'a jamais de raison d'exposer ces
endpoints).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import mailer
from app.core.auth.dependencies import require_admin
from app.core.auth.schemas import UserRead
from app.core.auth.security import create_invite_token
from app.core.config import MODULE_FLAGS, get_settings
from app.core.database import get_db
from app.core.models import User, UserRole
from app.modules.admin.schemas import UserUpdate

router = APIRouter()


@router.get("/modules")
async def list_modules(_admin: User = Depends(require_admin)) -> dict[str, bool]:
    settings = get_settings()
    return {
        flag.removeprefix("module_"): bool(getattr(settings, flag))
        for flag in MODULE_FLAGS
    }


@router.get("/users", response_model=list[UserRead])
async def list_users(
    role: UserRole | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[User]:
    stmt = select(User).order_by(User.email)
    if role is not None:
        stmt = stmt.where(User.role == role)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.patch("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable"
        )
    # Un admin qui se retire son propre rôle ou se désactive se verrouille
    # hors du dashboard qui seul permet de revenir en arrière (bug réel
    # rencontré en prod : nécessite alors une correction manuelle en base).
    if (
        user.id == _admin.id
        and (
            (payload.role is not None and payload.role != UserRole.admin)
            or payload.is_active is False
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de modifier votre propre rôle ou statut administrateur",
        )
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/invite", status_code=status.HTTP_204_NO_CONTENT)
async def invite_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable"
        )
    if user.role != UserRole.waitlist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seul un compte en liste d'attente peut être invité",
        )

    settings = get_settings()
    # Écrase un jeton précédent : un renvoi invalide implicitement l'ancien
    # lien (comparaison à égalité stricte côté accept-invite).
    token = create_invite_token(user.id)
    user.invite_token = token
    await db.commit()

    link = f"{settings.frontend_url}/invite/{token}"
    mailer.send_email(
        to=user.email,
        subject=f"Invitation — {settings.project_name}",
        body=f"Vous êtes invité·e à rejoindre {settings.project_name}.\n\n{link}\n\nCe lien expire dans 7 jours.",
    )
