import { useEffect } from "react";
import manifest from "../landing-manifest.json";
import type { LandingManifest } from "../components/blocks/types";
import Hero from "../components/blocks/Hero";
import Features from "../components/blocks/Features";
import Testimonial from "../components/blocks/Testimonial";
import Faq from "../components/blocks/Faq";
import Pricing from "../components/blocks/Pricing";
import EmailCapture from "../components/blocks/EmailCapture";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import "../landing.css";

const data = manifest as LandingManifest;

// URLs explicites par skin (pas de formule générique) : Fraunces a un axe
// optical-size (opsz) propre, une formule fragiliserait le rendu pour
// économiser une ligne — même choix que l'ancien landing.html.jinja (Chap 24).
const FONT_HREF_BY_SKIN: Record<string, string> = {
  editorial:
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap",
  bold: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;900&family=Inter:wght@400;500;600&display=swap",
};
const DEFAULT_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

// Exporté pour test direct (skin inconnu -> repli clean/Inter, sans avoir à
// mocker le manifest par skin).
export function fontHrefForSkin(skin: string): string {
  return FONT_HREF_BY_SKIN[skin] ?? DEFAULT_FONT_HREF;
}

export default function Landing() {
  useEffect(() => {
    const href = fontHrefForSkin(data.skin);
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;

    document.head.append(preconnect1, preconnect2, stylesheet);
    return () => {
      preconnect1.remove();
      preconnect2.remove();
      stylesheet.remove();
    };
  }, []);

  return (
    <div className="landing" data-skin={data.skin}>
      <Navbar />
      {data.blocks.map((block, i) => {
        switch (block.type) {
          case "hero":
            return <Hero key={i} block={block} heroImage={data.hero_image} />;
          case "features":
            return <Features key={i} block={block} />;
          case "testimonial":
            return <Testimonial key={i} block={block} />;
          case "faq":
            return <Faq key={i} block={block} />;
          case "pricing":
            return <Pricing key={i} block={block} />;
          case "email_capture":
            return (
              <EmailCapture key={i} block={block} project={data.project} domain={data.domain} />
            );
          default:
            return null;
        }
      })}
      <Footer />
    </div>
  );
}
