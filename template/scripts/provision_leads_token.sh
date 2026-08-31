#!/usr/bin/env bash
# =============================================================================
# scripts/provision_leads_token.sh — Calcule et écrit LEADS_COLLECTOR_TOKEN
# dans .env.local (module_leads).
#
# Usage : COLLECTOR_STATS_TOKEN=<jeton maître> ./scripts/provision_leads_token.sh
#
# Le jeton maître (COLLECTOR_STATS_TOKEN) vit dans shared_services/.env (ou
# .env.local du fleet dashboard) — CE projet ne le connaît structurellement
# JAMAIS (sinon il détiendrait un jeton fleet-wide, exactement ce que la
# dérivation par-projet est censée éviter). L'opérateur doit donc le fournir
# lui-même, récupéré sur le serveur shared_services.
#
# Utile dans deux cas : (1) le projet a reçu MODULE_LEADS via `copier update`
# APRÈS sa création (aucune écriture automatique possible à ce moment-là) ;
# (2) le fleet dashboard n'avait pas COLLECTOR_STATS_TOKEN dans son propre
# environnement au moment de la création (avertissement affiché alors par le
# wizard).
#
# Formule IDENTIQUE à landing_collector.main._derived_token (vérification
# serveur) et generator_client.provision_leads_token (calcul auto au wizard)
# — toute dérive entre les trois casserait silencieusement l'accès aux
# leads. Verrouillée par test_collector_stats_token.py.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
ENV_LOCAL_FILE="${PROJECT_DIR}/.env.local"

if [[ ! -f "$ENV_FILE" ]] || ! grep -q '^MODULE_LEADS=true' "$ENV_FILE"; then
    echo "MODULE_LEADS n'est pas actif sur ce projet — rien à faire."
    exit 0
fi

: "${COLLECTOR_STATS_TOKEN:?Usage: COLLECTOR_STATS_TOKEN=<jeton maître shared_services> $0}"

# `|| true` : sous pipefail, un grep sans résultat ferait échouer toute la
# pipeline avant le message d'erreur clair (même piège que rotate_*.sh).
PROJECT_NAME=$(grep -m1 '^PROJECT_NAME=' "$ENV_FILE" | cut -d= -f2- || true)

# HMAC-SHA256(COLLECTOR_STATS_TOKEN, PROJECT_NAME), hex minuscule — même
# formule EXACTE que landing_collector.main._derived_token (.hexdigest()).
DERIVED_TOKEN=$(printf '%s' "$PROJECT_NAME" | openssl dgst -sha256 -hmac "$COLLECTOR_STATS_TOKEN" | sed 's/^.* //')

touch "$ENV_LOCAL_FILE"
TMP=$(mktemp)
grep -v '^LEADS_COLLECTOR_TOKEN=' "$ENV_LOCAL_FILE" > "$TMP" || true
echo "LEADS_COLLECTOR_TOKEN=${DERIVED_TOKEN}" >> "$TMP"
mv "$TMP" "$ENV_LOCAL_FILE"

echo "Redémarrage de ${PROJECT_NAME}_backend..."
(cd "$PROJECT_DIR" && docker compose up -d --force-recreate backend)

echo "✓ LEADS_COLLECTOR_TOKEN provisionné pour ${PROJECT_NAME}."
