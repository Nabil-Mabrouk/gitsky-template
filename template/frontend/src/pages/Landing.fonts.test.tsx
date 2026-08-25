import { describe, expect, it } from "vitest";
import { fontHrefForSkin } from "./Landing";

// Bug réel (retour utilisateur, session de refonte design) : le brief
// choisissait Fraunces/Archivo/Inter par skin depuis toujours, mais rien ne
// les chargeait jamais nulle part — chaque page retombait silencieusement
// sur system-ui. Un <link> Google Fonts spécifique au skin doit être injecté
// (voir Landing.tsx useEffect) ; cette table est la source de vérité testée
// directement, sans avoir à mocker le manifest par skin.
describe("fontHrefForSkin", () => {
  it("charge Inter pour le skin clean", () => {
    const href = fontHrefForSkin("clean");
    expect(href).toContain("fonts.googleapis.com");
    expect(href).toContain("Inter");
  });

  it("charge Fraunces pour le skin editorial", () => {
    expect(fontHrefForSkin("editorial")).toContain("Fraunces");
  });

  it("charge Archivo pour le skin bold", () => {
    expect(fontHrefForSkin("bold")).toContain("Archivo");
  });

  it("retombe sur Inter (clean) pour un skin inconnu", () => {
    const href = fontHrefForSkin("skin_inexistant");
    expect(href).toBe(fontHrefForSkin("clean"));
    expect(href).toContain("Inter");
  });
});
