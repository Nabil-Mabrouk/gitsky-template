#!/usr/bin/env bash
# =============================================================================
# scripts/toggle_module.sh — Active ou désactive un module après coup.
# (Chap 2/17, round outillage)
#
# Usage : ./scripts/toggle_module.sh <module> <on|off>
#   <module> : clé courte du catalogue (admin, analytics, onboarding,
#              tutorials, security_middleware, i18n, agentic,
#              monetization_shop, monetization_subscription).
#              PAS "fleet" — voir plus bas.
#
# Fait, dans l'ordre : (1) vérifie que le module existe et n'est pas déjà
# dans l'état demandé, (2) bascule le flag dans .env, (3) bascule la MÊME
# clé dans .copier-answers.yml — bug de prod réel, corrigé le jour même où
# trouvé : sans cette étape, un `copier update` ultérieur re-rend .env.jinja
# depuis la réponse `modules:` STOCKÉE (jamais depuis le contenu actuel de
# .env) et écrase silencieusement le flag tout juste basculé, (4) applique
# les migrations en attente (`docker compose run --rm migrate` — idempotent,
# migrate.py ne fait que ce qui manque pour les modules réellement actifs,
# Chap 4), (5) recrée le backend (pas de rebuild : pur changement d'env),
# (6) vérifie via /health que le nouvel état est bien pris en compte avant
# de déclarer la réussite.
# =============================================================================

set -euo pipefail

MODULE="${1:?Usage: toggle_module.sh <module> <on|off>}"
STATE="${2:?Usage: toggle_module.sh <module> <on|off>}"

# module_fleet a des effets réels sur docker-compose.yml (montages hôte
# GITSKY_GENERATOR_PATH/GITSKY_MONOREPO_GITDIR/PROJECTS_DIR, Chap 27) qu'un
# simple changement de .env ne peut pas ajouter — seul `copier update` avec
# modules: {fleet: true} régénère le compose correctement.
if [[ "$MODULE" == "fleet" ]]; then
    echo "✗ module_fleet ne se bascule pas ainsi : docker-compose.yml a besoin" >&2
    echo "  de montages hôte dédiés qu'un simple changement de .env ne peut pas" >&2
    echo "  ajouter (Chap 27). Utilisez copier update avec modules: {fleet: true}." >&2
    exit 1
fi

if [[ "$STATE" != "on" && "$STATE" != "off" ]]; then
    echo "✗ État invalide « ${STATE} » — attendu : on ou off." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
FLAG_NAME="MODULE_$(echo "$MODULE" | tr '[:lower:]' '[:upper:]')"

if ! grep -q "^${FLAG_NAME}=" "$ENV_FILE"; then
    CATALOGUE=$(grep -oE '^MODULE_[A-Z_]+' "$ENV_FILE" | sed 's/^MODULE_//' | tr '[:upper:]' '[:lower:]' | tr '\n' ' ')
    echo "✗ Module inconnu « ${MODULE} » (${FLAG_NAME} absent de .env)." >&2
    echo "  Catalogue : ${CATALOGUE}" >&2
    exit 1
fi

NEW_VALUE="false"
[[ "$STATE" == "on" ]] && NEW_VALUE="true"
CURRENT=$(grep "^${FLAG_NAME}=" "$ENV_FILE" | cut -d= -f2)

if [[ "$CURRENT" == "$NEW_VALUE" ]]; then
    echo "${FLAG_NAME} est déjà à ${NEW_VALUE} — rien à faire."
    exit 0
fi

sed -i "s/^${FLAG_NAME}=.*/${FLAG_NAME}=${NEW_VALUE}/" "$ENV_FILE"
echo "${FLAG_NAME}=${NEW_VALUE} écrit dans .env."

# Sans ceci, un `copier update` ultérieur re-rend .env.jinja depuis la
# réponse `modules:` stockée ici — jamais depuis .env — et reviendrait
# silencieusement sur ce changement au prochain update.
ANSWERS_FILE="${PROJECT_DIR}/.copier-answers.yml"
python3 - "$ANSWERS_FILE" "$MODULE" "$NEW_VALUE" <<'PY'
import re
import sys

path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(path, encoding="utf-8").read()
m = re.search(r"^modules:\s*\{([^}]*)\}", content, re.MULTILINE)
pairs = {}
if m and m.group(1).strip():
    for part in m.group(1).split(","):
        k, v = part.split(":")
        pairs[k.strip()] = v.strip()
pairs[key] = value
new_line = "modules: {" + ", ".join(f"{k}: {v}" for k, v in pairs.items()) + "}"
if m:
    content = content[: m.start()] + new_line + content[m.end() :]
else:
    content = f"modules: {{{key}: {value}}}\n" + content
open(path, "w", encoding="utf-8").write(content)
PY
echo "modules.${MODULE}=${NEW_VALUE} écrit dans .copier-answers.yml."

echo "Application des migrations en attente..."
(cd "$PROJECT_DIR" && docker compose run --rm migrate)

echo "Redémarrage du backend..."
(cd "$PROJECT_DIR" && docker compose up -d --force-recreate backend)

# `|| true` : sous pipefail, un grep sans résultat ferait échouer toute la
# pipeline avant le message d'erreur clair (même piège que rotate_*.sh).
PROJECT_NAME=$(grep -m1 '^PROJECT_NAME=' "$ENV_FILE" | cut -d= -f2- || true)
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-6}"
HEALTH_CHECK_DELAY="${HEALTH_CHECK_DELAY:-5}"

for _ in $(seq 1 "$HEALTH_CHECK_RETRIES"); do
    ACTUAL=$(docker exec "${PROJECT_NAME}_backend" python -c "
import json, urllib.request
try:
    modules = json.loads(urllib.request.urlopen('http://localhost:8000/health', timeout=4).read())['modules']
    print('on' if modules.get('${MODULE}') else 'off')
except Exception:
    print('')
" 2>/dev/null || true)
    if [[ "$ACTUAL" == "$STATE" ]]; then
        echo "✓ ${MODULE} = ${STATE} confirmé via /health."
        exit 0
    fi
    sleep "$HEALTH_CHECK_DELAY"
done

echo "✗ ${FLAG_NAME} écrit mais /health ne le reflète pas encore — vérifier manuellement." >&2
exit 1
