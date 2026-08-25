import { useState, type FormEvent } from "react";
import type { LandingBlock } from "./types";

interface Props {
  block: LandingBlock;
  project: string;
  domain: string;
}

// POST same-origin /leads (Traefik route vers le landing collector partagé,
// Chap 18) — même contrat que l'ancien vanilla JS de landing.html.jinja :
// vérifie response.ok avant d'afficher "Merci !" (bug réel corrigé cette
// session : un échec silencieux affichait "Merci !" même quand la capture
// avait réellement échoué côté serveur).
export default function EmailCapture({ block, project, domain }: Props) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    let ok = false;
    try {
      const res = await fetch("/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, domain, email }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    setResult(ok ? "success" : "error");
  }

  return (
    <section className="capture" id="email-capture" style={{ textAlign: "center" }}>
      {result === "idle" ? (
        <>
          {block.headline && <h2>{block.headline}</h2>}
          {block.subhead && <p>{block.subhead}</p>}
          <form onSubmit={onSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={block.field_placeholder || "votre@email.com"}
              required
            />
            <button className="btn" type="submit">
              {block.cta}
            </button>
          </form>
          {block.legal_note && (
            <p>
              <small>{block.legal_note}</small>
            </p>
          )}
        </>
      ) : (
        <p>{result === "success" ? "Merci !" : "Une erreur est survenue, réessayez plus tard."}</p>
      )}
    </section>
  );
}
