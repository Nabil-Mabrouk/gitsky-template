import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../api";

// Navbar partagée par la landing ET le reste de l'app (Chap 24, round
// theming) — remplace l'ancien nav embryonnaire inline de Landing.tsx
// (marque + un seul CTA conditionnel) ET le nav Tailwind brut, sans
// marque, autrefois codé en dur dans App.tsx::AppShell. Autonome : un
// seul GET /health fournit `project` (nom du projet) ET `modules` (quels
// liens afficher), même patron que AdminLayout.tsx (GET /api/admin/
// modules) plutôt que de faire remonter cet état jusqu'à App.tsx. Généré
// une fois avec ces défauts, puis à personnaliser librement (AGENTS.md).
export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [project, setProject] = useState("");
  const [modules, setModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiFetch("/health")
      .then(async (r) =>
        r.ok
          ? ((await r.json()) as { project?: string; modules?: Record<string, boolean> })
          : null,
      )
      .then((data) => {
        setProject(data?.project ?? "");
        setModules(data?.modules ?? {});
      })
      .catch(() => setModules({}));
  }, []);

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr");

  return (
    <nav className="site-nav">
      <a className="brand" href="/">
        {project}
      </a>
      <div className="site-nav-links">
        {modules.tutorials && <a href="/learn">{t("nav.learn")}</a>}
        {user?.role === "admin" && <a href="/admin">{t("admin.nav")}</a>}
        {modules.i18n && (
          <button className="text-sm uppercase" onClick={toggleLang} type="button">
            {i18n.language.slice(0, 2)}
          </button>
        )}
        {user ? (
          <button className="btn" onClick={logout} type="button">
            {t("nav.logout")}
          </button>
        ) : (
          <a className="btn" href="/login">
            {t("nav.login")}
          </a>
        )}
      </div>
    </nav>
  );
}
