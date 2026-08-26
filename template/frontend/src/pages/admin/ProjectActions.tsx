import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Détail projet — onglet Actions (Chap 19). Réutilise l'endpoint promote déjà
// existant (POST /api/fleet/projects/{name}/promote) — aucun changement
// backend. Pas d'endpoint GET /projects/{name} dédié : on filtre la liste
// déjà exposée par GET /api/fleet/projects, comme MAINTENANCE.md's Round 3
// n'a pas ajouté de nouvel endpoint de lecture non plus quand un existant
// suffisait.
interface FleetProject {
  name: string;
  domain: string | null;
  status: string;
  publish_status: string;
  github_repo: string | null;
  github_webhook_installed: boolean;
}

interface GithubRepoResult {
  repo: string;
  html_url: string;
  webhook_installed: boolean;
  message: string;
}

export default function ProjectActions() {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const [project, setProject] = useState<FleetProject | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [guardrailsPass, setGuardrailsPass] = useState(true);
  const [humanApproved, setHumanApproved] = useState(false);
  const [promoteResult, setPromoteResult] = useState<
    { allowed: boolean; reason: string; publish_status: string } | null
  >(null);
  const [archived, setArchived] = useState(false);

  const [linkRepoInput, setLinkRepoInput] = useState("");
  const [githubResult, setGithubResult] = useState<GithubRepoResult | null>(null);

  useEffect(() => {
    apiFetch("/api/fleet/projects").then(async (r) => {
      if (!r.ok) return;
      const all = (await r.json()) as FleetProject[];
      const found = all.find((p) => p.name === name) ?? null;
      setProject(found);
      setNotFound(found === null);
    });
  }, [name]);

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

  async function submitArchive() {
    const r = await apiFetch(`/api/fleet/projects/${name}/archive`, { method: "POST" });
    if (r.ok) {
      const result = await r.json();
      setProject((p) => (p ? { ...p, status: result.status } : p));
      setArchived(true);
    }
  }

  async function submitCreateRepo() {
    const r = await apiFetch(`/api/fleet/projects/${name}/github/create-repo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ private: true }),
    });
    if (r.ok) {
      const result = (await r.json()) as GithubRepoResult;
      setGithubResult(result);
      setProject((p) =>
        p ? { ...p, github_repo: result.repo, github_webhook_installed: result.webhook_installed } : p
      );
    }
  }

  async function submitLinkRepo(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch(`/api/fleet/projects/${name}/github/link-repo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: linkRepoInput }),
    });
    if (r.ok) {
      const result = (await r.json()) as GithubRepoResult;
      setGithubResult(result);
      setProject((p) =>
        p ? { ...p, github_repo: result.repo, github_webhook_installed: result.webhook_installed } : p
      );
    }
  }

  if (notFound) return <p className="text-sm text-red-600">{t("fleet.actions.notFound")}</p>;
  if (!project) return <p>{t("fleet.actions.loading")}</p>;

  return (
    <div>
      <Link to="/admin/fleet" className="mb-4 inline-block text-sm">
        {t("fleet.actions.back")}
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{project.name}</h1>
      <p className="mb-4 text-sm text-black/60">
        {project.status} · {project.publish_status}
      </p>

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

      <h2 className="mb-2 mt-6 text-lg font-semibold">{t("fleet.actions.archiveTitle")}</h2>
      {project.status === "archived" ? (
        <p className="text-sm text-black/60">{t("fleet.actions.alreadyArchived")}</p>
      ) : (
        <button
          onClick={submitArchive}
          className="rounded bg-red-700 p-2 text-sm font-medium text-white"
        >
          {t("fleet.actions.runArchive")}
        </button>
      )}
      {archived && <p className="mt-2 text-sm">{t("fleet.actions.archived")}</p>}

      <h2 className="mb-2 mt-6 text-lg font-semibold">{t("fleet.actions.githubTitle")}</h2>
      {project.github_repo ? (
        <p className="mb-2 text-sm">
          {t("fleet.actions.githubRepoLinked")} <strong>{project.github_repo}</strong>
          <br />
          <span className="text-black/60">
            {project.github_webhook_installed
              ? t("fleet.actions.githubWebhookOk")
              : t("fleet.actions.githubWebhookMissing")}
          </span>
        </p>
      ) : (
        <p className="mb-2 text-sm text-black/60">{t("fleet.actions.githubNoRepo")}</p>
      )}
      <button
        onClick={submitCreateRepo}
        className="mb-3 rounded p-2 text-sm font-medium text-white"
        style={{ background: "var(--color-primary)" }}
      >
        {t("fleet.actions.githubCreateRepo")}
      </button>
      <form onSubmit={submitLinkRepo} className="grid max-w-sm gap-2">
        <label className="text-sm">{t("fleet.actions.githubLinkRepoLabel")}</label>
        <input
          type="text"
          value={linkRepoInput}
          onChange={(e) => setLinkRepoInput(e.target.value)}
          placeholder={t("fleet.actions.githubLinkRepoPlaceholder")}
          className="rounded border p-2 text-sm"
        />
        <button className="rounded border p-2 text-sm font-medium">
          {t("fleet.actions.githubLinkRepo")}
        </button>
      </form>
      {githubResult && githubResult.message && (
        <p className="mt-2 text-sm text-black/60">{githubResult.message}</p>
      )}
    </div>
  );
}
