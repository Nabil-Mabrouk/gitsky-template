import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Features from "./Features";
import type { LandingBlock } from "./types";

const items = [{ title: "A", description: "B" }];

describe("Features", () => {
  it("rend le layout grid avec des feature-card", () => {
    const block: LandingBlock = { type: "features", layout: "grid", items };
    const { container } = render(<Features block={block} />);
    expect(container.querySelector(".feature-grid .feature-card")).not.toBeNull();
    expect(container.querySelectorAll(".feature-card")).toHaveLength(1);
  });

  it("rend le layout alternating en feature-alt", () => {
    const block: LandingBlock = { type: "features", layout: "alternating", items };
    const { container } = render(<Features block={block} />);
    expect(container.querySelector("ul.feature-alt")).not.toBeNull();
  });

  it("retombe sur une liste simple sans layout", () => {
    const block: LandingBlock = { type: "features", items };
    const { container } = render(<Features block={block} />);
    expect(container.querySelector(".feature-grid")).toBeNull();
    expect(container.querySelector(".feature-alt")).toBeNull();
    expect(container.querySelector("ul li strong")?.textContent).toBe("A");
  });
});
