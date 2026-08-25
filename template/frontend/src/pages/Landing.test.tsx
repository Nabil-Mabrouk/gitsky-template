import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// landing-manifest.json est la fixture de dev committée (Chap 24) — copier
// l'exclut des projets générés, seul landing-manifest.json.jinja y écrit ;
// elle contient déjà les 6 types de bloc, donc ce test les couvre tous.
vi.mock("../landing-manifest.json", () => ({
  default: {
    project: "mon-projet",
    domain: "mon-projet.mystudio.com",
    skin: "editorial",
    hero_image: "",
    blocks: [
      { type: "hero", layout: "centered", headline: "Bienvenue", subhead: "Sous-titre" },
      {
        type: "features",
        layout: "grid",
        headline: "Fonctionnalités",
        items: [{ title: "Rapide", description: "Très rapide" }],
      },
      { type: "testimonial", layout: "card", quote: "Génial", attribution: "Une cliente" },
      {
        type: "faq",
        layout: "accordion",
        headline: "FAQ",
        items: [{ question: "Prix ?", answer: "Gratuit" }],
      },
      {
        type: "pricing",
        headline: "Tarifs",
        plans: [{ name: "Pro", price: "29€", features: ["Support"] }],
      },
      {
        type: "email_capture",
        headline: "Rejoignez-nous",
        cta: "S'inscrire",
        field_placeholder: "votre@email.com",
      },
      { type: "bloc_inconnu", headline: "NE_DOIT_PAS_APPARAITRE" },
    ],
  },
}));

import Landing from "./Landing";

describe("Landing", () => {
  it("rend chaque type de bloc du manifest", () => {
    render(<Landing />);

    expect(screen.getByText("mon-projet")).toBeInTheDocument();
    expect(screen.getByText("Bienvenue")).toBeInTheDocument();
    expect(screen.getByText("Rapide")).toBeInTheDocument();
    expect(screen.getByText("Génial")).toBeInTheDocument();
    expect(screen.getByText("Prix ?")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Rejoignez-nous")).toBeInTheDocument();
    // Le CTA de la nav réutilise le libellé du bloc email_capture.
    expect(screen.getAllByText("S'inscrire")).toHaveLength(2);
  });

  it("ignore un type de bloc inconnu sans planter", () => {
    render(<Landing />);
    expect(screen.queryByText("NE_DOIT_PAS_APPARAITRE")).not.toBeInTheDocument();
  });

  it("pose data-skin sur la racine selon le manifest", () => {
    const { container } = render(<Landing />);
    expect(container.querySelector(".landing")).toHaveAttribute("data-skin", "editorial");
  });
});
