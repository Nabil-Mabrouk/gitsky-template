"""Module `fleet` — dashboard de flotte (Chap 19/20).

Activé uniquement pour l'app dashboard (MODULE_FLEET=true, mystudio.com).
Contrat : expose `router`. Registre des projets + journal de cycle de vie +
monitoring de disponibilité.
"""

from app.modules.fleet.router import router

__all__ = ["router"]
