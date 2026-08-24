import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Waitlist from "./Waitlist";

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

describe("Waitlist", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche les comptes en attente et invite au clic", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 1, email: "a@example.com" }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Waitlist />);
    await waitFor(() => expect(screen.getByText("a@example.com")).toBeInTheDocument());

    expect(fetchMock.mock.calls[0][0]).toContain("role=waitlist");

    await userEvent.click(screen.getByText("admin.waitlist.invite"));

    await waitFor(() => expect(screen.getByText("admin.waitlist.sent")).toBeInTheDocument());
    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/admin/users/1/invite");
    expect(options.method).toBe("POST");
  });

  it("affiche un message si la liste est vide", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<Waitlist />);

    await waitFor(() => expect(screen.getByText("admin.waitlist.empty")).toBeInTheDocument());
  });
});
