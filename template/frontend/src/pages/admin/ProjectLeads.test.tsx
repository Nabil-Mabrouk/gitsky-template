import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectLeads from "./ProjectLeads";

// Même mock passthrough que Leads.test.tsx.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProjectLeads", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche les leads de CE projet via /api/leads (pas /api/fleet/...)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          id: 1,
          email: "a@b.com",
          source: "reddit",
          created_at: "2026-08-01T00:00:00Z",
          verified: true,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectLeads />);

    await waitFor(() => expect(screen.getByText("a@b.com")).toBeInTheDocument());
    expect(screen.getByText("reddit")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/leads");
    expect(url).not.toContain("/api/fleet/");
  });

  it("affiche un message si aucun lead n'existe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse([])));

    render(<ProjectLeads />);

    await waitFor(() =>
      expect(screen.getByText("admin.projectLeads.empty")).toBeInTheDocument(),
    );
  });

  it("convertit un lead en compte via POST /api/leads/convert", async () => {
    const alertMock = vi.fn();
    vi.stubGlobal("alert", alertMock);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 1, email: "a@b.com", source: null, created_at: null, verified: false },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ email: "a@b.com", user_id: 1, invited: true }, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectLeads />);
    await waitFor(() => expect(screen.getByText("a@b.com")).toBeInTheDocument());

    await userEvent.click(screen.getByText("admin.projectLeads.convert"));

    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    const convertCall = fetchMock.mock.calls[1];
    expect(convertCall[0]).toContain("/api/leads/convert");
    expect(JSON.parse((convertCall[1] as RequestInit).body as string)).toEqual({
      email: "a@b.com",
    });
  });
});
