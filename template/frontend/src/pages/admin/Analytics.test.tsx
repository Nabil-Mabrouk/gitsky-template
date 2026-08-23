import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Analytics from "./Analytics";

// useTranslation mocké en passthrough (clé -> clé) : premier test de
// composant du projet, pas encore de convention établie pour initialiser
// i18next-http-backend (fetch réseau des locales) en test — hors scope ici,
// ce test vérifie le rendu des DONNÉES, pas les traductions.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche les trois tables une fois les données chargées", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ country_code: "FR", visits: 42 }]))
      .mockResolvedValueOnce(jsonResponse([{ path: "/", visits: 100 }]))
      .mockResolvedValueOnce(jsonResponse([{ date: "2026-08-01", visits: 5 }]));
    vi.stubGlobal("fetch", fetchMock);

    render(<Analytics />);

    await waitFor(() => expect(screen.getByText("FR")).toBeInTheDocument());
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement échoue", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Analytics />);

    const errors = await screen.findAllByText("admin.analytics.error");
    expect(errors.length).toBe(3);
  });
});
