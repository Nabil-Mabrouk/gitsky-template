import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Vue admin du module analytics (Chap 13) — trois agrégations en lecture
// seule (GET /api/admin/analytics/{world,paths,timeline}, require_admin
// côté API). Tables simples comme FleetGrid.tsx, pas de bibliothèque de
// graphique : ce round couvre juste la page manquante, les endpoints et
// leur agrégation SQL existent déjà et sont testés.
interface CountryCount {
  country_code: string | null;
  visits: number;
}
interface PathCount {
  path: string | null;
  visits: number;
}
interface DayCount {
  date: string;
  visits: number;
}

function useJson<T>(path: string): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    apiFetch(path).then(async (r) => {
      if (r.ok) setData((await r.json()) as T);
      else setError(true);
    });
  }, [path]);
  return { data, error };
}

export default function Analytics() {
  const { t } = useTranslation();
  const world = useJson<CountryCount[]>("/api/admin/analytics/world?days=30");
  const paths = useJson<PathCount[]>("/api/admin/analytics/paths?days=30&limit=20");
  const timeline = useJson<DayCount[]>("/api/admin/analytics/timeline?days=30");

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-bold">{t("admin.analytics.title")}</h1>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("admin.analytics.world.title")}</h2>
        {world.error && <p className="text-sm text-red-600">{t("admin.analytics.error")}</p>}
        {!world.error && !world.data && <p>{t("admin.analytics.loading")}</p>}
        {world.data && world.data.length === 0 && <p>{t("admin.analytics.empty")}</p>}
        {world.data && world.data.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 font-medium">{t("admin.analytics.world.country")}</th>
                <th className="p-2 font-medium">{t("admin.analytics.visits")}</th>
              </tr>
            </thead>
            <tbody>
              {world.data.map((row) => (
                <tr key={row.country_code ?? "unknown"} className="border-b">
                  <td className="p-2">{row.country_code ?? "—"}</td>
                  <td className="p-2">{row.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("admin.analytics.paths.title")}</h2>
        {paths.error && <p className="text-sm text-red-600">{t("admin.analytics.error")}</p>}
        {!paths.error && !paths.data && <p>{t("admin.analytics.loading")}</p>}
        {paths.data && paths.data.length === 0 && <p>{t("admin.analytics.empty")}</p>}
        {paths.data && paths.data.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 font-medium">{t("admin.analytics.paths.path")}</th>
                <th className="p-2 font-medium">{t("admin.analytics.visits")}</th>
              </tr>
            </thead>
            <tbody>
              {paths.data.map((row) => (
                <tr key={row.path ?? "unknown"} className="border-b">
                  <td className="p-2">{row.path ?? "—"}</td>
                  <td className="p-2">{row.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("admin.analytics.timeline.title")}</h2>
        {timeline.error && <p className="text-sm text-red-600">{t("admin.analytics.error")}</p>}
        {!timeline.error && !timeline.data && <p>{t("admin.analytics.loading")}</p>}
        {timeline.data && timeline.data.length === 0 && <p>{t("admin.analytics.empty")}</p>}
        {timeline.data && timeline.data.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 font-medium">{t("admin.analytics.timeline.date")}</th>
                <th className="p-2 font-medium">{t("admin.analytics.visits")}</th>
              </tr>
            </thead>
            <tbody>
              {timeline.data.map((row) => (
                <tr key={row.date} className="border-b">
                  <td className="p-2">{row.date}</td>
                  <td className="p-2">{row.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
