import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";
import Card from "../../components/admin/Card";
import Badge, { type BadgeVariant } from "../../components/admin/Badge";

// Flux d'activité consolidé (Chap 28) : fusionne fleet_lifecycle_events et
// fleet_maintenance_runs (GET /api/fleet/activity) — PAS security_events,
// qui vit dans la base isolée de chaque projet (Chap 18 §2) et n'a pas de
// requête inter-bases construite pour l'instant (Chap 28 §« Ce qui Manque
// Encore »). Onglet réservé admin (moduleFlag "fleet", même garde que la
// grille elle-même).
interface ActivityEntry {
  kind: "lifecycle" | "maintenance";
  id: number;
  project: string | null;
  label: string;
  detail: string | null;
  status: string | null;
  created_at: string | null;
}

const LIFECYCLE_VARIANT: Record<string, BadgeVariant> = {
  born: "success",
  archived: "neutral",
  deployment_failed: "danger",
  deployment_recovered: "success",
  deploy_triggered: "info",
  github_repo_created: "info",
  github_repo_linked: "info",
  publish_preview: "warning",
  publish_live: "success",
};

function entryVariant(e: ActivityEntry): BadgeVariant {
  if (e.kind === "maintenance") return e.status === "failure" ? "danger" : "success";
  return LIFECYCLE_VARIANT[e.label] ?? "neutral";
}

export default function Activity() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/api/fleet/activity?limit=100").then(async (r) => {
      if (r.ok) setEntries((await r.json()) as ActivityEntry[]);
      else setError(true);
    });
  }, []);

  if (error) return <p className="text-sm text-red-600">{t("activity.error")}</p>;
  if (!entries) return <p>{t("activity.loading")}</p>;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t("activity.title")}</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--admin-text-muted)" }}>
        {t("activity.subtitle")}
      </p>

      {entries.length === 0 && <p>{t("activity.empty")}</p>}

      <div className="grid gap-2">
        {entries.map((e) => (
          <Card key={`${e.kind}-${e.id}`} className="flex flex-wrap items-center gap-3 p-3">
            <Badge variant={entryVariant(e)}>{e.label}</Badge>
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>
              {t(`activity.kind.${e.kind}`)}
            </span>
            {e.project && <span className="text-sm font-medium">{e.project}</span>}
            {e.detail && (
              <span className="text-sm" style={{ color: "var(--admin-text-muted)" }}>
                {e.detail}
              </span>
            )}
            <span className="ml-auto text-xs" style={{ color: "var(--admin-text-muted)" }}>
              {e.created_at ? new Date(e.created_at).toLocaleString() : "—"}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
