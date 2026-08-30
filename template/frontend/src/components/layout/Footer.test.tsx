import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Footer from "./Footer";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Footer", () => {
  it("affiche le copyright avec le nom du projet (lu via /health) et l'année courante", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ project: "pain-scraper" }))),
    );

    render(<Footer />);

    const year = new Date().getFullYear();
    await waitFor(() =>
      expect(screen.getByText(`© ${year} pain-scraper`)).toBeInTheDocument(),
    );
  });
});
