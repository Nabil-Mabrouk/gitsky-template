import type { ReactNode } from "react";

// Carte réutilisable (Chap 28, refonte visuelle) — surface + bordure + ombre
// posées sur .admin-card (admin-theme.css). `as` permet de rendre un <Link>
// ou un <div> avec le même style (FleetGrid en a besoin pour des cartes
// cliquables sans dupliquer les classes ailleurs).
interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return <div className={`admin-card ${className}`.trim()}>{children}</div>;
}
