import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Learn from "./pages/Learn";
import Login from "./pages/Login";
import FleetGrid from "./pages/FleetGrid";
import Activity from "./pages/admin/Activity";
import CreateProject from "./pages/admin/CreateProject";
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

// La racine est TOUJOURS la landing (Chap 24, round layout) — plus de
// dépendance aux modules actifs pour cette décision (l'ancien
// `hasProductModules` faisait disparaître la landing dès qu'un module au-
// delà de `auth` était actif, y compris pour fleet-dashboard lui-même).
// Le reste de l'app (catalogue, admin, login) vit sous un second groupe de
// routes descendant (`path="/*"`) qui coexiste avec `/` au lieu de le
// remplacer — patron "Descendant <Routes>" de React Router v6 : les chemins
// ci-dessous sont relatifs à ce préfixe, pas absolus.
function AppShell() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  const toggleLang = () =>
    i18n.changeLanguage(i18n.language.startsWith("fr") ? "en" : "fr");

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
          <Route path="learn" element={<Learn />} />
          <Route path="learn/:slug" element={<TutorialDetail />} />
          <Route path="learn/:slug/lessons/:lessonId" element={<LessonView />} />
          <Route path="login" element={<Login />} />
          <Route path="invite/:token" element={<AcceptInvite />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="fleet" replace />} />
              <Route path="fleet" element={<FleetGrid />} />
              <Route path="fleet/new" element={<CreateProject />} />
              <Route path="fleet/:name" element={<ProjectActions />} />
              <Route path="activity" element={<Activity />} />
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
