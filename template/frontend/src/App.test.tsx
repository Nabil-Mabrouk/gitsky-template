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

function stubHealth(modules: Record<string, boolean> = {}, project = "pain-scraper") {
  // mockImplementation (pas mockResolvedValue) : une Response fraîche à
  // chaque appel — un Body ne se lit qu'une fois (`.json()`). Discrimine par
  // URL : Learn.tsx fait son propre fetch (tutorials) qui attend un
  // tableau, pas l'objet `modules`/`project` de /health.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/health")) {
        return Promise.resolve(jsonResponse({ project, modules }));
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

describe("App — la racine est toujours la landing (Chap 24, round layout)", () => {
  // Bienvenue : hero de dev-fixtures/landing-manifest.json.

  it("affiche la landing à la racine sans aucun module actif", async () => {
    stubHealth({ auth: true });
    renderAppAt("/");
    await waitFor(() => expect(screen.getByText("Bienvenue")).toBeInTheDocument());
  });

  it("affiche TOUJOURS la landing à la racine même avec des modules produit actifs", async () => {
    // Avant ce round : activer un module (ex. admin) faisait disparaître la
    // landing (redirection vers /learn) — exactement le bug rapporté par
    // l'utilisateur sur politique-ia après activation de MODULE_ADMIN.
    stubHealth({ auth: true, admin: true, tutorials: true });
    renderAppAt("/");
    await waitFor(() => expect(screen.getByText("Bienvenue")).toBeInTheDocument());
    expect(screen.queryByText("learn.title")).not.toBeInTheDocument();
  });

  it("affiche TOUJOURS la landing à la racine pour le fleet dashboard (module_fleet actif)", async () => {
    stubHealth({ auth: true, admin: true, fleet: true });
    renderAppAt("/");
    await waitFor(() => expect(screen.getByText("Bienvenue")).toBeInTheDocument());
  });

  it("reste joignable sur /learn en URL directe", async () => {
    stubHealth({ auth: true, tutorials: true });
    renderAppAt("/learn");
    await waitFor(() => expect(screen.getByText("learn.title")).toBeInTheDocument());
    expect(screen.queryByText("Bienvenue")).not.toBeInTheDocument();
  });

  it("reste joignable sur /login en URL directe", async () => {
    stubHealth({ auth: true });
    renderAppAt("/login");
    await waitFor(() => expect(screen.getByText("auth.login.title")).toBeInTheDocument());
    expect(screen.queryByText("Bienvenue")).not.toBeInTheDocument();
  });

  it("affiche le Navbar/Footer partagés même hors de la landing (round theming)", async () => {
    // Avant ce round : AppShell avait sa propre nav Tailwind brute, sans
    // marque, jamais de Navbar/Footer/landing.css — une personnalisation
    // de la landing ne se voyait nulle part ailleurs (Login/Learn/Admin).
    stubHealth({ auth: true }, "pain-scraper");
    renderAppAt("/login");
    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`© \\d{4} pain-scraper`))).toBeInTheDocument(),
    );
  });
});
