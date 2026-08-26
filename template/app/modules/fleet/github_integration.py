"""Intégration GitHub (Chap 26 — Phase D) : vérification de signature webhook.

Le dashboard reçoit les événements `push` de GitHub sur
POST /api/fleet/webhooks/github/{name} pour déclencher un redeploy
automatique (Chap 26). GitHub signe chaque livraison avec un secret partagé
par dépôt/app (header `X-Hub-Signature-256: sha256=<hmac>`) — cette fonction
fait la seule chose qui compte côté sécurité : vérifier que la requête vient
bien de GitHub avant de faire quoi que ce soit avec son contenu (même
raisonnement que verify_fleet_service_token pour /register : un webhook
public serait un déclencheur de déploiement arbitraire).
"""

import hashlib
import hmac
import json


def is_deploy_push(event: str | None, payload: bytes, deploy_branch: str) -> bool:
    """True si cette livraison webhook doit déclencher un redeploy.

    Seul un événement `push` sur `deploy_branch` (défaut : main) compte —
    un push sur une branche feature/WIP est une livraison légitime que
    GitHub notifie normalement, mais ce n'est pas un signal de déploiement
    (Chap 26) : le développeur n'a pas fini, il n'a pas mergé. Un JSON de
    payload malformé ou sans `ref` est traité comme "pas un déploiement",
    jamais comme une exception qui ferait échouer la requête.
    """
    if event != "push":
        return False
    try:
        ref = json.loads(payload).get("ref")
    except (json.JSONDecodeError, AttributeError):
        return False
    return ref == f"refs/heads/{deploy_branch}"


def verify_webhook_signature(
    payload: bytes, signature_header: str | None, secret: str
) -> bool:
    """True si `signature_header` (format `sha256=<hex>`) correspond au HMAC-
    SHA256 de `payload` avec `secret`.

    Comparaison en temps constant (hmac.compare_digest) — même précaution que
    le token fleet M2M (verify_fleet_service_token) : une timing attack ne
    doit pas pouvoir deviner le secret octet par octet. Un secret ou un
    header absent est toujours un refus, jamais une exception.
    """
    if not secret or not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    provided = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)
