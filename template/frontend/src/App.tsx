import type { ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Landing from "./pages/Landing";
import Learn from "./pages/Learn";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import { useAuth } from "./context/AuthContext";
import FleetGrid from "./pages/FleetGrid";
import Activity from "./pages/admin/Activity";
import CreateProject from "./pages/admin/CreateProject";
import ProjectActions from "./pages/admin/ProjectActions";
import Leads from "./pages/admin/Leads";
import ProjectLeads from "./pages/admin/ProjectLeads";
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
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";

// La racine est TOUJOURS la landing (Chap 24, round layout) — plus de
// dépendance aux modules actifs pour cette décision (l'ancien
// `hasProductModules` faisait disparaître la landing dès qu'un module au-
// delà de `auth` était actif, y compris pour fleet-dashboard lui-même).
// Le reste de l'app (catalogue, admin, login) vit sous un second groupe de
// routes descendant (`path="/*"`) qui coexiste avec `/` au lieu de le
// remplacer — patron "Descendant <Routes>" de React Router v6 : les chemins
// ci-dessous sont relatifs à ce préfixe, pas absolus.
//
// AppShell réutilise Navbar/Footer (Chap 24, round theming) — avant, cette
// nav était codée en dur ici, Tailwind brut, sans marque, sans partager
// landing.css : une personnalisation de la landing ne se voyait nulle part
// ailleurs (Login/Learn/Admin). L'intérieur d'Admin (admin-theme.css) reste
// délibérément neutre — .admin-shell pose son propre fond opaque par-dessus
// .site-shell, seule la barre du haut change.
// Redirige tout compte dont must_change_password est vrai (Chap 7bis) vers
// l'écran de changement forcé, quelle que soit la route visée — sauf si
// c'est déjà cette route (boucle sinon). UX seulement : chaque endpoint
// protégé reste vérifié côté serveur (même garde-fou que AdminRoute).
function PasswordGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (user?.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

function AppShell() {
  return (
    <div className="site-shell">
      <Navbar />
      <main className="p-6">
        <PasswordGate>
          <Routes>
            <Route path="learn" element={<Learn />} />
            <Route path="learn/:slug" element={<TutorialDetail />} />
            <Route path="learn/:slug/lessons/:lessonId" element={<LessonView />} />
            <Route path="login" element={<Login />} />
            <Route path="invite/:token" element={<AcceptInvite />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password/:token" element={<ResetPassword />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="fleet" replace />} />
                <Route path="fleet" element={<FleetGrid />} />
                <Route path="fleet/new" element={<CreateProject />} />
                <Route path="fleet/:name" element={<ProjectActions />} />
                <Route path="activity" element={<Activity />} />
                <Route path="leads" element={<Leads />} />
                <Route path="project-leads" element={<ProjectLeads />} />
                <Route path="maintenance" element={<Maintenance />} />
                <Route path="users" element={<Users />} />
                <Route path="waitlist" element={<Waitlist />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="security" element={<Security />} />
              </Route>
            </Route>
          </Routes>
        </PasswordGate>
      </main>
      <Footer />
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
