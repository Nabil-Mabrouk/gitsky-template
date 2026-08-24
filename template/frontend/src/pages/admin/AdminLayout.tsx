import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

interface Tab {
  key: string;
  labelKey: string;
  path: string;
  moduleFlag: string;
}

// Boutique reste hors périmètre : ni page ni backend n'existent encore pour
// lui. Ajouter un onglet plus tard = une entrée ici + sa route dans App.tsx,
// rien d'autre à changer — la découverte des modules actifs est déjà
// générique (GET /api/admin/modules).
// moduleFlag "security_middleware" (pas "security") : GET /api/admin/modules
// reflète les clés MODULE_FLAGS sans le préfixe "module_".
// users/waitlist : onglets SHELL (Chap 9) — toujours présents dès que le
// dashboard admin existe, pas liés à un module optionnel plus précis. D'où
// moduleFlag "admin" (le shell lui-même) plutôt qu'un flag dédié qui
// n'existe pas — GET /api/admin/modules n'est de toute façon joignable QUE
// si module_admin, donc la clé "admin" y est forcément présente et vraie.
const TABS: Tab[] = [
  { key: "fleet", labelKey: "admin.tabs.fleet", path: "/admin/fleet", moduleFlag: "fleet" },
  { key: "users", labelKey: "admin.tabs.users", path: "/admin/users", moduleFlag: "admin" },
  { key: "waitlist", labelKey: "admin.tabs.waitlist", path: "/admin/waitlist", moduleFlag: "admin" },
  { key: "analytics", labelKey: "admin.tabs.analytics", path: "/admin/analytics", moduleFlag: "analytics" },
  { key: "security", labelKey: "admin.tabs.security", path: "/admin/security", moduleFlag: "security_middleware" },
  { key: "tutorials", labelKey: "admin.tabs.tutorials", path: "/learn", moduleFlag: "tutorials" },
];

export default function AdminLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [modules, setModules] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/modules").then(async (r) => {
      if (r.ok) setModules((await r.json()) as Record<string, boolean>);
    });
  }, []);

  const visibleTabs = TABS.filter((tab) => modules?.[tab.moduleFlag]);

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r p-4">
        <nav className="grid gap-1">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.key}
              to={tab.path}
              className={`rounded p-2 hover:bg-black/5 ${
                location.pathname.startsWith(tab.path) ? "font-semibold" : ""
              }`}
            >
              {t(tab.labelKey)}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
