import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";

// Même mock passthrough que AcceptInvite.test.tsx.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const refreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ refreshUser }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderAtToken(token = "reset-tok") {
  return render(
    <MemoryRouter initialEntries={[`/reset-password/${token}`]}>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResetPassword", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    refreshUser.mockClear();
  });

  it("envoie le jeton et le nouveau mot de passe, puis stocke le token d'accès", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: "xyz" }));
    vi.stubGlobal("fetch", fetchMock);

    renderAtToken("reset-tok");

    await userEvent.type(screen.getByPlaceholderText("auth.resetPassword.password"), "longenough1");
    await userEvent.type(screen.getByPlaceholderText("auth.resetPassword.confirm"), "longenough1");
    await userEvent.click(screen.getByText("auth.resetPassword.submit"));

    await waitFor(() => expect(localStorage.getItem("access_token")).toBe("xyz"));
    expect(refreshUser).toHaveBeenCalled();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/reset-password");
    expect(JSON.parse(options.body as string)).toEqual({
      token: "reset-tok",
      password: "longenough1",
    });
  });

  it("affiche une erreur si les mots de passe ne correspondent pas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderAtToken();

    await userEvent.type(screen.getByPlaceholderText("auth.resetPassword.password"), "longenough1");
    await userEvent.type(screen.getByPlaceholderText("auth.resetPassword.confirm"), "different1");
    await userEvent.click(screen.getByText("auth.resetPassword.submit"));

    expect(await screen.findByText("auth.resetPassword.error")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("affiche une erreur générique si le lien est invalide ou expiré", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    renderAtToken();

    await userEvent.type(screen.getByPlaceholderText("auth.resetPassword.password"), "longenough1");
    await userEvent.type(screen.getByPlaceholderText("auth.resetPassword.confirm"), "longenough1");
    await userEvent.click(screen.getByText("auth.resetPassword.submit"));

    expect(await screen.findByText("auth.resetPassword.error")).toBeInTheDocument();
  });
});
