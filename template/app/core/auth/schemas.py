"""Schémas Pydantic du module auth (Chap 5 §Validation)."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.models import UserRole


class Credentials(BaseModel):
    """Identifiants pour le login — password NON contraint : un compte créé
    avant la politique de mot de passe doit toujours pouvoir se connecter."""

    email: EmailStr
    password: str


class RegisterRequest(Credentials):
    """Création de compte : la politique de mot de passe s'applique ICI
    (et seulement ici) — 8 caractères minimum."""

    password: str = Field(min_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: UserRole
    is_active: bool
    must_change_password: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Porté aussi ici (pas seulement sur UserRead) pour que le frontend
    # puisse rediriger dès la réponse de /login, sans attendre un aller-
    # retour /me supplémentaire.
    must_change_password: bool = False


class AcceptInviteRequest(BaseModel):
    """Acceptation d'une invitation Waitlist (Chap 9) : même politique de
    mot de passe que RegisterRequest — c'est aussi une création de compte."""

    token: str
    password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Même politique de mot de passe que RegisterRequest — c'est aussi,
    de facto, le titulaire qui choisit un mot de passe pour la première fois
    de façon vérifiable (jeton envoyé à son email)."""

    token: str
    password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    """Changement volontaire OU forcé (must_change_password) — les deux
    passent par le même endpoint, `current_password` est toujours requis :
    défense en profondeur même avec un access token dérobé."""

    current_password: str
    new_password: str = Field(min_length=8)
