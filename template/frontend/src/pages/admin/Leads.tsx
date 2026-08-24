import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Onglet Leads (Chap 19) — liste brute des emails captés par un projet T0
// via GET /api/fleet/projects/{name}/leads (proxy vers le landing collector
// partagé, require_admin côté API). Complète le compte agrégé déjà présent
// sur la grille Flotte, sans le remplacer.
interface FleetProject {
  name: string;
  tier: string;
}

interface Lead {
  id: number;
  email: string;
  source: string | null;
  created_at: string | null;
}

export default function Leads() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<FleetProject[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/api/fleet/projects").then(async (r) => {
      if (!r.ok) return;
      const all = (await r.json()) as FleetProject[];
      const t0 = all.filter((p) => p.tier === "t0");
      setProjects(t0);
      if (t0.length > 0) setSelected(t0[0].name);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLeads(null);
    setError(false);
    apiFetch(`/api/fleet/projects/${selected}/leads`).then(async (r) => {
      if (r.ok) setLeads((await r.json()) as Lead[]);
      else setError(true);
    });
  }, [selected]);

  if (!projects) return <p>{t("admin.leads.loading")}</p>;
  if (projects.length === 0) return <p>{t("admin.leads.noProjects")}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin.leads.title")}</h1>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mb-4 rounded border p-1 text-sm"
      >
        {projects.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{t("admin.leads.error")}</p>}
      {!error && leads === null && <p>{t("admin.leads.loading")}</p>}
      {!error && leads !== null && leads.length === 0 && <p>{t("admin.leads.empty")}</p>}
      {!error && leads !== null && leads.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 font-medium">{t("admin.leads.columns.email")}</th>
              <th className="p-2 font-medium">{t("admin.leads.columns.source")}</th>
              <th className="p-2 font-medium">{t("admin.leads.columns.date")}</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
