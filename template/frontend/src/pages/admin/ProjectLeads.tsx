import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Onglet Leads-projet (module_leads) — DISTINCT de Leads.tsx (fleet,
// cross-projets) : celui-ci ne montre que les leads DE ce projet, via
// GET /api/leads (jamais /api/fleet/...). Aucune donnée locale : la liste
// vient d'un appel au landing collector partagé côté backend.
interface Lead {
  id: number;
  email: string;
  source: string | null;
  created_at: string | null;
  verified: boolean;
}

export default function ProjectLeads() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  function load() {
    setLeads(null);
    setError(false);
    apiFetch("/api/leads").then(async (r) => {
      if (r.ok) setLeads((await r.json()) as Lead[]);
      else setError(true);
    });
  }

  useEffect(load, []);

  async function convert(email: string) {
    setConverting(email);
    const r = await apiFetch("/api/leads/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setConverting(null);
    if (r.ok) alert(t("admin.projectLeads.converted", { email }));
    else alert(t("admin.projectLeads.convertError"));
  }

  if (error) return <p className="text-sm text-red-600">{t("admin.projectLeads.error")}</p>;
  if (leads === null) return <p>{t("admin.projectLeads.loading")}</p>;
  if (leads.length === 0) return <p>{t("admin.projectLeads.empty")}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin.projectLeads.title")}</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 font-medium">{t("admin.projectLeads.columns.email")}</th>
            <th className="p-2 font-medium">{t("admin.projectLeads.columns.source")}</th>
            <th className="p-2 font-medium">{t("admin.projectLeads.columns.date")}</th>
            <th className="p-2 font-medium">{t("admin.projectLeads.columns.verified")}</th>
            <th className="p-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b">
              <td className="p-2">{lead.email}</td>
              <td className="p-2">{lead.source || "—"}</td>
              <td className="p-2">
                {lead.created_at ? new Date(lead.created_at).toLocaleString() : "—"}
              </td>
              <td className="p-2">{lead.verified ? "✓" : "—"}</td>
              <td className="p-2">
                <button
                  onClick={() => convert(lead.email)}
                  disabled={converting === lead.email}
                  className="rounded border px-2 py-1 text-xs"
                >
                  {t("admin.projectLeads.convert")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
