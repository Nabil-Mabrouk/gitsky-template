import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectActions from "./ProjectActions";

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

function renderAtProject(name: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/fleet/${name}`]}>
      <Routes>
        <Route path="/admin/fleet/:name" element={<ProjectActions />} />
      </Routes>
    </MemoryRouter>,
  );
}

const PROJECTS = [
  {
    name: "pain-scraper",
    domain: null,
    status: "active",
    publish_status: "draft",
    github_repo: null,
    github_webhook_installed: false,
  },
  {
    name: "gitsky-app",
    domain: null,
    status: "active",
    publish_status: "live",
    github_repo: null,
    github_webhook_installed: false,
  },
];

describe("ProjectActions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche le nom et le statut du projet", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS));
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");

    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("active · draft")).toBeInTheDocument();
  });

  it("lance une promotion et affiche le résultat", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(PROJECTS))
      .mockResolvedValueOnce(
        jsonResponse({
          project: "pain-scraper",
          publish_status: "preview",
          allowed: true,
          reason: "ok",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");
    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());

    await userEvent.click(screen.getByText("fleet.actions.runPromote"));

    await waitFor(() =>
      expect(screen.getByText(/fleet.actions.promoted/)).toBeInTheDocument(),
    );

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/fleet/projects/pain-scraper/promote");
    expect(JSON.parse(options.body as string)).toEqual({
      guardrails_pass: true,
      human_approved: false,
    });
  });

  it("archive le projet et affiche la confirmation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(PROJECTS))
      .mockResolvedValueOnce(
        jsonResponse({
          name: "pain-scraper",
          domain: null,
          status: "archived",
          publish_status: "draft",
          template_version: null,
          github_repo: null,
          github_webhook_installed: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");
    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());

    await userEvent.click(screen.getByText("fleet.actions.runArchive"));

    await waitFor(() =>
      expect(screen.getByText("fleet.actions.archived")).toBeInTheDocument(),
    );

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/fleet/projects/pain-scraper/archive");
    expect(options.method).toBe("POST");
  });

  it("n'affiche pas le bouton d'archivage pour un projet déjà archivé", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          name: "pain-scraper",
          domain: null,
          status: "archived",
          publish_status: "draft",
          github_repo: null,
          github_webhook_installed: false,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");

    await waitFor(() =>
      expect(screen.getByText("fleet.actions.alreadyArchived")).toBeInTheDocument(),
    );
    expect(screen.queryByText("fleet.actions.runArchive")).not.toBeInTheDocument();
  });

  it("crée un dépôt GitHub et affiche l'état du webhook", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(PROJECTS))
      .mockResolvedValueOnce(
        jsonResponse({
          project: "pain-scraper",
          repo: "acme-fleet/pain-scraper",
          html_url: "https://github.com/acme-fleet/pain-scraper",
          webhook_installed: true,
          message: "",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");
    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("fleet.actions.githubNoRepo")).toBeInTheDocument();

    await userEvent.click(screen.getByText("fleet.actions.githubCreateRepo"));

    await waitFor(() =>
      expect(screen.getByText("acme-fleet/pain-scraper")).toBeInTheDocument(),
    );
    expect(screen.getByText("fleet.actions.githubWebhookOk")).toBeInTheDocument();

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/fleet/projects/pain-scraper/github/create-repo");
    expect(JSON.parse(options.body as string)).toEqual({ private: true });
  });

  it("lie un dépôt existant et affiche le message si le webhook échoue", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(PROJECTS))
      .mockResolvedValueOnce(
        jsonResponse({
          project: "pain-scraper",
          repo: "third-party/repo",
          html_url: "https://github.com/third-party/repo",
          webhook_installed: false,
          message: "Dépôt lié, mais l'installation du webhook a échoué.",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");
    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());

    await userEvent.type(
      screen.getByPlaceholderText("fleet.actions.githubLinkRepoPlaceholder"),
      "third-party/repo",
    );
    await userEvent.click(screen.getByText("fleet.actions.githubLinkRepo"));

    await waitFor(() =>
      expect(screen.getByText("third-party/repo")).toBeInTheDocument(),
    );
    expect(screen.getByText("fleet.actions.githubWebhookMissing")).toBeInTheDocument();
    expect(
      screen.getByText("Dépôt lié, mais l'installation du webhook a échoué."),
    ).toBeInTheDocument();

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/fleet/projects/pain-scraper/github/link-repo");
    expect(JSON.parse(options.body as string)).toEqual({ repo: "third-party/repo" });
  });

  it("affiche un message si le projet est introuvable", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS));
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("inconnu");

    await waitFor(() =>
      expect(screen.getByText("fleet.actions.notFound")).toBeInTheDocument(),
    );
  });
});
