"""Routeur d'authentification (Chap 7).

Endpoints : register / login / refresh / me.
Stratégie hybride : access token (JWT court) renvoyé dans le corps pour le
frontend ; refresh token (long) posé dans un cookie **HttpOnly** — jamais exposé
au JavaScript (protection XSS).
"""

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import mailer
from app.core.auth.dependencies import get_current_user
from app.core.auth.schemas import (
    AcceptInviteRequest,
    ChangePasswordRequest,
    Credentials,
    ForgotPasswordRequest,
    RegisterRequest,
    ResetPasswordRequest,
    Token,
    UserRead,
)
from app.core.auth.security import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.core.models import User, UserRole

router = APIRouter()
settings = get_settings()

REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
        max_age=settings.refresh_token_expire_days * 86_400,
        path="/api/auth",
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    exists = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email déjà enregistré"
        )
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/accept-invite", response_model=Token)
async def accept_invite(
    payload: AcceptInviteRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Acceptation d'une invitation Waitlist (Chap 9) — public, aucune auth.

    Un jeton toujours valide (signature + expiration) mais remplacé par un
    renvoi, ou déjà consommé par un accept précédent, est rejeté par la
    comparaison stricte à `user.invite_token`. Message d'erreur générique
    dans tous les cas (jeton invalide / expiré / déjà utilisé) — ne pas
    révéler à un tiers qui aurait intercepté un vieux lien lequel des trois.
    """
    try:
        decoded = decode_token(payload.token, expected_type="invite")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invitation invalide"
        )

    user = await db.get(User, int(decoded["sub"]))
    if (
        user is None
        or user.role != UserRole.waitlist
        or payload.token != user.invite_token
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invitation invalide"
        )

    user.hashed_password = hash_password(payload.password)
    user.role = UserRole.user
    user.invite_token = None
    await db.commit()

    # Onboarding en un geste : connecte directement, même motif que /login.
    _set_refresh_cookie(
        response, create_refresh_token(user.id, tv=user.token_version)
    )
    return Token(access_token=create_access_token(user.id, role=user.role.value))


@router.post("/login", response_model=Token)
async def login(
    payload: Credentials,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Token:
    user = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Compte inactif"
        )

    # Le refresh embarque la version de token du compte (claim `tv`) :
    # incrémenter user.token_version révoque tous les refresh déjà émis.
    _set_refresh_cookie(
        response, create_refresh_token(user.id, tv=user.token_version)
    )
    return Token(
        access_token=create_access_token(user.id, role=user.role.value),
        must_change_password=user.must_change_password,
    )


@router.post("/refresh", response_model=Token)
async def refresh(
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> Token:
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token manquant"
        )
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalide"
        )

    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur invalide"
        )
    # Révocation : un refresh émis avant le dernier logout-all porte un `tv`
    # périmé — il est refusé même si sa signature et son expiration sont
    # valides. Seule défense possible contre un JWT stateless volé.
    if payload.get("tv", 0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token révoqué"
        )
    return Token(access_token=create_access_token(user.id, role=user.role.value))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    """Expire le cookie refresh HttpOnly.

    Sans cet endpoint, « se déconnecter » ne vidait que le localStorage : le
    refresh restait valable 7 jours sur la machine. Volontairement sans auth —
    il doit fonctionner même avec un access token déjà expiré.
    """
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Révoque TOUS les refresh tokens du compte (« déconnexion partout »).

    /logout ne supprime que le cookie du navigateur courant : un refresh copié
    avant (machine compromise) resterait valable 7 jours. Incrémenter
    token_version périme le claim `tv` de tous les refresh émis.
    """
    current_user.token_version += 1
    await db.commit()
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> None:
    """Demande de réinitialisation (Chap 7bis) — toujours 202, que l'email
    existe ou non : ne jamais révéler à un tiers si une adresse a un compte.
    """
    user = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        return

    # Écrase un jeton précédent : une demande répétée invalide implicitement
    # la précédente (même comparaison à égalité stricte que invite_token).
    token = create_reset_token(user.id)
    user.reset_token = token
    await db.commit()

    link = f"{settings.frontend_url}/reset-password/{token}"
    mailer.send_email(
        to=user.email,
        subject=f"Réinitialisation de mot de passe — {settings.project_name}",
        body=(
            f"Une réinitialisation de mot de passe a été demandée pour ce "
            f"compte.\n\n{link}\n\nCe lien expire dans 1 heure. Si vous n'êtes "
            f"pas à l'origine de cette demande, ignorez cet email."
        ),
    )


@router.post("/reset-password", response_model=Token)
async def reset_password(
    payload: ResetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Message d'erreur générique dans tous les cas (jeton invalide / expiré
    / déjà utilisé) — même raisonnement que accept_invite : ne pas révéler
    à un tiers ayant intercepté un vieux lien lequel des trois s'applique.
    """
    try:
        decoded = decode_token(payload.token, expected_type="reset")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Lien invalide ou expiré"
        )

    user = await db.get(User, int(decoded["sub"]))
    if user is None or payload.token != user.reset_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Lien invalide ou expiré"
        )

    user.hashed_password = hash_password(payload.password)
    user.reset_token = None
    user.must_change_password = False
    # Un reset doit invalider toute session déjà ouverte (y compris celle
    # d'un attaquant qui aurait le mot de passe compromis d'origine) — même
    # levier que logout-all (Chap 7 §Révocation).
    user.token_version += 1
    await db.commit()

    _set_refresh_cookie(
        response, create_refresh_token(user.id, tv=user.token_version)
    )
    return Token(access_token=create_access_token(user.id, role=user.role.value))


@router.patch("/change-password", response_model=Token)
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Sert à la fois le changement volontaire et le changement forcé
    (must_change_password, Chap 7bis) — `current_password` toujours requis,
    même avec un access token déjà valide (défense en profondeur)."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe actuel incorrect",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    # Même raisonnement que reset_password : un ancien mot de passe compromis
    # ne doit plus ouvrir aucune session après le changement.
    current_user.token_version += 1
    await db.commit()

    _set_refresh_cookie(
        response, create_refresh_token(current_user.id, tv=current_user.token_version)
    )
    return Token(
        access_token=create_access_token(current_user.id, role=current_user.role.value)
    )
