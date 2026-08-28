#!/usr/bin/env bash
# =============================================================================
# scripts/rotate_secret_key.sh — Fait tourner SECRET_KEY (Chap 23 §2.2).
#
# Usage : ./scripts/rotate_secret_key.sh
#
# Événement "tout le monde se reconnecte" : aucune période de grâce à double
# clé — le livre n'en esquisse le principe qu'en pseudo-code, jamais
# implémenté, et en construire une maintenant serait disproportionné à
# l'échelle actuelle (Chap 23). La signature change immédiatement : tous les
# tokens JWT (access ET refresh) émis avant la rotation deviennent invalides
# au prochain appel.
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
if [[ -z "$PROJECT_NAME" ]]; then
    echo "✗ PROJECT_NAME absent de $ENV_FILE." >&2
    exit 1
fi

# 64 octets hex (128 caractères) : même longueur/entropie que le sha512 de
# copier.yml (Chap 17), sans dépendance à un binaire Python présent sur
# l'hôte — openssl est quasi-universel sur un serveur Linux.
NEW_KEY=$(openssl rand -hex 64)

TMP=$(mktemp)
grep -v '^SECRET_KEY=' "$ENV_FILE" > "$TMP"
echo "SECRET_KEY=${NEW_KEY}" >> "$TMP"
mv "$TMP" "$ENV_FILE"

echo "SECRET_KEY régénérée pour ${PROJECT_NAME}."
echo "Redémarrage de ${PROJECT_NAME}_backend..."
(cd "$PROJECT_DIR" && docker compose up -d --force-recreate backend)

echo ""
echo "⚠ Tous les tokens JWT (access + refresh) émis avant maintenant sont"
echo "  désormais invalides. Chaque utilisateur devra se reconnecter."
