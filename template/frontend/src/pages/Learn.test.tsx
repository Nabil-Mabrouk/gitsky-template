import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Learn from "./Learn";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Learn", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("liste les tutoriels renvoyés par le catalogue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse([
          { id: 1, title: "Guide 0-hitl.com", slug: "guide-0-hitl", lang: "fr", access_role: "anonymous" },
        ]),
      ),
    );

    render(
      <MemoryRouter>
        <Learn />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Guide 0-hitl.com")).toBeInTheDocument();
  });

  it("affiche le message vide quand aucun tutoriel n'existe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse([])));

    render(
      <MemoryRouter>
        <Learn />
      </MemoryRouter>,
    );

    expect(await screen.findByText("learn.empty")).toBeInTheDocument();
  });
});
