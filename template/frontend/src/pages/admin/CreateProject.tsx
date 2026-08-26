import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Wizard de création (Chap 27, Phase E) : nom + modules + GitHub + domaine ->
// POST /api/fleet/projects, qui génère le projet, l'enregistre, et (si
// demandé) crée/lie son dépôt GitHub avec un premier push (Chap 26). Un seul
// écran, pas d'étapes multiples avec barre de progression : l'endpoint est
// synchrone (pas de SSE/polling pour l'instant, Chap 27 §limites) — un
// template de taille raisonnable génère en quelques secondes.
type GithubMode = "skip" | "create" | "link";

interface CreateProjectResult {
  project: { name: string; domain: string | null; status: string };
  generated: boolean;
  github_repo: string | null;
  webhook_installed: boolean;
  pushed: boolean;
  deploy_triggered: boolean;
  warnings: string[];
}

export default function CreateProject() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [domain, setDomain] = useState("");
  const [githubMode, setGithubMode] = useState<GithubMode>("skip");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubPrivate, setGithubPrivate] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateProjectResult | null>(null);

  useEffect(() => {
    apiFetch("/api/fleet/module-catalog").then(async (r) => {
      if (r.ok) setCatalog((await r.json()) as string[]);
    });
  }, []);

  function toggleModule(key: string) {
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/fleet/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          modules,
          domain,
          github_mode: githubMode,
          github_repo: githubMode === "link" ? githubRepo : "",
          github_private: githubPrivate,
        }),
      });
      if (r.ok) {
        setResult((await r.json()) as CreateProjectResult);
      } else {
        const body = await r.json().catch(() => null);
        setError(body?.detail || t("fleet.create.genericError"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">{t("fleet.create.doneTitle")}</h1>
        <p className="mb-2 text-sm">
          <Link to={`/admin/fleet/${result.project.name}`} className="underline">
            {result.project.name}
          </Link>{" "}
          — {result.project.status}
        </p>
        <ul className="mb-4 text-sm text-black/60">
          <li>{result.generated ? t("fleet.create.summaryGenerated") : t("fleet.create.summaryNotGenerated")}</li>
          {result.github_repo && (
            <li>
              {t("fleet.create.summaryRepo")} <strong>{result.github_repo}</strong>
            </li>
          )}
          {result.github_repo && (
            <li>
              {result.webhook_installed
                ? t("fleet.create.summaryWebhookOk")
                : t("fleet.create.summaryWebhookMissing")}
            </li>
          )}
          {result.github_repo && (
            <li>{result.pushed ? t("fleet.create.summaryPushed") : t("fleet.create.summaryNotPushed")}</li>
          )}
          {result.deploy_triggered && <li>{t("fleet.create.summaryDeployTriggered")}</li>}
        </ul>
        {result.warnings.length > 0 && (
          <ul className="mb-4 text-sm text-amber-700">
            {result.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        )}
        <button
          onClick={() => navigate(`/admin/fleet/${result.project.name}`)}
          className="rounded p-2 text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {t("fleet.create.goToProject")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <Link to="/admin/fleet" className="mb-4 inline-block text-sm">
        {t("fleet.actions.back")}
      </Link>
      <h1 className="mb-4 text-2xl font-bold">{t("fleet.create.title")}</h1>
      <form onSubmit={submit} className="grid max-w-lg gap-4">
        <label className="grid gap-1 text-sm">
          {t("fleet.create.nameLabel")}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fleet.create.namePlaceholder")}
            className="rounded border p-2"
            required
          />
        </label>

        <fieldset className="grid gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("fleet.create.modulesLabel")}</legend>
          {catalog.map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(modules[key])}
                onChange={() => toggleModule(key)}
              />
              {key}
            </label>
          ))}
        </fieldset>

        <label className="grid gap-1 text-sm">
          {t("fleet.create.domainLabel")}
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={name ? `${name}.mystudio.com` : "mon-projet.mystudio.com"}
            className="rounded border p-2"
          />
        </label>

        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">{t("fleet.create.githubLabel")}</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="github_mode"
              checked={githubMode === "skip"}
              onChange={() => setGithubMode("skip")}
            />
            {t("fleet.create.githubSkip")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="github_mode"
              checked={githubMode === "create"}
              onChange={() => setGithubMode("create")}
            />
            {t("fleet.create.githubCreate")}
          </label>
          {githubMode === "create" && (
            <label className="ml-6 flex items-center gap-2">
              <input
                type="checkbox"
                checked={githubPrivate}
                onChange={(e) => setGithubPrivate(e.target.checked)}
              />
              {t("fleet.create.githubPrivate")}
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="github_mode"
              checked={githubMode === "link"}
              onChange={() => setGithubMode("link")}
            />
            {t("fleet.create.githubLink")}
          </label>
          {githubMode === "link" && (
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder={t("fleet.create.githubLinkPlaceholder")}
              className="ml-6 rounded border p-2"
              required
            />
          )}
        </fieldset>

        <button
          disabled={submitting}
          className="rounded p-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {submitting ? t("fleet.create.submitting") : t("fleet.create.submit")}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
