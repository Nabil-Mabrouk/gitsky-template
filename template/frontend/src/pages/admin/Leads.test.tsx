import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Leads from "./Leads";

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

describe("Leads", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("liste tous les projets enregistrés, sélectionne le premier et affiche ses leads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { name: "pain-scraper" },
          { name: "gitsky-app" },
          { name: "dead-idea" },
        ]),
      )
      .mockResolvedValueOnce(
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

    render(<Leads />);

    await waitFor(() => expect(screen.getByText("a@b.com")).toBeInTheDocument());
    expect(screen.getByText("reddit")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("pain-scraper");
    // Tous les projets enregistrés apparaissent dans le sélecteur.
    expect(screen.getByText("gitsky-app")).toBeInTheDocument();

    const lastCallUrl = fetchMock.mock.calls[1][0] as string;
    expect(lastCallUrl).toContain("/api/fleet/projects/pain-scraper/leads");
  });

  it("recharge les leads quand le projet sélectionné change", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ name: "pain-scraper" }, { name: "dead-idea" }]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<Leads />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "dead-idea");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const lastCallUrl = fetchMock.mock.calls[2][0] as string;
    expect(lastCallUrl).toContain("/api/fleet/projects/dead-idea/leads");
  });

  it("affiche un message si aucun projet n'est enregistré", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<Leads />);

    await waitFor(() => expect(screen.getByText("admin.leads.noProjects")).toBeInTheDocument());
  });
});
