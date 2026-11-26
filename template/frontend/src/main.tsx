import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./i18n";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import UmamiTracker from "./components/analytics/UmamiTracker";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Mesure d'audience (Chap 13) : inerte tant que /health n'a pas de clé umami. */}
        <UmamiTracker />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
