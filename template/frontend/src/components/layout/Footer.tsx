import { useEffect, useState } from "react";
import { apiFetch } from "../../api";

// Footer partagé par la landing ET le reste de l'app (Chap 24, round
// theming) — minimal par défaut, à personnaliser librement (AGENTS.md).
// Pas de contenu inventé au-delà du copyright : pas de fausses mentions
// légales, pas de liens qui ne mènent nulle part. Autonome (GET /health,
// même patron que Navbar) plutôt qu'une prop `project` : usable tel quel
// sur n'importe quelle page, sans faire remonter cet état plus haut.
export default function Footer() {
  const [project, setProject] = useState("");

  useEffect(() => {
    apiFetch("/health")
      .then(async (r) => (r.ok ? ((await r.json()) as { project?: string }) : null))
      .then((data) => setProject(data?.project ?? ""))
      .catch(() => {});
  }, []);

  return (
    <footer className="site-footer">
      <p>
        © {new Date().getFullYear()} {project}
      </p>
    </footer>
  );
}
