import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Activity from "./Activity";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ENTRIES = [
  {
    kind: "lifecycle",
    id: 1,
    project: "pain-scraper",
    label: "born",
    detail: null,
    status: null,
    created_at: "2026-08-26T10:00:00Z",
  },
  {
    kind: "lifecycle",
    id: 2,
    project: "silent-one",
    label: "deployment_failed",
    detail: "muet > 5 min sur /health",
    status: null,
    created_at: "2026-08-26T11:00:00Z",
  },
  {
    kind: "maintenance",
    id: 7,
    project: null,
    label: "backup-fleet",
    detail: "1 projet sauvegardé.",
    status: "success",
    created_at: "2026-08-26T12:00:00Z",
  },
];

describe("Activity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche les entrées fusionnées avec leur badge et leur détail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(ENTRIES)));

    render(<Activity />);

    await waitFor(() => expect(screen.getByText("born")).toBeInTheDocument());
    expect(screen.getByText("born")).toHaveClass("admin-badge--success");

    expect(screen.getByText("deployment_failed")).toHaveClass("admin-badge--danger");
    expect(screen.getByText("muet > 5 min sur /health")).toBeInTheDocument();

    expect(screen.getByText("backup-fleet")).toHaveClass("admin-badge--success");
    expect(screen.getByText("1 projet sauvegardé.")).toBeInTheDocument();
    expect(screen.getByText("pain-scraper")).toBeInTheDocument();
    expect(screen.getByText("silent-one")).toBeInTheDocument();
  });

  it("distingue une exécution de maintenance en échec (badge danger)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse([
          {
            kind: "maintenance",
            id: 8,
            project: null,
            label: "backup-fleet",
            detail: "Échec de sauvegarde.",
            status: "failure",
            created_at: "2026-08-26T13:00:00Z",
          },
        ]),
      ),
    );

    render(<Activity />);

    await waitFor(() => expect(screen.getByText("backup-fleet")).toBeInTheDocument());
    expect(screen.getByText("backup-fleet")).toHaveClass("admin-badge--danger");
  });

  it("affiche le message vide quand aucune activité n'existe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse([])));

    render(<Activity />);

    await waitFor(() => expect(screen.getByText("activity.empty")).toBeInTheDocument());
  });

  it("affiche l'erreur si l'appel échoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({}, 500)));

    render(<Activity />);

    await waitFor(() => expect(screen.getByText("activity.error")).toBeInTheDocument());
  });
});
