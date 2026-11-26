import { useEffect } from "react";
import { apiFetch } from "../../api";

// Mesure d'audience Umami (Chap 13 §« Mesure d'Audience », service partagé de
// la flotte, Chap 18 §8). Le backend renvoie la config dans GET /health
// (clé `umami`, absente tant que l'opérateur n'a pas posé UMAMI_SCRIPT_URL /
// UMAMI_WEBSITE_ID dans .env.local) : rien n'est chargé sans elle, et aucune
// valeur de build n'est nécessaire.
//
// Le script est injecté UNE seule fois. Umami suit lui-même les changements
// de page de la SPA. `data-domains` borne la mesure au vrai domaine du projet
// (jamais le dev local) ; `data-do-not-track` respecte le réglage « Ne pas me
// suivre » du navigateur. Monté dans main.tsx, hors de App.tsx que les
// projets personnalisent.

export const UMAMI_SCRIPT_ID = "gitsky-umami";

type UmamiConfig = { script_url: string; website_id: string; domains: string };

export default function UmamiTracker() {
  useEffect(() => {
    if (document.getElementById(UMAMI_SCRIPT_ID)) return;
    let cancelled = false;
    apiFetch("/health")
      .then(async (r) => (r.ok ? ((await r.json()) as { umami?: UmamiConfig }) : null))
      .then((data) => {
        const umami = data?.umami;
        if (cancelled || !umami || document.getElementById(UMAMI_SCRIPT_ID)) return;
        const script = document.createElement("script");
        script.id = UMAMI_SCRIPT_ID;
        script.defer = true;
        script.src = umami.script_url;
        script.setAttribute("data-website-id", umami.website_id);
        if (umami.domains) script.setAttribute("data-domains", umami.domains);
        script.setAttribute("data-do-not-track", "true");
        document.head.appendChild(script);
      })
      .catch(() => {
        // La mesure d'audience ne doit jamais casser le site.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
