import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcceptInvite from "./AcceptInvite";

// Même mock passthrough que Analytics.test.tsx — voir son commentaire.
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

function renderAtToken(token = "tok123") {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<AcceptInvite />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AcceptInvite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    refreshUser.mockClear();
  });

  it("envoie le jeton et le mot de passe, puis stocke le token d'accès", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: "abc" }));
    vi.stubGlobal("fetch", fetchMock);

    renderAtToken("tok123");

    await userEvent.type(screen.getByPlaceholderText("auth.invite.password"), "longenough1");
    await userEvent.type(screen.getByPlaceholderText("auth.invite.confirm"), "longenough1");
    await userEvent.click(screen.getByText("auth.invite.submit"));

    await waitFor(() => expect(localStorage.getItem("access_token")).toBe("abc"));
    expect(refreshUser).toHaveBeenCalled();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/accept-invite");
    expect(JSON.parse(options.body as string)).toEqual({
      token: "tok123",
      password: "longenough1",
    });
  });

  it("affiche une erreur si les mots de passe ne correspondent pas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderAtToken();

    await userEvent.type(screen.getByPlaceholderText("auth.invite.password"), "longenough1");
    await userEvent.type(screen.getByPlaceholderText("auth.invite.confirm"), "different1");
    await userEvent.click(screen.getByText("auth.invite.submit"));

    expect(await screen.findByText("auth.invite.error")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("affiche une erreur générique si l'invitation est invalide", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    renderAtToken();

    await userEvent.type(screen.getByPlaceholderText("auth.invite.password"), "longenough1");
    await userEvent.type(screen.getByPlaceholderText("auth.invite.confirm"), "longenough1");
    await userEvent.click(screen.getByText("auth.invite.submit"));

    expect(await screen.findByText("auth.invite.error")).toBeInTheDocument();
  });
});
