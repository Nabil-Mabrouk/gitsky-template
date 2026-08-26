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
  { name: "pain-scraper", domain: null, status: "active", publish_status: "draft" },
  { name: "gitsky-app", domain: null, status: "active", publish_status: "live" },
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

  it("affiche un message si le projet est introuvable", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS));
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("inconnu");

    await waitFor(() =>
      expect(screen.getByText("fleet.actions.notFound")).toBeInTheDocument(),
    );
  });
});
