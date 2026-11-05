import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TutorialDetail from "./TutorialDetail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderAtSlug(slug = "guide-0-hitl") {
  return render(
    <MemoryRouter initialEntries={[`/learn/${slug}`]}>
      <Routes>
        <Route path="/learn/:slug" element={<TutorialDetail />} />
        <Route path="/learn/:slug/lessons/:lessonId" element={<p>leçon affichée</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TutorialDetail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirige vers la première leçon (plus de sommaire intermédiaire)", async () => {
    // Round navigation : le sommaire vit maintenant dans TutorialSidebar,
    // affiché en permanence pendant la lecture — cette route ne fait que
    // rediriger, elle ne liste plus elle-même les leçons.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          id: 1, title: "Guide 0-hitl.com", slug: "guide-0-hitl", lang: "fr", access_role: "anonymous",
          lessons: [
            { id: 20, title: "Deuxième leçon", order: 1 },
            { id: 10, title: "Première leçon", order: 0 },
          ],
        }),
      ),
    );

    renderAtSlug();

    expect(await screen.findByText("leçon affichée")).toBeInTheDocument();
  });

  it("affiche un message si le tutoriel est introuvable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })));

    renderAtSlug();

    expect(await screen.findByText("learn.detail.notFound")).toBeInTheDocument();
  });
});
