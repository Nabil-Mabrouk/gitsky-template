import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EmailCapture from "./EmailCapture";
import type { LandingBlock } from "./types";

const block: LandingBlock = {
  type: "email_capture",
  headline: "Rejoignez-nous",
  subhead: "Soyez informé",
  cta: "S'inscrire",
  field_placeholder: "votre@email.com",
};

describe("EmailCapture", () => {
  it("poste en same-origin /leads et affiche Merci! sur succès", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailCapture block={block} project="mon-projet" domain="mon-projet.mystudio.com" />);

    await userEvent.type(screen.getByPlaceholderText("votre@email.com"), "a@b.com");
    await userEvent.click(screen.getByText("S'inscrire"));

    expect(await screen.findByText("Merci !")).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/leads");
    expect(JSON.parse(options.body as string)).toEqual({
      project: "mon-projet",
      domain: "mon-projet.mystudio.com",
      email: "a@b.com",
    });

    vi.unstubAllGlobals();
  });

  it("affiche une erreur si la réponse n'est pas ok", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailCapture block={block} project="mon-projet" domain="mon-projet.mystudio.com" />);

    await userEvent.type(screen.getByPlaceholderText("votre@email.com"), "a@b.com");
    await userEvent.click(screen.getByText("S'inscrire"));

    expect(await screen.findByText("Une erreur est survenue, réessayez plus tard.")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
