import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("affiche son contenu et applique la classe de variante", () => {
    render(<Badge variant="success">healthy</Badge>);
    const badge = screen.getByText("healthy");
    expect(badge).toHaveClass("admin-badge");
    expect(badge).toHaveClass("admin-badge--success");
  });

  it("change de classe selon la variante", () => {
    render(<Badge variant="danger">failing</Badge>);
    expect(screen.getByText("failing")).toHaveClass("admin-badge--danger");
  });
});
