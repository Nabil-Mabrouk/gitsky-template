import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChangePassword from "./ChangePassword";

// Même mock passthrough que AcceptInvite.test.tsx.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const refreshUser = vi.fn().mockResolvedValue(undefined);
let mockUser: { must_change_password: boolean } | null = { must_change_password: true };
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, refreshUser }),
}));

const apiFetch = vi.fn();
vi.mock("../api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ChangePassword", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    apiFetch.mockReset();
    refreshUser.mockClear();
    mockUser = { must_change_password: true };
  });

  it("affiche la bannière de changement forcé quand must_change_password est vrai", () => {
    render(
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>,
    );
    expect(screen.getByText("auth.changePassword.forcedNotice")).toBeInTheDocument();
  });

  it("n'affiche pas la bannière pour un changement volontaire", () => {
    mockUser = { must_change_password: false };
    render(
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>,
    );
    expect(screen.queryByText("auth.changePassword.forcedNotice")).not.toBeInTheDocument();
  });

  it("envoie le mot de passe actuel et le nouveau, puis stocke le token d'accès", async () => {
    apiFetch.mockResolvedValueOnce(jsonResponse({ access_token: "new-tok" }));

    render(
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.current"), "old-pass1");
    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.new"), "new-pass12");
    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.confirm"), "new-pass12");
    await userEvent.click(screen.getByText("auth.changePassword.submit"));

    await waitFor(() => expect(localStorage.getItem("access_token")).toBe("new-tok"));
    expect(refreshUser).toHaveBeenCalled();

    const [path, options] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/auth/change-password");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({
      current_password: "old-pass1",
      new_password: "new-pass12",
    });
  });

  it("affiche une erreur si les nouveaux mots de passe ne correspondent pas", async () => {
    render(
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.current"), "old-pass1");
    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.new"), "new-pass12");
    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.confirm"), "different1");
    await userEvent.click(screen.getByText("auth.changePassword.submit"));

    expect(await screen.findByText("auth.changePassword.mismatch")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("affiche une erreur si le mot de passe actuel est incorrect", async () => {
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

    render(
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.current"), "faux-mdp1");
    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.new"), "new-pass12");
    await userEvent.type(screen.getByPlaceholderText("auth.changePassword.confirm"), "new-pass12");
    await userEvent.click(screen.getByText("auth.changePassword.submit"));

    expect(await screen.findByText("auth.changePassword.error")).toBeInTheDocument();
  });
});
