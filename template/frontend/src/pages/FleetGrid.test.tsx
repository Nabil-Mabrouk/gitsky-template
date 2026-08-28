import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FleetGrid from "./FleetGrid";

// Même mock passthrough que les autres tests admin (CreateProject.test.tsx,
// ProjectActions.test.tsx) — évite de charger i18next/les fichiers de
// traduction dans les tests unitaires.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderGrid() {
  return render(
    <MemoryRouter initialEntries={["/admin/fleet"]}>
      <FleetGrid />
    </MemoryRouter>,
  );
}

const PROJECTS = [
  {
    id: 1,
    name: "pain-scraper",
    domain: "pain-scraper.mystudio.com",
    status: "active",
    publish_status: "live",
    template_version: "1.0.0",
    github_repo: "acme-fleet/pain-scraper",
    github_webhook_installed: true,
    health: "healthy",
    lifecycle_state: "normal",
  },
  {
    id: 2,
    name: "dead-idea",
    domain: null,
    status: "archived",
    publish_status: "draft",
    template_version: null,
    github_repo: null,
    github_webhook_installed: false,
    health: "unknown",
    lifecycle_state: "stopped",
  },
  {
    id: 3,
    name: "silent-one",
    domain: "silent-one.mystudio.com",
    status: "active",
    publish_status: "preview",
    template_version: "1.0.0",
    github_repo: "acme-fleet/silent-one",
    github_webhook_installed: false,
    health: "failing",
    lifecycle_state: "maintenance",
  },
];

describe("FleetGrid", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche une carte par projet avec un badge de santé", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS)));

    renderGrid();

    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("dead-idea")).toBeInTheDocument();
    expect(screen.getByText("silent-one")).toBeInTheDocument();

    expect(screen.getByText("healthy")).toHaveClass("admin-badge--success");
    expect(screen.getByText("unknown")).toHaveClass("admin-badge--neutral");
    expect(screen.getByText("failing")).toHaveClass("admin-badge--danger");
  });

  it("affiche un badge de cycle de vie seulement pour un état non normal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS)));

    renderGrid();

    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("stopped")).toHaveClass("admin-badge--danger");
    expect(screen.getByText("maintenance")).toHaveClass("admin-badge--warning");
    // pain-scraper est "normal" : aucun badge de cycle de vie pour lui.
    expect(screen.queryByText("normal")).not.toBeInTheDocument();
  });

  it("distingue un dépôt GitHub sans webhook d'un dépôt avec redeploy actif", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS)));

    renderGrid();

    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("fleet.grid.githubOk")).toBeInTheDocument();
    expect(screen.getByText("fleet.grid.githubNoWebhook")).toBeInTheDocument();
    expect(screen.getByText("fleet.grid.githubNone")).toBeInTheDocument();
  });

  it("affiche le message vide quand la flotte est vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse([])));

    renderGrid();

    await waitFor(() => expect(screen.getByText("fleet.grid.empty")).toBeInTheDocument());
  });

  it("affiche l'erreur si l'appel échoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({}, 500)));

    renderGrid();

    await waitFor(() => expect(screen.getByText("fleet.grid.error")).toBeInTheDocument());
  });
});
