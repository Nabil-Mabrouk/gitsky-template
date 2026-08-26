import type { ReactNode } from "react";

// Badge réutilisable (Chap 28, refonte visuelle) — variantes posées sur les
// tokens --admin-*-bg/--admin-*-text d'admin-theme.css, jamais de couleur en
// dur ici : le composant reste correct en dark mode automatiquement.
export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  return <span className={`admin-badge admin-badge--${variant}`}>{children}</span>;
}
