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
  { name: "pain-scraper", tier: "t0", domain: null, status: "active", publish_status: "draft" },
  { name: "gitsky-app", tier: "t2", domain: null, status: "active", publish_status: "live" },
];

describe("ProjectActions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche uniquement les champs pertinents pour le tier T0", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS));
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");

    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());
    expect(screen.getByText("fleet.actions.fields.signup_count")).toBeInTheDocument();
    expect(screen.getByText("fleet.actions.fields.visit_count")).toBeInTheDocument();
    // Champs T2 absents pour un projet T0.
    expect(screen.queryByText("fleet.actions.fields.mrr")).not.toBeInTheDocument();
  });

  it("affiche uniquement les champs pertinents pour le tier T2", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PROJECTS));
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("gitsky-app");

    await waitFor(() => expect(screen.getByText("gitsky-app")).toBeInTheDocument());
    expect(screen.getByText("fleet.actions.fields.mrr")).toBeInTheDocument();
    expect(screen.getByText("fleet.actions.fields.churn_rate_3m")).toBeInTheDocument();
    // Champs T0 absents pour un projet T2.
    expect(screen.queryByText("fleet.actions.fields.signup_count")).not.toBeInTheDocument();
  });

  it("lance un kill-check et affiche le verdict", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(PROJECTS))
      .mockResolvedValueOnce(
        jsonResponse({ project: "pain-scraper", tier: "t0", verdict: "kill_now", status: "killed" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderAtProject("pain-scraper");
    await waitFor(() => expect(screen.getByText("pain-scraper")).toBeInTheDocument());

    await userEvent.click(screen.getByText("fleet.actions.runKillCheck"));

    await waitFor(() => expect(screen.getByText("kill_now")).toBeInTheDocument());
    expect(screen.getByText("killed")).toBeInTheDocument();

    const [url, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/fleet/projects/pain-scraper/kill-check");
    const body = JSON.parse(options.body as string);
    expect(body).toHaveProperty("signup_count", 0);
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
