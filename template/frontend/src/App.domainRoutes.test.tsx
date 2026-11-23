import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// Point d'extension des pages métier (domain/routes.tsx, project-owned) :
// avant lui, chaque projet éditait App.tsx (châssis) à la main.
vi.mock("./domain/routes", async () => {
  const { Route } = await import("react-router-dom");
  return {
    domainRoutes: (
      <>
        <Route path="bots" element={<p>page bots</p>} />
        <Route path="terminal" element={<p>page terminal</p>} />
      </>
    ),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr", changeLanguage: vi.fn() },
  }),
}));

// Landing mockée : son contenu (titre, blocs) est personnalisable par chaque
// projet — le test vérifie le routage vers elle, pas son texte (bug réel :
// ce test échouait sur f-ynd, dont la landing et la barre de navigation sont
// entièrement redessinées, comme le permet AGENTS.md).
vi.mock("./pages/Landing", () => ({ default: () => <p>landing du projet</p> }));

const auth = vi.hoisted(() => ({ user: null as null | { must_change_password: boolean } }));
vi.mock("./context/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false, logout: vi.fn() }),
}));

function stubHealth() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ project: "zero-hl", modules: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App — routes métier (domain/routes.tsx)", () => {
  it("rend une route métier dans le shell du site, avec Navbar et Footer", async () => {
    auth.user = null;
    stubHealth();
    const { container } = renderAppAt("/bots");
    expect(await screen.findByText("page bots")).toBeInTheDocument();
    // Structure du shell, pas le texte de Navbar/Footer (fichiers « À vous »,
    // redessinables par chaque projet).
    expect(container.querySelector("nav, header")).not.toBeNull();
    expect(container.querySelector("footer")).not.toBeNull();
  });

  it("rend plusieurs routes déclarées dans un fragment", async () => {
    auth.user = null;
    stubHealth();
    renderAppAt("/terminal");
    expect(await screen.findByText("page terminal")).toBeInTheDocument();
  });

  it("applique la redirection « mot de passe à changer » aux routes métier", async () => {
    auth.user = { must_change_password: true };
    stubHealth();
    renderAppAt("/terminal");
    await waitFor(() => expect(screen.queryByText("page terminal")).toBeNull());
    expect(await screen.findByText("auth.changePassword.title")).toBeInTheDocument();
  });

  it("la landing reste à la racine", async () => {
    auth.user = null;
    stubHealth();
    renderAppAt("/");
    expect(await screen.findByText("landing du projet")).toBeInTheDocument();
    expect(screen.queryByText("page bots")).toBeNull();
    expect(screen.queryByText("page terminal")).toBeNull();
  });
});
