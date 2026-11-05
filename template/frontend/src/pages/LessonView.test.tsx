import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LessonView from "./LessonView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TUTORIAL = {
  title: "Guide 0-hitl.com",
  slug: "guide-0-hitl",
  lessons: [
    { id: 10, title: "Première leçon", order: 0 },
    { id: 20, title: "Deuxième leçon", order: 1 },
    { id: 30, title: "Troisième leçon", order: 2 },
  ],
};

function stubFetch(lessonId: number, lessonStatus = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes(`/lessons/${lessonId}`)) {
        return Promise.resolve(
          lessonStatus === 200
            ? jsonResponse({ id: lessonId, title: "Deuxième leçon", order: 1, content: "## Contenu\n\ntexte" })
            : new Response(null, { status: lessonStatus }),
        );
      }
      return Promise.resolve(jsonResponse(TUTORIAL));
    }),
  );
}

function renderAtLesson(lessonId = 20) {
  return render(
    <MemoryRouter initialEntries={[`/learn/guide-0-hitl/lessons/${lessonId}`]}>
      <Routes>
        <Route path="/learn/:slug/lessons/:lessonId" element={<LessonView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LessonView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche le sommaire avec la leçon active surlignée", async () => {
    stubFetch(20);
    renderAtLesson(20);

    const sidebar = await screen.findByRole("navigation", { name: "Guide 0-hitl.com" });
    const active = within(sidebar).getByRole("link", { name: /Deuxième leçon/ });
    expect(active).toHaveClass("active");
    const other = within(sidebar).getByRole("link", { name: /Première leçon/ });
    expect(other).not.toHaveClass("active");
  });

  it("affiche le contenu Markdown et la progression", async () => {
    stubFetch(20);
    renderAtLesson(20);

    expect(await screen.findByRole("heading", { name: "Contenu" })).toBeInTheDocument();
    expect(screen.getByText(/learn\.lesson\.progress/)).toBeInTheDocument();
  });

  it("navigue vers la leçon suivante au clic", async () => {
    stubFetch(20);
    renderAtLesson(20);

    await screen.findByText("Guide 0-hitl.com");
    const pager = screen.getByRole("navigation", { name: /progress/ });
    const next = within(pager).getByRole("link", { name: /Troisième leçon/ });
    expect(next).toHaveAttribute("href", "/learn/guide-0-hitl/lessons/30");

    // Changer de leçon redéclenche le fetch de la bonne leçon.
    stubFetch(30);
    await userEvent.click(next);
  });

  it("garde le sommaire visible même si la leçon ciblée est interdite (403)", async () => {
    stubFetch(20, 403);
    renderAtLesson(20);

    expect(await screen.findByText("Guide 0-hitl.com")).toBeInTheDocument();
    expect(screen.getByText("learn.lesson.forbidden")).toBeInTheDocument();
  });
});
