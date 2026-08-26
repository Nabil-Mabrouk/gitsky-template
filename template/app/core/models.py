"""Modèles du core (Chap 4).

Deux entités toujours présentes, l'authentification étant core (Chap 2 §1) :
l'énumération de rôles `UserRole` et le modèle `User`. Une landing minimale
qui n'utilise jamais l'auth peut laisser la table `users` vide, mais sa
migration reste appliquée dans tout projet (voir Chap 4).
"""

import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, func

from app.core.database import Base


class UserRole(str, enum.Enum):
    anonymous = "anonymous"
    waitlist = "waitlist"
    user = "user"
    premium = "premium"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # Version des refresh tokens (Chap 7 §Révocation). Le JWT refresh embarque
    # cette valeur (claim `tv`) ; l'incrémenter invalide TOUS les refresh déjà
    # émis — seul levier de révocation d'un JWT stateless (token volé,
    # « déconnexion partout », changement de mot de passe).
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    # Jeton d'invitation Waitlist courant (Chap 9), stocké tel quel (pas juste
    # sa signature) : comparé à égalité stricte à l'acceptation, ce qui donne
    # à la fois l'invalidation d'un lien remplacé par un renvoi et l'usage
    # unique (remis à None après acceptation) sans logique de révocation
    # séparée — le jeton lui-même reste un JWT signé/expirant classique.
    invite_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
