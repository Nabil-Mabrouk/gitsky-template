// Footer de la landing (Chap 24) — minimal par défaut, à personnaliser
// librement (Chap 24, AGENTS.md). Pas de contenu inventé au-delà du
// copyright : pas de fausses mentions légales, pas de liens qui ne mènent
// nulle part.
interface FooterProps {
  project: string;
}

export default function Footer({ project }: FooterProps) {
  return (
    <footer className="site-footer">
      <p>
        © {new Date().getFullYear()} {project}
      </p>
    </footer>
  );
}
