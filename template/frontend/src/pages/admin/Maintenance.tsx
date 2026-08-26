import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Onglet Maintenance (Chap 23) — dernières exécutions des jobs de flotte
// (backup-fleet.sh, test-restore-fleet.sh, fleet-disk.sh, tous postés via
// POST /api/fleet/maintenance/report) + rappel de la planification actuelle.
//
// Le bloc planification est STATIQUE (recopié de MAINTENANCE.md), pas lu en
// direct depuis crontab.fleet : ce fichier vit sur l'hôte, hors de portée du
// conteneur fleet-dashboard, et changer la fréquence reste volontairement un
// geste serveur (`crontab crontab.fleet`), pas une action dashboard — donner
// à ce conteneur un accès en écriture au cron de l'hôte est une frontière de
// privilège qui reste hors périmètre. Si la planification change sur le
// serveur, ce bloc doit être mis à jour ici à la main.
interface MaintenanceRun {
  id: number;
  job: string;
  status: "success" | "failure";
  summary: string | null;
  project: string | null;
  created_at: string | null;
}

const SCHEDULE = [
  { job: "fleet-health.sh", freq: "60 s" },
  { job: "backup-fleet.sh", freq: "Quotidien 02:00" },
  { job: "fleet-disk.sh", freq: "Horaire" },
  { job: "docker image prune", freq: "Hebdo (dim 05:00)" },
  { job: "test-restore-fleet.sh", freq: "Mensuel (1er, 04:00)" },
  { job: "rotation des logs", freq: "Mensuel (1er, 06:00)" },
];

export default function Maintenance() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<MaintenanceRun[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/api/fleet/maintenance/runs").then(async (r) => {
      if (r.ok) setRuns((await r.json()) as MaintenanceRun[]);
      else setError(true);
    });
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin.maintenance.title")}</h1>

      <h2 className="mb-2 text-lg font-semibold">{t("admin.maintenance.runsTitle")}</h2>
      {error && <p className="text-sm text-red-600">{t("admin.maintenance.error")}</p>}
      {!error && runs === null && <p>{t("admin.maintenance.loading")}</p>}
      {!error && runs !== null && runs.length === 0 && <p>{t("admin.maintenance.empty")}</p>}
      {!error && runs !== null && runs.length > 0 && (
        <table className="mb-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 font-medium">{t("admin.maintenance.columns.job")}</th>
              <th className="p-2 font-medium">{t("admin.maintenance.columns.status")}</th>
              <th className="p-2 font-medium">{t("admin.maintenance.columns.summary")}</th>
              <th className="p-2 font-medium">{t("admin.maintenance.columns.project")}</th>
              <th className="p-2 font-medium">{t("admin.maintenance.columns.date")}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b">
                <td className="p-2">{run.job}</td>
                <td className={`p-2 ${run.status === "failure" ? "text-red-600" : ""}`}>
                  {run.status === "failure"
                    ? t("admin.maintenance.failure")
                    : t("admin.maintenance.success")}
                </td>
                <td className="p-2">{run.summary || "—"}</td>
                <td className="p-2">{run.project || "—"}</td>
                <td className="p-2">
                  {run.created_at ? new Date(run.created_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mb-2 text-lg font-semibold">{t("admin.maintenance.scheduleTitle")}</h2>
      <p className="mb-2 text-sm text-black/60">{t("admin.maintenance.scheduleNote")}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 font-medium">{t("admin.maintenance.columns.job")}</th>
            <th className="p-2 font-medium">{t("admin.maintenance.columns.frequency")}</th>
          </tr>
        </thead>
        <tbody>
          {SCHEDULE.map((row) => (
            <tr key={row.job} className="border-b">
              <td className="p-2">{row.job}</td>
              <td className="p-2">{row.freq}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
