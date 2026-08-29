import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../api";

// Navbar de la landing (Chap 24) — remplace l'ancien nav embryonnaire
// inline de Landing.tsx (marque + un seul CTA conditionnel). Autonome :
// fait son propre GET /health pour savoir quels liens de site afficher,
// même patron que AdminLayout.tsx (GET /api/admin/modules) plutôt que de
// faire remonter cet état jusqu'à App.tsx. Généré une fois avec ces
// défauts, puis à personnaliser librement (Chap 24, AGENTS.md).
interface NavbarProps {
  project: string;
}

export default function Navbar({ project }: NavbarProps) {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiFetch("/health")
      .then(async (r) =>
        r.ok ? ((await r.json()) as { modules?: Record<string, boolean> }) : null,
      )
      .then((data) => setModules(data?.modules ?? {}))
      .catch(() => setModules({}));
  }, []);

  return (
    <nav className="site-nav">
      <a className="brand" href="/">
        {project}
      </a>
      <div className="site-nav-links">
        {modules.tutorials && <a href="/learn">Apprendre</a>}
        {user?.role === "admin" && <a href="/admin">Admin</a>}
        {user ? (
          <button className="btn" onClick={logout} type="button">
            Se déconnecter
          </button>
        ) : (
          <a className="btn" href="/login">
            Se connecter
          </a>
        )}
      </div>
    </nav>
  );
}
