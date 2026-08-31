"""Module châssis `leads` — vue projet-locale des leads captés par la landing
publique (EmailCapture.tsx -> POST /leads du landing collector partagé,
Chap 18), avec conversion en compte utilisateur (Waitlist invité). Ne stocke
AUCUN lead localement : la donnée reste dans landing_collector, une seule
source de vérité (Chap 19) — seule l'écriture d'un `User` lors d'une
conversion touche la base de CE projet.

À ne pas confondre avec module_fleet : son onglet Leads (Chap 19) montre TOUS
les projets de la flotte à l'opérateur fleet ; celui-ci ne montre à l'admin
DE ce projet que SES propres leads, via un jeton dérivé propre à ce projet
(voir client.py) — jamais le jeton maître fleet-wide.
"""

from app.modules.leads.router import router

__all__ = ["router"]
