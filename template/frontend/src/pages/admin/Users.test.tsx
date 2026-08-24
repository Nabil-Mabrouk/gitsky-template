import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Users from "./Users";

// Même mock passthrough que Analytics.test.tsx — voir son commentaire.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Users", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche la liste des utilisateurs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 1, email: "a@example.com", role: "user", is_active: true },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<Users />);

    await waitFor(() => expect(screen.getByText("a@example.com")).toBeInTheDocument());
  });

  it("envoie un PATCH quand le rôle change", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 1, email: "a@example.com", role: "user", is_active: true },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 1, email: "a@example.com", role: "admin", is_active: true }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<Users />);
    await waitFor(() => expect(screen.getByText("a@example.com")).toBeInTheDocument());

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "admin");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/admin/users/1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ role: "admin" });
  });

  it("suspend un utilisateur actif", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 1, email: "a@example.com", role: "user", is_active: true },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 1, email: "a@example.com", role: "user", is_active: false }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<Users />);
    await waitFor(() => expect(screen.getByText("admin.users.suspend")).toBeInTheDocument());

    await userEvent.click(screen.getByText("admin.users.suspend"));

    await waitFor(() => expect(screen.getByText("admin.users.suspended")).toBeInTheDocument());
  });
});
