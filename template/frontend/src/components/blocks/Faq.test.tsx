import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Faq from "./Faq";
import type { LandingBlock } from "./types";

const items = [{ question: "Q ?", answer: "A." }];

describe("Faq", () => {
  it("rend le layout accordion en <details>/<summary>", () => {
    const block: LandingBlock = { type: "faq", layout: "accordion", items };
    const { container } = render(<Faq block={block} />);
    expect(container.querySelector("details summary")?.textContent).toBe("Q ?");
    expect(screen.getByText("A.")).toBeInTheDocument();
  });

  it("retombe sur une liste simple sans layout accordion", () => {
    const block: LandingBlock = { type: "faq", items };
    const { container } = render(<Faq block={block} />);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("ul li strong")?.textContent).toBe("Q ?");
  });
});
