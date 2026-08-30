import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, expect, it, beforeEach } from "vitest";
import Navbar from "./Navbar";

const mockUseAuth = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Passthrough i18n : les mêmes clés que celles réutilisées par Navbar
// (nav.learn, admin.nav, nav.login, nav.logout, déjà existantes dans les
// locales — pas de nouvelle clé ajoutée par ce composant).
const changeLanguage = vi.fn();
let currentLanguage = "fr";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: currentLanguage, changeLanguage },
  }),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubHealth(modules: Record<string, boolean>, project = "pain-scraper") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ project, modules }))),
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    currentLanguage = "fr";
  });

  it("affiche toujours la marque du projet (lue via /health), liée à la racine", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({}, "pain-scraper");

    render(<Navbar />);

    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("pain-scraper")).toHaveAttribute("href", "/");
  });

  it("n'affiche « Apprendre » que si le module tutorials est actif", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({ tutorials: false });

    render(<Navbar />);

    await waitFor(() => expect(screen.queryByText("nav.learn")).not.toBeInTheDocument());
  });

  it("affiche « Apprendre » quand le module tutorials est actif", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({ tutorials: true });

    render(<Navbar />);

    await waitFor(() => expect(screen.getByText("nav.learn")).toBeInTheDocument());
  });

  it("n'affiche « Admin » que pour un utilisateur avec le rôle admin", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, email: "u@x.com", role: "user" }, logout: vi.fn() });
    stubHealth({});

    render(<Navbar />);

    expect(screen.queryByText("admin.nav")).not.toBeInTheDocument();
  });

  it("affiche « Admin » pour un utilisateur admin", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, email: "a@x.com", role: "admin" }, logout: vi.fn() });
    stubHealth({});

    render(<Navbar />);

    expect(screen.getByText("admin.nav")).toBeInTheDocument();
  });

  it("affiche nav.login quand déconnecté, nav.logout quand connecté", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({});
    const { rerender } = render(<Navbar />);
    expect(screen.getByText("nav.login")).toBeInTheDocument();
    expect(screen.queryByText("nav.logout")).not.toBeInTheDocument();

    mockUseAuth.mockReturnValue({ user: { id: 1, email: "a@x.com", role: "admin" }, logout: vi.fn() });
    rerender(<Navbar />);
    expect(screen.getByText("nav.logout")).toBeInTheDocument();
    expect(screen.queryByText("nav.login")).not.toBeInTheDocument();
  });

  it("n'affiche le bouton de langue que si le module i18n est actif", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({ i18n: false });

    render(<Navbar />);

    await waitFor(() => expect(screen.queryByText("fr")).not.toBeInTheDocument());
  });

  it("affiche le bouton de langue quand le module i18n est actif", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({ i18n: true });

    render(<Navbar />);

    await waitFor(() => expect(screen.getByText("fr")).toBeInTheDocument());
  });
});
