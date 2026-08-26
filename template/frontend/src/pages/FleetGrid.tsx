import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api";
import Card from "../components/admin/Card";
import Badge, { type BadgeVariant } from "../components/admin/Badge";

// Grille de projets de la flotte (Chap 19, refonte carte Chap 28) : vue
// GET /api/fleet/projects, réservée à l'admin côté API (require_admin). Le
// nom d'un projet ouvre sa page Actions (promote/archive/GitHub) — les
// autres onglets par projet (Funnel/Métriques/Logs) et l'agrégation de coûts
// restent hors périmètre (aucune source de données pour eux n'existe encore
// côté backend).
interface FleetProject {
  id: number;
  name: string;
  domain: string | null;
  status: string;
  publish_status: string;
  template_version: string | null;
  github_repo: string | null;
  github_webhook_installed: boolean;
  // Calculé par le backend (health_monitor.bulk_health_status, Chap 28) —
  // "unknown" tant qu'aucun balayage de disponibilité n'a encore eu lieu.
  health: string;
}

type SortKey = "name" | "domain" | "status" | "publish_status" | "health";

const HEALTH_VARIANT: Record<string, BadgeVariant> = {
  healthy: "success",
  failing: "danger",
  unknown: "neutral",
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "info",
  archived: "neutral",
};

const PUBLISH_VARIANT: Record<string, BadgeVariant> = {
  live: "success",
  preview: "warning",
  draft: "neutral",
};

export default function FleetGrid() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<FleetProject[] | null>(null);
  const [error, setError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    apiFetch("/api/fleet/projects").then(async (r) => {
      if (r.ok) setProjects((await r.json()) as FleetProject[]);
      else setError(true);
    });
  }, []);

  const sorted = useMemo(() => {
    if (!projects) return [];
    const copy = [...projects];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [projects, sortKey, sortAsc]);

  if (error) return <p className="text-sm text-red-600">{t("fleet.grid.error")}</p>;
  if (!projects) return <p>{t("fleet.grid.loading")}</p>;

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "name", label: t("fleet.grid.columns.name") },
    { key: "domain", label: t("fleet.grid.columns.domain") },
    { key: "status", label: t("fleet.grid.columns.status") },
    { key: "publish_status", label: t("fleet.grid.columns.publishStatus") },
    { key: "health", label: t("fleet.grid.columns.health") },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("fleet.grid.title")}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--admin-text-muted)" }}>
            {t("fleet.grid.sortBy")}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="admin-card px-2 py-1 text-sm"
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="admin-card px-2 py-1 text-sm"
              aria-label={t("fleet.grid.sortDirection")}
            >
              {sortAsc ? "▲" : "▼"}
            </button>
          </label>
          <Link
            to="/admin/fleet/new"
            className="rounded p-2 text-sm font-medium text-white"
            style={{ background: "var(--color-primary)" }}
          >
            {t("fleet.grid.newProject")}
          </Link>
        </div>
      </div>

      {projects.length === 0 && <p>{t("fleet.grid.empty")}</p>}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {sorted.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/admin/fleet/${p.name}`} className="text-lg font-semibold hover:underline">
                {p.name}
              </Link>
              <Badge variant={HEALTH_VARIANT[p.health] ?? "neutral"}>
                {t(`fleet.grid.health.${p.health}`, p.health)}
              </Badge>
            </div>

            <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>
              {p.domain ?? t("fleet.grid.noDomain")}
            </p>

            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_VARIANT[p.status] ?? "neutral"}>{p.status}</Badge>
              <Badge variant={PUBLISH_VARIANT[p.publish_status] ?? "neutral"}>{p.publish_status}</Badge>
            </div>

            <div className="mt-auto flex items-center justify-between border-t pt-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              {p.github_repo ? (
                <span title={p.github_repo} style={{ color: "var(--admin-text-muted)" }}>
                  {p.github_webhook_installed
                    ? t("fleet.grid.githubOk")
                    : t("fleet.grid.githubNoWebhook")}
                </span>
              ) : (
                <span style={{ color: "var(--admin-text-muted)" }}>{t("fleet.grid.githubNone")}</span>
              )}
              <Link to={`/admin/fleet/${p.name}`} className="font-medium hover:underline" style={{ color: "var(--color-primary)" }}>
                {t("fleet.grid.viewProject")}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
