import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";

// Même mock passthrough que AcceptInvite.test.tsx.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("envoie l'email et affiche le même message de succès", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    await userEvent.type(
      screen.getByPlaceholderText("auth.forgotPassword.email"),
      "alice@example.com",
    );
    await userEvent.click(screen.getByText("auth.forgotPassword.submit"));

    expect(await screen.findByText("auth.forgotPassword.sent")).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/forgot-password");
    expect(JSON.parse(options.body as string)).toEqual({ email: "alice@example.com" });
  });

  it("affiche le même message de succès même si l'email n'existe pas (pas de fuite)", async () => {
    // 202 est renvoyé dans les deux cas côté backend — le frontend ne
    // distingue jamais les deux issues, c'est ce que ce test vérifie.
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    await userEvent.type(
      screen.getByPlaceholderText("auth.forgotPassword.email"),
      "inconnu@example.com",
    );
    await userEvent.click(screen.getByText("auth.forgotPassword.submit"));

    await waitFor(() =>
      expect(screen.getByText("auth.forgotPassword.sent")).toBeInTheDocument(),
    );
  });
});
