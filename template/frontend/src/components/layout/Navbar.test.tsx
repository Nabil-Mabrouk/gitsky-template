import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, expect, it, beforeEach } from "vitest";
import Navbar from "./Navbar";

const mockUseAuth = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubHealth(modules: Record<string, boolean>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ modules }))),
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche toujours la marque du projet, liée à la racine", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({});

    render(<Navbar project="pain-scraper" />);

    const brand = screen.getByText("pain-scraper");
    expect(brand).toHaveAttribute("href", "/");
  });

  it("n'affiche « Apprendre » que si le module tutorials est actif", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({ tutorials: false });

    render(<Navbar project="pain-scraper" />);

    await waitFor(() => expect(screen.queryByText("Apprendre")).not.toBeInTheDocument());
  });

  it("affiche « Apprendre » quand le module tutorials est actif", async () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({ tutorials: true });

    render(<Navbar project="pain-scraper" />);

    await waitFor(() => expect(screen.getByText("Apprendre")).toBeInTheDocument());
  });

  it("n'affiche « Admin » que pour un utilisateur avec le rôle admin", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, email: "u@x.com", role: "user" }, logout: vi.fn() });
    stubHealth({});

    render(<Navbar project="pain-scraper" />);

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("affiche « Admin » pour un utilisateur admin", async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, email: "a@x.com", role: "admin" }, logout: vi.fn() });
    stubHealth({});

    render(<Navbar project="pain-scraper" />);

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("affiche Se connecter quand déconnecté, Se déconnecter quand connecté", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    stubHealth({});
    const { rerender } = render(<Navbar project="pain-scraper" />);
    expect(screen.getByText("Se connecter")).toBeInTheDocument();
    expect(screen.queryByText("Se déconnecter")).not.toBeInTheDocument();

    mockUseAuth.mockReturnValue({ user: { id: 1, email: "a@x.com", role: "admin" }, logout: vi.fn() });
    rerender(<Navbar project="pain-scraper" />);
    expect(screen.getByText("Se déconnecter")).toBeInTheDocument();
    expect(screen.queryByText("Se connecter")).not.toBeInTheDocument();
  });
});
