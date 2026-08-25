import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Hero from "./Hero";
import type { LandingBlock } from "./types";

describe("Hero", () => {
  it("rend le layout centré avec une image de héros", () => {
    const block: LandingBlock = {
      type: "hero",
      layout: "centered",
      badge: "Nouveau",
      headline: "Bienvenue",
      subhead: "Sous-titre",
      cta_primary: { label: "Go", target: "#x" },
    };
    const { container } = render(<Hero block={block} heroImage="data:image/png;base64,abc" />);

    expect(screen.getByText("Bienvenue")).toBeInTheDocument();
    expect(container.querySelector("img.hero-image")).toHaveAttribute(
      "src",
      "data:image/png;base64,abc",
    );
    expect(screen.getByText("Go")).toHaveAttribute("href", "#x");
  });

  it("rend le layout split avec un panneau vide si pas d'image", () => {
    const block: LandingBlock = { type: "hero", layout: "split", headline: "Titre split" };
    const { container } = render(<Hero block={block} heroImage="" />);

    expect(container.querySelector(".hero--split")).toBeInTheDocument();
    expect(container.querySelector(".hero-panel")).toBeInTheDocument();
    expect(container.querySelector("img.hero-panel")).not.toBeInTheDocument();
  });
});
