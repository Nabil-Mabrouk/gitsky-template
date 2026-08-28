#!/usr/bin/env bash
# =============================================================================
# scripts/create_admin.sh — Crée (ou promeut) un compte administrateur.
# (Chap 7/9, round outillage)
#
# Usage : ./scripts/create_admin.sh <email> [password]
#   Sans mot de passe fourni, un mot de passe aléatoire est généré et
#   affiché UNE SEULE FOIS en sortie — à noter immédiatement, jamais
#   journalisé nulle part ailleurs par ce script.
#
# Appelle POST /api/auth/register depuis L'INTÉRIEUR du conteneur backend
# (Python urllib, jamais curl — aucune image backend GitSky ne l'installe,
# Chap 21) : évite toute dépendance au domaine public/DNS/TLS, marche même
# en pleine maintenance. Email et mot de passe passent par des variables
# d'environnement du `docker exec`, jamais interpolés dans le code Python ou
# le SQL — un mot de passe contenant un guillemet ne doit rien casser.
#
# Si le compte existe déjà (409), le mot de passe n'est PAS changé — seul
# le rôle est promu (cas d'un compte déjà inscrit normalement).
# =============================================================================

set -euo pipefail

EMAIL="${1:?Usage: create_admin.sh <email> [password]}"
PASSWORD="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

# `|| true` : sous pipefail, un grep sans résultat ferait échouer toute la
# pipeline avant le message d'erreur clair (même piège que rotate_*.sh).
PROJECT_NAME=$(grep -m1 '^PROJECT_NAME=' "$ENV_FILE" | cut -d= -f2- || true)
POSTGRES_USER=$(grep -m1 '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- || true)
POSTGRES_DB=$(grep -m1 '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- || true)

if [[ -z "$PROJECT_NAME" || -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
    echo "✗ PROJECT_NAME/POSTGRES_USER/POSTGRES_DB absents de $ENV_FILE" >&2
    echo "  (projet T0 sans PostgreSQL ? rien à faire dans ce cas)." >&2
    exit 1
fi

GENERATED=0
if [[ -z "$PASSWORD" ]]; then
    PASSWORD=$(openssl rand -base64 18)
    GENERATED=1
fi

RESULT=$(docker exec \
    -e REGISTER_EMAIL="$EMAIL" \
    -e REGISTER_PASSWORD="$PASSWORD" \
    "${PROJECT_NAME}_backend" python -c '
import json, os, urllib.error, urllib.request

body = json.dumps({
    "email": os.environ["REGISTER_EMAIL"],
    "password": os.environ["REGISTER_PASSWORD"],
}).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/auth/register",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=5)
    print("created")
except urllib.error.HTTPError as e:
    print("exists" if e.code == 409 else f"error:{e.code}")
')

case "$RESULT" in
    created)
        echo "Compte créé : ${EMAIL}"
        ;;
    exists)
        echo "Le compte ${EMAIL} existe déjà — mot de passe inchangé, promotion du rôle uniquement."
        ;;
    *)
        echo "✗ Échec de la création du compte (${RESULT}) — email invalide ?" >&2
        exit 1
        ;;
esac

# `-v email=` + `:'email'` : psql substitue et met entre guillemets SQL
# correctement, jamais d'interpolation directe d'une valeur venant de
# l'opérateur dans le texte de la requête.
docker exec "${PROJECT_NAME}_db" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v email="$EMAIL" -c "UPDATE users SET role = 'admin' WHERE email = :'email';"

echo "✓ ${EMAIL} est maintenant admin sur ${PROJECT_NAME}."
if [[ $GENERATED -eq 1 && "$RESULT" == "created" ]]; then
    echo ""
    echo "⚠ Mot de passe généré (à noter maintenant, non journalisé) : ${PASSWORD}"
fi
