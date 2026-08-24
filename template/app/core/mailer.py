"""Envoi d'email transactionnel (Chap 9 — invitations Waitlist).

Même contrat fail-closed que `stripe_client.py`/`suno.py`/`studio/llm.py` :
config absente -> stub (log en dev), config absente ET ENVIRONMENT=production
-> RuntimeError, jamais d'échec silencieux en prod.

SMTP générique (stdlib `smtplib`, zéro nouvelle dépendance pip) plutôt qu'un
fournisseur dédié — fonctionne avec un compte Gmail (mot de passe
d'application) sans nouvelle inscription, reste swappable vers un vrai
fournisseur transactionnel plus tard sans changement de code (même logique
que LLM_PROXY_URL abstrayant le fournisseur LLM).

Appel synchrone/bloquant depuis un handler async, accepté sciemment : un
clic admin occasionnel, pas un chemin chaud (même raisonnement que
analytics/middleware.py pour ne pas déporter son écriture DB non plus).
"""

import os
import smtplib
from email.message import EmailMessage


def send_email(to: str, subject: str, body: str) -> None:
    host = os.environ.get("SMTP_HOST", "")
    if not host:
        if os.environ.get("ENVIRONMENT", "").lower() == "production":
            raise RuntimeError(
                "SMTP_HOST manquant alors que ENVIRONMENT=production — "
                "refus d'échouer silencieusement (fail-closed)"
            )
        print(f"[DEV email stub] to={to} subject={subject}\n{body}")
        return

    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM", host)
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    port = int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port) as server:
        server.starttls()
        user = os.environ.get("SMTP_USER", "")
        if user:
            server.login(user, os.environ.get("SMTP_PASSWORD", ""))
        server.send_message(msg)
