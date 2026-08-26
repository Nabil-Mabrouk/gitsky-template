"""Module core `auth` (Chap 7).

Core (Chap 2 §1) : présent et actif dans tout projet, sans flag `MODULE_*`. Ce
paquet fournit les primitives de sécurité (hachage argon2, JWT access/refresh)
ainsi que le routeur FastAPI monté par `app.core.main`.
"""

from app.core.auth.router import router
from app.core.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

__all__ = [
    "router",
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
]
