"""SecurityHeadersMiddleware — en-têtes de sécurité HTTP sur les réponses API.

Contrairement à SecurityMiddleware (app/modules/security) et TrackingMiddleware
(app/modules/analytics), ce middleware n'est conditionné par aucun flag
MODULE_* : il tourne sur tout déploiement, au même niveau que CORSMiddleware
(core, Chap 2 §1). CSP volontairement absente — risque de casser le frontend
sans pouvoir calibrer en direct sur le vrai site (décision round sécurité
ai-qube, 2026-10-30).
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Un navigateur ignore ce header reçu hors HTTPS : pas besoin de le
        # conditionner sur ENVIRONMENT, sans risque à l'envoyer aussi en dev HTTP.
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains"
        )
        return response
