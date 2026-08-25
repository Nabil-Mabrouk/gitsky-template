import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Testimonial from "./Testimonial";
import type { LandingBlock } from "./types";

describe("Testimonial", () => {
  it("ajoute testimonial-card pour le layout card", () => {
    const block: LandingBlock = { type: "testimonial", layout: "card", quote: "Q", attribution: "Alice" };
    const { container } = render(<Testimonial block={block} />);
    expect(container.querySelector("section.testimonial-card")).not.toBeNull();
    expect(screen.getByText("Q")).toBeInTheDocument();
  });

  it("n'ajoute pas testimonial-card sans layout", () => {
    const block: LandingBlock = { type: "testimonial", quote: "Q", attribution: "Alice" };
    const { container } = render(<Testimonial block={block} />);
    expect(container.querySelector("section.testimonial-card")).toBeNull();
    expect(container.querySelector("section.testimonial")).not.toBeNull();
  });
});
