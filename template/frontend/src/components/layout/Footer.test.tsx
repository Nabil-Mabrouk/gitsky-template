import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
  it("affiche le copyright avec le nom du projet et l'année courante", () => {
    render(<Footer project="pain-scraper" />);

    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} pain-scraper`)).toBeInTheDocument();
  });
});
