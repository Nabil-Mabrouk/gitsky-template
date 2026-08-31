#!/usr/bin/env bash
# =============================================================================
# scripts/toggle_module.sh — Active ou désactive un module après coup.
# (Chap 2/17, round outillage)
#
# Usage : ./scripts/toggle_module.sh <module> <on|off>
#   <module> : clé courte du catalogue (admin, analytics, onboarding,
#              tutorials, security_middleware, i18n, agentic,
#              monetization_shop, monetization_subscription).
#              PAS "fleet", "worker" ni "leads" — voir plus bas.
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

# module_fleet, module_worker et module_leads ont tous des effets STRUCTURELS
# sur docker-compose.yml (montages hôte pour fleet, Chap 27 ; un service
# entier `worker:` pour worker, Chap X ; rejoindre shared-services-net pour
# leads, Chap X) qu'un simple changement de .env ne peut pas produire — seul
# `copier update` régénère le compose. Contrairement aux autres modules,
# basculer juste .env laisserait le service/réseau absent (activation) ou
# actif pour rien, orphelin de tout flag (désactivation).
if [[ "$MODULE" == "fleet" || "$MODULE" == "worker" || "$MODULE" == "leads" ]]; then
    echo "✗ module_${MODULE} ne se bascule pas ainsi : docker-compose.yml a besoin" >&2
    echo "  d'un changement structurel qu'un simple .env ne peut pas produire." >&2
    echo "  Utilisez copier update avec modules: {${MODULE}: true|false}, puis" >&2
    echo "  'docker compose up -d --build' pour faire apparaître/disparaître le" >&2
    echo "  service correspondant." >&2
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
#
# `modules:` peut être en style flow sur une ligne (`modules: {admin: true}`,
# ce que copier écrit à la création) OU en style bloc sur plusieurs lignes
# indentées (`modules:\n    admin: true`, ce que copier réécrit lui-même à
# un `copier update` ultérieur — constaté empiriquement sur politique-ia,
# pas documenté). Les deux formes DOIVENT être comprises en lecture, sous
# peine de dupliquer la clé `modules:` au lieu de la mettre à jour. Toujours
# réécrit en style flow (plus simple à reparser la prochaine fois) —
# `copier update` peut le reformater en bloc ensuite, sans conséquence : ce
# script sait relire les deux.
ANSWERS_FILE="${PROJECT_DIR}/.copier-answers.yml"
python3 - "$ANSWERS_FILE" "$MODULE" "$NEW_VALUE" <<'PY'
import re
import sys

path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding="utf-8").read().splitlines(keepends=True)

start = end = None
pairs = {}
for i, line in enumerate(lines):
    if not line.startswith("modules:"):
        continue
    start = i
    rest = line[len("modules:"):].strip()
    if rest.startswith("{"):
        inner = rest.strip("{}").strip()
        if inner:
            for part in inner.split(","):
                k, v = part.split(":")
                pairs[k.strip()] = v.strip()
        end = i + 1
    else:
        end = i + 1
        while end < len(lines):
            m = re.match(r"^\s+([A-Za-z0-9_]+):\s*(\S+)\s*$", lines[end])
            if not m:
                break
            pairs[m.group(1)] = m.group(2)
            end += 1
    break

pairs[key] = value
new_line = "modules: {" + ", ".join(f"{k}: {v}" for k, v in pairs.items()) + "}\n"

if start is not None:
    lines[start:end] = [new_line]
else:
    lines.insert(0, new_line)
open(path, "w", encoding="utf-8").write("".join(lines))
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
