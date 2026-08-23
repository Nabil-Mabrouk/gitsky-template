import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Vue admin du module security (Chap 14) — synthèse par sévérité +
// journal des événements (GET /api/admin/security/{summary,events},
// require_admin côté API). Page manquante, endpoints déjà testés.
interface SecuritySummary {
  total: number;
  by_severity: Record<string, number>;
}
interface SecurityEvent {
  id: number;
  event_type: string;
  severity: string;
  ip_address: string | null;
  path: string | null;
  created_at: string | null;
}

const SEVERITIES = ["critical", "high", "medium", "low"];

export default function Security() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [eventsError, setEventsError] = useState(false);
  const [severity, setSeverity] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/security/summary").then(async (r) => {
      if (r.ok) setSummary((await r.json()) as SecuritySummary);
      else setSummaryError(true);
    });
  }, []);

  useEffect(() => {
    const qs = severity ? `?severity=${severity}` : "";
    apiFetch(`/api/admin/security/events${qs}`).then(async (r) => {
      if (r.ok) setEvents((await r.json()) as SecurityEvent[]);
      else setEventsError(true);
    });
  }, [severity]);

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-bold">{t("admin.security.title")}</h1>

      <section>
        {summaryError && <p className="text-sm text-red-600">{t("admin.security.error")}</p>}
        {!summaryError && !summary && <p>{t("admin.security.loading")}</p>}
        {summary && (
          <div className="flex gap-4">
            <div className="rounded border p-3">
              <div className="text-xs uppercase text-black/60">{t("admin.security.total")}</div>
              <div className="text-xl font-bold">{summary.total}</div>
            </div>
            {SEVERITIES.filter((sev) => summary.by_severity[sev]).map((sev) => (
              <div key={sev} className="rounded border p-3">
                <div className="text-xs uppercase text-black/60">{sev}</div>
                <div className="text-xl font-bold">{summary.by_severity[sev]}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t("admin.security.events.title")}</h2>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded border p-1 text-sm"
          >
            <option value="">{t("admin.security.events.allSeverities")}</option>
            {SEVERITIES.map((sev) => (
              <option key={sev} value={sev}>
                {sev}
              </option>
            ))}
          </select>
        </div>
        {eventsError && <p className="text-sm text-red-600">{t("admin.security.error")}</p>}
        {!eventsError && !events && <p>{t("admin.security.loading")}</p>}
        {events && events.length === 0 && <p>{t("admin.security.events.empty")}</p>}
        {events && events.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 font-medium">{t("admin.security.events.columns.type")}</th>
                <th className="p-2 font-medium">{t("admin.security.events.columns.severity")}</th>
                <th className="p-2 font-medium">{t("admin.security.events.columns.ip")}</th>
                <th className="p-2 font-medium">{t("admin.security.events.columns.path")}</th>
                <th className="p-2 font-medium">{t("admin.security.events.columns.date")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b">
                  <td className="p-2">{ev.event_type}</td>
                  <td className="p-2">{ev.severity}</td>
                  <td className="p-2">{ev.ip_address ?? "—"}</td>
                  <td className="p-2">{ev.path ?? "—"}</td>
                  <td className="p-2">{ev.created_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
