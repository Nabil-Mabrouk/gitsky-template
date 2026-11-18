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
    await waitFor(() => expect(screen.getByText("zero-hl")).toBeInTheDocument());
    expect(container.querySelector(".site-nav")).not.toBeNull();
    expect(container.querySelector(".site-footer")).not.toBeNull();
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
    expect(await screen.findByText("Bienvenue")).toBeInTheDocument();
  });
});
