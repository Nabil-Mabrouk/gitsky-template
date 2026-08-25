import { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./context/AuthContext";
import { apiFetch } from "./api";
import Landing from "./pages/Landing";
import Learn from "./pages/Learn";
import Login from "./pages/Login";
import FleetGrid from "./pages/FleetGrid";
import ProjectActions from "./pages/admin/ProjectActions";
import Leads from "./pages/admin/Leads";
import Maintenance from "./pages/admin/Maintenance";
import Analytics from "./pages/admin/Analytics";
import Security from "./pages/admin/Security";
import Users from "./pages/admin/Users";
import Waitlist from "./pages/admin/Waitlist";
import TutorialDetail from "./pages/TutorialDetail";
import LessonView from "./pages/LessonView";
import AdminRoute from "./pages/admin/AdminRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AcceptInvite from "./pages/AcceptInvite";

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/health")
      .then(async (r) => (r.ok ? ((await r.json()) as { tier?: string }) : null))
      .then((data) => setTier(data?.tier ?? ""))
      .catch(() => setTier(""));
  }, []);

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr");

  // Décision au runtime, pas au build (Chap 24) : /health est public sur tous
  // les tiers et renvoie déjà `tier` — évite de dupliquer le bundle par tier
  // pour ce seul aspect (patron déjà établi par AdminLayout/`/api/admin/modules`).
  if (tier === null) return null;

  // T0 : la racine est une landing marketing autonome (nav + sections propres
  // à Landing.tsx), pas l'app d'apprentissage — aucun chrome au-dessus.
  if (tier === "t0") {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-4 border-b p-4">
        <Link to="/learn" className="font-medium">
          {t("nav.learn")}
        </Link>
        {user?.role === "admin" && (
          <Link to="/admin" className="font-medium">
            {t("admin.nav")}
          </Link>
        )}
        <button onClick={toggleLang} className="text-sm uppercase">
          {i18n.language.slice(0, 2)}
        </button>
        <span className="flex-1" />
        {user ? (
          <button onClick={logout}>{t("nav.logout")}</button>
        ) : (
          <Link to="/login">{t("nav.login")}</Link>
        )}
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/learn" replace />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:slug" element={<TutorialDetail />} />
          <Route path="/learn/:slug/lessons/:lessonId" element={<LessonView />} />
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="fleet" replace />} />
              <Route path="fleet" element={<FleetGrid />} />
              <Route path="fleet/:name" element={<ProjectActions />} />
              <Route path="leads" element={<Leads />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="users" element={<Users />} />
              <Route path="waitlist" element={<Waitlist />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="security" element={<Security />} />
            </Route>
          </Route>
        </Routes>
      </main>
    </div>
  );
}
