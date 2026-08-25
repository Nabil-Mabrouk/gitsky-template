import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Détail projet — onglet Actions (Chap 19/20). Réutilise les endpoints
// kill-check/promote déjà existants (POST /api/fleet/projects/{name}/
// kill-check, .../promote) — aucun changement backend, "cheap win" du
// Round 4. Pas d'endpoint GET /projects/{name} dédié : on filtre la liste
// déjà exposée par GET /api/fleet/projects, comme MAINTENANCE.md's Round 3
// n'a pas ajouté de nouvel endpoint de lecture non plus quand un existant
// suffisait.
interface FleetProject {
  name: string;
  tier: string;
  domain: string | null;
  status: string;
  publish_status: string;
}

// Champs pertinents par tier — kill_check.py n'utilise que ce sous-ensemble
// pour évaluer chaque tier (evaluate_t0/t1/t2), inutile d'afficher les 13
// champs du schéma pour un projet qui n'en consulte que 3 à 6.
const FIELDS_BY_TIER: Record<string, string[]> = {
  t0: [
    "days_since_deploy",
    "signup_count",
    "visit_count",
    "conversion_rate",
    "qualitative_feedback_count",
    "total_cost",
  ],
  t1: [
    "days_since_deploy",
    "active_users_last_7d",
    "retention_d7",
    "paid_users_count",
    "wtp_declarations",
    "total_cost",
  ],
  t2: ["mrr", "churn_rate_3m", "days_below_mrr_threshold"],
};

const DEFAULT_METRICS: Record<string, number> = {
  days_since_deploy: 0,
  signup_count: 0,
  visit_count: 0,
  conversion_rate: 0,
  qualitative_feedback_count: 0,
  total_cost: 0,
  active_users_last_7d: 0,
  retention_d7: 0,
  paid_users_count: 0,
  wtp_declarations: 0,
  mrr: 0,
  churn_rate_3m: 0,
  days_below_mrr_threshold: 0,
};

export default function ProjectActions() {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const [project, setProject] = useState<FleetProject | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [metrics, setMetrics] = useState<Record<string, number>>(DEFAULT_METRICS);
  const [killResult, setKillResult] = useState<{ verdict: string; status: string } | null>(null);

  const [guardrailsPass, setGuardrailsPass] = useState(true);
  const [humanApproved, setHumanApproved] = useState(false);
  const [promoteResult, setPromoteResult] = useState<
    { allowed: boolean; reason: string; publish_status: string } | null
  >(null);

  useEffect(() => {
    apiFetch("/api/fleet/projects").then(async (r) => {
      if (!r.ok) return;
      const all = (await r.json()) as FleetProject[];
      const found = all.find((p) => p.name === name) ?? null;
      setProject(found);
      setNotFound(found === null);
    });
  }, [name]);

  async function submitKillCheck(e: FormEvent) {
    e.preventDefault();
    setKillResult(null);
    const r = await apiFetch(`/api/fleet/projects/${name}/kill-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
    });
    if (r.ok) setKillResult(await r.json());
  }

  async function submitPromote(e: FormEvent) {
    e.preventDefault();
    setPromoteResult(null);
    const r = await apiFetch(`/api/fleet/projects/${name}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardrails_pass: guardrailsPass, human_approved: humanApproved }),
    });
    if (r.ok) {
      const result = await r.json();
      setPromoteResult(result);
      setProject((p) => (p ? { ...p, publish_status: result.publish_status } : p));
    }
  }

  if (notFound) return <p className="text-sm text-red-600">{t("fleet.actions.notFound")}</p>;
  if (!project) return <p>{t("fleet.actions.loading")}</p>;

  const fields = FIELDS_BY_TIER[project.tier] ?? [];

  return (
    <div>
      <Link to="/admin/fleet" className="mb-4 inline-block text-sm">
        {t("fleet.actions.back")}
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{project.name}</h1>
      <p className="mb-4 text-sm text-black/60">
        {project.tier.toUpperCase()} · {project.status} · {project.publish_status}
      </p>

      <h2 className="mb-2 text-lg font-semibold">{t("fleet.actions.killCheckTitle")}</h2>
      <form onSubmit={submitKillCheck} className="mb-2 grid max-w-sm gap-2">
        {fields.map((field) => (
          <label key={field} className="flex items-center justify-between gap-2 text-sm">
            {t(`fleet.actions.fields.${field}`)}
            <input
              type="number"
              step="any"
              value={metrics[field]}
              onChange={(e) =>
                setMetrics((m) => ({ ...m, [field]: Number(e.target.value) }))
              }
              className="w-28 rounded border p-1 text-sm"
            />
          </label>
        ))}
        <button
          className="rounded p-2 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {t("fleet.actions.runKillCheck")}
        </button>
      </form>
      {killResult && (
        <p className="mb-6 text-sm">
          {t("fleet.actions.verdict")}: <strong>{killResult.verdict}</strong> —{" "}
          {t("fleet.actions.newStatus")}: <strong>{killResult.status}</strong>
        </p>
      )}

      <h2 className="mb-2 text-lg font-semibold">{t("fleet.actions.promoteTitle")}</h2>
      <form onSubmit={submitPromote} className="mb-2 grid max-w-sm gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={guardrailsPass}
            onChange={(e) => setGuardrailsPass(e.target.checked)}
          />
          {t("fleet.actions.guardrailsPass")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={humanApproved}
            onChange={(e) => setHumanApproved(e.target.checked)}
          />
          {t("fleet.actions.humanApproved")}
        </label>
        <button
          className="rounded p-2 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {t("fleet.actions.runPromote")}
        </button>
      </form>
      {promoteResult && (
        <p className="text-sm">
          {promoteResult.allowed
            ? `${t("fleet.actions.promoted")} ${promoteResult.publish_status}`
            : `${t("fleet.actions.notPromoted")} ${promoteResult.reason}`}
        </p>
      )}
    </div>
  );
}
