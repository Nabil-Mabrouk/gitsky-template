import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// Même mock passthrough que les autres tests (AcceptInvite.test.tsx, etc.).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr", changeLanguage: vi.fn() },
  }),
}));

vi.mock("./context/AuthContext", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubHealth(modules: Record<string, boolean>) {
  // mockImplementation (pas mockResolvedValue) : une Response fraîche à
  // chaque appel — un Body ne se lit qu'une fois (`.json()`). Discrimine par
  // URL : quand la redirection monte <Learn>, son propre fetch (tutorials)
  // attend un tableau, pas l'objet `modules` de /health.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/health")) {
        return Promise.resolve(jsonResponse({ modules }));
      }
      return Promise.resolve(jsonResponse([]));
    }),
  );
}

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App — routage racine selon les modules actifs", () => {
  it("affiche la landing à la racine pour le fleet dashboard (module_fleet actif)", async () => {
    // Bienvenue : hero de dev-fixtures/landing-manifest.json (Chap 24).
    stubHealth({ auth: true, admin: true, fleet: true });

    renderAppAt("/");

    await waitFor(() => expect(screen.getByText("Bienvenue")).toBeInTheDocument());
    expect(screen.queryByText("learn.title")).not.toBeInTheDocument();
  });

  it("redirige toujours vers /learn pour un projet produit sans module_fleet", async () => {
    // Régression : un projet ordinaire (ex. monétisation, onboarding) garde
    // le comportement existant — seul module_fleet change quelque chose ici.
    stubHealth({ auth: true, admin: true, tutorials: true });

    renderAppAt("/");

    await waitFor(() => expect(screen.getByText("learn.title")).toBeInTheDocument());
    expect(screen.queryByText("Bienvenue")).not.toBeInTheDocument();
  });

  it("affiche la landing nue (sans chrome) quand aucun module produit n'est actif", async () => {
    // Régression : un T0 pur (auth core seulement) reste inchangé.
    stubHealth({ auth: true });

    renderAppAt("/");

    await waitFor(() => expect(screen.getByText("Bienvenue")).toBeInTheDocument());
    // Pas de barre de nav (lien /learn) dans ce cas-là.
    expect(screen.queryByText("nav.learn")).not.toBeInTheDocument();
  });
});
