#!/usr/bin/env bash
# =============================================================================
# scripts/rotate_fleet_tokens.sh — Fait tourner FLEET_REGISTER_TOKEN et
# COLLECTOR_STATS_TOKEN (fleet dashboard uniquement, Chap 19/23).
#
# Usage : ./scripts/rotate_fleet_tokens.sh
#
# N'a de sens QUE sur le projet fleet dashboard lui-même (MODULE_FLEET=true)
# — sort proprement sinon, pour rester livrable dans tout projet sans
# condition de génération. Ces deux jetons vivent dans .env.local (Chap 23,
# credentials sans valeur dérivable à la génération), pas .env.
#
# IMPORTANT : FLEET_REGISTER_TOKEN est AUSSI utilisé par crontab.fleet sur
# l'hôte (fleet-health.sh, backup-fleet.sh, deploy-on-push.sh — Chap 26/27).
# Ce script NE LE MET PAS À JOUR là-bas : crontab.fleet vit dans
# shared_services/, hors de la portée d'un script livré par-projet. La
# nouvelle valeur est affichée en clair avec un rappel explicite plutôt que
# cachée derrière un TODO silencieux (staleness déjà vécue en prod : ces
# scripts échouent en 401 sans message clair tant que crontab.fleet n'est
# pas mis à jour à la main).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
ENV_LOCAL_FILE="${PROJECT_DIR}/.env.local"

if [[ ! -f "$ENV_FILE" ]] || ! grep -q '^MODULE_FLEET=true' "$ENV_FILE"; then
    echo "MODULE_FLEET n'est pas actif sur ce projet — rien à faire."
    exit 0
fi

if [[ ! -f "$ENV_LOCAL_FILE" ]]; then
    echo "✗ $ENV_LOCAL_FILE introuvable (voir .env.local.example)." >&2
    exit 1
fi

# `|| true` : sous `pipefail`, un grep sans résultat ferait échouer toute la
# pipeline (silencieusement, via `set -e`) — voir rotate_secret_key.sh.
PROJECT_NAME=$(grep -m1 '^PROJECT_NAME=' "$ENV_FILE" | cut -d= -f2- || true)

NEW_REGISTER_TOKEN=$(openssl rand -hex 32)
NEW_COLLECTOR_TOKEN=$(openssl rand -hex 32)

TMP=$(mktemp)
grep -vE '^(FLEET_REGISTER_TOKEN|COLLECTOR_STATS_TOKEN)=' "$ENV_LOCAL_FILE" > "$TMP"
{
    echo "FLEET_REGISTER_TOKEN=${NEW_REGISTER_TOKEN}"
    echo "COLLECTOR_STATS_TOKEN=${NEW_COLLECTOR_TOKEN}"
} >> "$TMP"
mv "$TMP" "$ENV_LOCAL_FILE"

echo "Redémarrage de ${PROJECT_NAME}_backend..."
(cd "$PROJECT_DIR" && docker compose up -d --force-recreate backend)

cat <<EOF

✓ Jetons régénérés pour ${PROJECT_NAME}.

⚠ ACTION REQUISE : FLEET_REGISTER_TOKEN est aussi utilisé par crontab.fleet
  sur cet hôte (fleet-health.sh, backup-fleet.sh, deploy-on-push.sh).
  Mettez à jour la ligne correspondante via \`crontab -e\` :

  FLEET_REGISTER_TOKEN=${NEW_REGISTER_TOKEN}

  Sans cette étape, ces scripts échoueront en 401 au prochain passage cron.
EOF
