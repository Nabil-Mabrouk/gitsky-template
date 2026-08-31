"""Routeur admin du module leads — vue projet-locale du landing collector
partagé + conversion en compte utilisateur.

Monté sous /api/leads par le core. Aucune donnée n'est dupliquée localement :
la liste vient d'un appel HTTP au landing collector (client.py) ; la seule
écriture propre à ce projet est le compte User créé/invité par /convert.
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import mailer
from app.core.auth.dependencies import require_admin
from app.core.auth.security import create_invite_token, hash_password
from app.core.config import get_settings
from app.core.database import get_db
from app.core.models import User, UserRole
from app.modules.leads import client
from app.modules.leads.schemas import ConvertLeadRequest, ConvertLeadResult, LeadRead

router = APIRouter()


@router.get("", response_model=list[LeadRead])
async def list_leads(_admin: User = Depends(require_admin)) -> list[dict]:
    settings = get_settings()
    return await client.fetch_leads(settings.project_name)


@router.post(
    "/convert", response_model=ConvertLeadResult, status_code=status.HTTP_201_CREATED
)
async def convert_lead(
    payload: ConvertLeadRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ConvertLeadResult:
    """Fait passer un lead (email seul, aucun compte) à Waitlist invité.

    Réutilise EXACTEMENT le mécanisme de app.modules.admin.router.invite_user
    (create_invite_token + envoi du lien) plutôt que de l'importer — frontière
    de module (jamais un import d'un autre module). Un lead sans compte
    préexistant reçoit un compte waitlist avec un mot de passe placeholder
    inutilisable : aucun précédent de compte sans mot de passe dans ce
    châssis (hashed_password est NOT NULL, app/core/models.py) — la seule
    entrée possible reste accept-invite, qui pose le VRAI mot de passe.
    """
    user = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()

    if user is not None and user.role != UserRole.waitlist:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà pour cet email avec un rôle différent de waitlist",
        )

    if user is None:
        user = User(
            email=payload.email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            role=UserRole.waitlist,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    settings = get_settings()
    token = create_invite_token(user.id)
    user.invite_token = token
    await db.commit()

    link = f"{settings.frontend_url}/invite/{token}"
    mailer.send_email(
        to=user.email,
        subject=f"Invitation — {settings.project_name}",
        body=f"Vous êtes invité·e à rejoindre {settings.project_name}.\n\n{link}\n\nCe lien expire dans 7 jours.",
    )
    return ConvertLeadResult(email=user.email, user_id=user.id, invited=True)
