#!/usr/bin/env bash
# =============================================================================
# scripts/rotate_postgres_password.sh — Fait tourner POSTGRES_PASSWORD.
# (Chap 23 §2.2)
#
# Usage : ./scripts/rotate_postgres_password.sh
#
# L'image postgres officielle n'applique POSTGRES_PASSWORD qu'au tout premier
# initdb sur un volume vide (Chap 21) : changer .env seul ne change RIEN pour
# un rôle déjà initialisé — le rôle live garde son ancien mot de passe même
# après un `docker compose up` avec une nouvelle valeur dans .env (bug de
# prod réel, vécu deux fois cette session avant que ce script n'existe :
# le backend échouait en "password authentication failed" alors que .env
# semblait pourtant correct). Ce script fait les DEUX étapes dans l'ordre :
# ALTER USER sur le rôle vivant (connexion locale par socket Unix, qui
# contourne le scram-sha-256 exigé des connexions TCP — donc pas besoin de
# connaître l'ancien mot de passe), puis .env, puis redémarre le backend.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "✗ $ENV_FILE introuvable." >&2
    exit 1
fi

# `|| true` : sous `pipefail`, un grep sans résultat ferait échouer toute la
# pipeline (silencieusement, via `set -e`) AVANT le message d'erreur clair
# ci-dessous — on veut une variable vide, pas une sortie muette.
PROJECT_NAME=$(grep -m1 '^PROJECT_NAME=' "$ENV_FILE" | cut -d= -f2- || true)
POSTGRES_USER=$(grep -m1 '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- || true)
POSTGRES_DB=$(grep -m1 '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- || true)

if [[ -z "$PROJECT_NAME" || -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
    echo "✗ PROJECT_NAME/POSTGRES_USER/POSTGRES_DB absents de $ENV_FILE" >&2
    echo "  (projet T0 sans PostgreSQL ? rien à faire dans ce cas)." >&2
    exit 1
fi

NEW_PASSWORD=$(openssl rand -hex 64)

echo "Application du nouveau mot de passe sur le rôle live ${POSTGRES_USER}..."
docker exec "${PROJECT_NAME}_db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "ALTER USER ${POSTGRES_USER} WITH PASSWORD '${NEW_PASSWORD}';"

TMP=$(mktemp)
grep -v '^POSTGRES_PASSWORD=' "$ENV_FILE" > "$TMP"
echo "POSTGRES_PASSWORD=${NEW_PASSWORD}" >> "$TMP"
mv "$TMP" "$ENV_FILE"

echo "Redémarrage de ${PROJECT_NAME}_backend..."
(cd "$PROJECT_DIR" && docker compose up -d --force-recreate backend)

# Vérifie que le backend arrive vraiment à se connecter avec le nouveau mot
# de passe avant de déclarer la rotation réussie — même patron
# (HEALTH_CHECK_RETRIES/DELAY, sonde Python jamais curl, Chap 26) que
# deploy-on-push.sh.
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-6}"
HEALTH_CHECK_DELAY="${HEALTH_CHECK_DELAY:-5}"
for _ in $(seq 1 "$HEALTH_CHECK_RETRIES"); do
    if docker exec "${PROJECT_NAME}_backend" python -c '
import sys, urllib.request
try:
    sys.exit(0 if urllib.request.urlopen("http://localhost:8000/health", timeout=4).status == 200 else 1)
except Exception:
    sys.exit(1)
' >/dev/null 2>&1; then
        echo "✓ POSTGRES_PASSWORD roté pour ${PROJECT_NAME}, /health répond."
        exit 0
    fi
    sleep "$HEALTH_CHECK_DELAY"
done

echo "✗ Mot de passe changé mais /health ne répond pas — vérifier manuellement." >&2
exit 1
