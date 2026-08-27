"""Modèle de publication (Chap 24) — logique PURE.

On barre l'étape IRRÉVERSIBLE (passage en live), jamais la génération.
draft -> preview (toujours sûr, noindex) -> live (gate guardrails + blast
radius). Sous-domaine de la flotte (jetable) : auto-live si guardrails OK.
Domaine dédié : approbation humaine obligatoire (human-in-the-loop) — le
blast radius d'un domaine dédié (souvent une campagne payante, un budget
engagé) justifie la revue qu'un sous-domaine jetable n'a pas besoin d'exiger.
"""

from enum import Enum

# Suffixe du domaine wildcard partagé de la flotte (Chap 1) — un projet sur ce
# suffixe n'a pas encore de domaine dédié, donc rien d'irréversible à protéger
# au-delà de ce que les guardrails couvrent déjà. Défaut de repli UNIQUEMENT :
# un déploiement réel configure app.core.config.Settings.fleet_subdomain_suffix
# (env FLEET_SUBDOMAIN_SUFFIX) sur son propre domaine — ce module reste PUR
# (aucun accès à `settings` ici), donc l'appelant (router.py) doit passer la
# valeur réelle via le paramètre `subdomain_suffix` de evaluate_promotion.
FLEET_SUBDOMAIN_SUFFIX = ".mystudio.com"


class PublishState(str, Enum):
    draft = "draft"
    preview = "preview"
    live = "live"


def evaluate_promotion(
    current: str,
    domain: str,
    guardrails_pass: bool,
    human_approved: bool = False,
    subdomain_suffix: str = FLEET_SUBDOMAIN_SUFFIX,
) -> dict:
    """Renvoie {allowed, target, reason} sans muter d'état.

    `subdomain_suffix` : le suffixe RÉEL du déploiement (settings, pas la
    constante de ce module) — l'appelant production doit le passer
    explicitement, faute de quoi tout domaine est jugé "dédié" (jamais
    auto-live) sur un déploiement dont le suffixe diffère de ".mystudio.com".
    """
    if current == PublishState.draft.value:
        return {
            "allowed": True,
            "target": PublishState.preview.value,
            "reason": "preview noindex, sans risque",
        }

    if current == PublishState.preview.value:
        if not guardrails_pass:
            return {
                "allowed": False,
                "target": PublishState.preview.value,
                "reason": "guardrails en échec — passage en live bloqué",
            }
        # Étape irréversible : gate par blast radius.
        on_fleet_subdomain = domain.endswith(subdomain_suffix)
        if on_fleet_subdomain or human_approved:
            return {
                "allowed": True,
                "target": PublishState.live.value,
                "reason": (
                    "auto (sous-domaine de la flotte, guardrailé)"
                    if on_fleet_subdomain
                    else "approuvé humainement"
                ),
            }
        return {
            "allowed": False,
            "target": PublishState.preview.value,
            "reason": "revue humaine requise (blast radius domaine dédié)",
        }

    return {
        "allowed": False,
        "target": PublishState.live.value,
        "reason": "déjà en live",
    }
