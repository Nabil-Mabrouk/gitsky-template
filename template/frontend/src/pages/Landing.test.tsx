import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Navbar (Chap 24, round layout/theming) utilise useAuth() + useTranslation()
// + son propre GET /health (project ET modules) — mêmes mocks que
// App.test.tsx pour un rendu silencieux, sans réseau ni AuthProvider réel.
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr", changeLanguage: vi.fn() },
  }),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

vi.stubGlobal(
  "fetch",
  vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse({ project: "mon-projet", modules: {} })),
  ),
);

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
  it("rend chaque type de bloc du manifest", async () => {
    render(<Landing />);

    // Marque du Navbar : peuplée de façon async (GET /health), comme le
    // copyright du Footer plus bas.
    await waitFor(() => expect(screen.getByText("mon-projet")).toBeInTheDocument());
    expect(screen.getByText("Bienvenue")).toBeInTheDocument();
    expect(screen.getByText("Rapide")).toBeInTheDocument();
    expect(screen.getByText("Génial")).toBeInTheDocument();
    expect(screen.getByText("Prix ?")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Rejoignez-nous")).toBeInTheDocument();
    // Le Navbar (Chap 24, round layout) n'est plus un CTA marketing — le
    // libellé du bloc email_capture n'apparaît qu'une fois, dans le bloc.
    expect(screen.getAllByText("S'inscrire")).toHaveLength(1);
    // Footer par défaut, toujours présent.
    await waitFor(() =>
      expect(screen.getByText(/© \d{4} mon-projet/)).toBeInTheDocument(),
    );
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
