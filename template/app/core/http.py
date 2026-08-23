"""Extraction de l'IP client réelle derrière Traefik (Chap 14/13).

Bug réel trouvé en prod (dashboard Sécurité, premier vrai déploiement des
onglets admin) : `security/middleware.py` et `analytics/middleware.py`
utilisaient tous les deux `request.client.host`, qui est l'IP du pair TCP
direct — Traefik, puisque le backend n'est JAMAIS joignable directement
(internal-net est `internal: true`, Chap 23 §2.3). Tous les événements de
sécurité et toutes les visites étaient donc attribués à la même IP interne
Docker, quel que soit le vrai visiteur.
"""

from starlette.requests import Request


def real_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Traefik est le SEUL proxy en amont. Un client peut forger cet
        # en-tête avec sa propre valeur ; Traefik AJOUTE la sienne À LA FIN
        # de la liste (chaînage standard des proxys, RFC 7239 informel) —
        # c'est donc le DERNIER maillon qui est fiable, jamais le premier
        # (sinon un attaquant spoofe trivialement son IP journalisée).
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else ""
