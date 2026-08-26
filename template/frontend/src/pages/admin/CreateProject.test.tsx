import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateProject from "./CreateProject";

// Même mock passthrough que les autres tests admin.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/fleet/new"]}>
      <Routes>
        <Route path="/admin/fleet/new" element={<CreateProject />} />
        <Route path="/admin/fleet/:name" element={<div>project-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const CATALOG = ["admin", "analytics", "agentic"];

describe("CreateProject", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("charge le catalogue de modules et affiche une case par module", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(CATALOG));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());
    expect(screen.getByText("analytics")).toBeInTheDocument();
    expect(screen.getByText("agentic")).toBeInTheDocument();
  });

  it("crée un projet sans GitHub et affiche le résumé", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(CATALOG))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            project: { name: "pain-scraper", domain: "pain-scraper.mystudio.com", status: "active" },
            generated: true,
            github_repo: null,
            webhook_installed: false,
            pushed: false,
            deploy_triggered: false,
            warnings: [],
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText("fleet.create.namePlaceholder"), "pain-scraper");
    await userEvent.click(screen.getByText("fleet.create.submit"));

    await waitFor(() =>
      expect(screen.getByText("fleet.create.doneTitle")).toBeInTheDocument(),
    );
    expect(screen.getByText("pain-scraper")).toBeInTheDocument();
    expect(screen.getByText("fleet.create.summaryGenerated")).toBeInTheDocument();
    expect(screen.queryByText("fleet.create.summaryRepo")).not.toBeInTheDocument();

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/fleet/projects");
    const body = JSON.parse(options.body as string);
    expect(body.name).toBe("pain-scraper");
    expect(body.github_mode).toBe("skip");
  });

  it("crée un projet avec GitHub et affiche les warnings du webhook", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(CATALOG))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            project: { name: "with-repo", domain: "with-repo.mystudio.com", status: "active" },
            generated: true,
            github_repo: "acme-fleet/with-repo",
            webhook_installed: false,
            pushed: true,
            deploy_triggered: true,
            warnings: ["Dépôt lié, mais l'installation du webhook a échoué."],
          },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText("fleet.create.namePlaceholder"), "with-repo");
    await userEvent.click(screen.getByText("fleet.create.githubCreate"));
    await userEvent.click(screen.getByText("fleet.create.submit"));

    await waitFor(() =>
      expect(screen.getByText("fleet.create.doneTitle")).toBeInTheDocument(),
    );
    expect(screen.getByText("acme-fleet/with-repo")).toBeInTheDocument();
    expect(screen.getByText("fleet.create.summaryWebhookMissing")).toBeInTheDocument();
    expect(
      screen.getByText(/Dépôt lié, mais l'installation du webhook a échoué\./),
    ).toBeInTheDocument();

    const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.github_mode).toBe("create");
  });

  it("affiche l'erreur renvoyée par le serveur (ex. nom déjà pris)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(CATALOG))
      .mockResolvedValueOnce(jsonResponse({ detail: "Projet déjà enregistré" }, 409));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await waitFor(() => expect(screen.getByText("admin")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText("fleet.create.namePlaceholder"), "taken");
    await userEvent.click(screen.getByText("fleet.create.submit"));

    await waitFor(() =>
      expect(screen.getByText("Projet déjà enregistré")).toBeInTheDocument(),
    );
    expect(screen.queryByText("fleet.create.doneTitle")).not.toBeInTheDocument();
  });
});
