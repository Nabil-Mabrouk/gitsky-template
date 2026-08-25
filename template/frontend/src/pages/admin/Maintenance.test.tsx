import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Maintenance from "./Maintenance";

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

describe("Maintenance", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche les dernières exécutions avec succès/échec distingués", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          id: 2,
          job: "restore-test",
          status: "failure",
          summary: "Aucune table après restauration.",
          project: "pain_scraper",
          created_at: "2026-08-25T04:00:00Z",
        },
        {
          id: 1,
          job: "backup-fleet",
          status: "success",
          summary: "2 projets sauvegardés.",
          project: null,
          created_at: "2026-08-25T02:00:00Z",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Maintenance />);

    await waitFor(() => expect(screen.getByText("restore-test")).toBeInTheDocument());
    expect(screen.getByText("backup-fleet")).toBeInTheDocument();
    expect(screen.getByText("admin.maintenance.failure")).toBeInTheDocument();
    expect(screen.getByText("admin.maintenance.success")).toBeInTheDocument();
    expect(screen.getByText("Aucune table après restauration.")).toBeInTheDocument();
    expect(screen.getByText("pain_scraper")).toBeInTheDocument();

    expect(fetchMock.mock.calls[0][0]).toContain("/api/fleet/maintenance/runs");
  });

  it("affiche un message si aucune exécution n'est enregistrée", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<Maintenance />);

    await waitFor(() => expect(screen.getByText("admin.maintenance.empty")).toBeInTheDocument());
  });

  it("affiche toujours le bloc planification, même en erreur", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Maintenance />);

    await waitFor(() => expect(screen.getByText("admin.maintenance.error")).toBeInTheDocument());
    // Le tableau de planification (statique) reste affiché indépendamment
    // du succès de l'appel réseau.
    expect(screen.getByText("test-restore-fleet.sh")).toBeInTheDocument();
  });
});
