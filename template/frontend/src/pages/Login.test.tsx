import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const login = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    login.mockReset();
    navigate.mockClear();
  });

  it("se connecte et redirige vers /learn", async () => {
    login.mockResolvedValueOnce(true);
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("auth.login.email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("auth.login.password"), "secret123");
    await userEvent.click(screen.getByText("auth.login.submit"));

    expect(login).toHaveBeenCalledWith("alice@example.com", "secret123");
    expect(navigate).toHaveBeenCalledWith("/learn");
  });

  it("affiche une erreur applicative si les identifiants sont invalides", async () => {
    login.mockResolvedValueOnce(false);
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("auth.login.email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("auth.login.password"), "wrong");
    await userEvent.click(screen.getByText("auth.login.submit"));

    expect(await screen.findByText("auth.login.error")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("affiche un message distinct si le service est inaccessible (erreur réseau)", async () => {
    // Bug réel trouvé par l'agent dev de f-ynd (2026-11-07) sur les pages
    // voisines : ce Login.tsx du chassis avait exactement le même trou
    // (aucun try/catch autour de login()).
    login.mockRejectedValueOnce(new TypeError("network error"));
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("auth.login.email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("auth.login.password"), "secret123");
    await userEvent.click(screen.getByText("auth.login.submit"));

    expect(await screen.findByText("auth.login.unavailable")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("empêche un double submit pendant que la requête est en vol", async () => {
    let resolveLogin!: (value: boolean) => void;
    login.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText("auth.login.email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("auth.login.password"), "secret123");
    const submit = screen.getByText("auth.login.submit");
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(login).toHaveBeenCalledTimes(1);
    resolveLogin(true);
  });
});
