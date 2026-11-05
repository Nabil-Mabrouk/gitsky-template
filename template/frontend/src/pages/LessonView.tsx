import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch } from "../api";
import TutorialSidebar, { type LessonSummary } from "../components/learn/TutorialSidebar";
import "../learn.css";

interface LessonData {
  id: number;
  title: string;
  order: number;
  content: string;
}

interface TutorialSummaryData {
  title: string;
  slug: string;
  lessons: LessonSummary[];
}

type LoadState = "loading" | "ok" | "not_found" | "unauthorized" | "forbidden";

// Contenu d'une leçon (Chap 11) — le contrôle d'accès est fait côté API
// (401 non connecté, 403 rôle insuffisant) : ce composant ne fait que
// refléter ces réponses, jamais sa propre logique de permission.
//
// Round navigation : la leçon se lit maintenant à côté d'un sommaire
// persistant (TutorialSidebar) plutôt qu'en allers-retours vers /learn/:slug
// à chaque leçon — deux requêtes en parallèle (tutoriel pour le sommaire,
// leçon pour le contenu), le sommaire reste affiché même si la leçon ciblée
// est en erreur (401/403/404).
export default function LessonView() {
  const { t } = useTranslation();
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const [tutorial, setTutorial] = useState<TutorialSummaryData | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    apiFetch(`/api/content/tutorials/${slug}`).then(async (r) => {
      if (r.ok) setTutorial((await r.json()) as TutorialSummaryData);
    });
  }, [slug]);

  useEffect(() => {
    setLesson(null);
    setState("loading");
    apiFetch(`/api/content/tutorials/${slug}/lessons/${lessonId}`).then(async (r) => {
      if (r.ok) {
        setLesson((await r.json()) as LessonData);
        setState("ok");
      } else if (r.status === 401) setState("unauthorized");
      else if (r.status === 403) setState("forbidden");
      else setState("not_found");
    });
  }, [slug, lessonId]);

  const sidebar = tutorial && (
    <TutorialSidebar
      tutorialTitle={tutorial.title}
      slug={tutorial.slug}
      lessons={tutorial.lessons}
      activeLessonId={lesson?.id}
    />
  );

  const backLink = (
    <Link to={`/learn/${slug}`} className="tutorial-sidebar-back">
      {t("learn.detail.back")}
    </Link>
  );

  if (state !== "ok") {
    const message =
      state === "loading" ? (
        t("learn.detail.loading")
      ) : state === "unauthorized" ? (
        <>
          {t("learn.lesson.unauthorized")} <Link to="/login">{t("nav.login")}</Link>
        </>
      ) : state === "forbidden" ? (
        t("learn.lesson.forbidden")
      ) : (
        t("learn.detail.notFound")
      );
    return (
      <div className="tutorial-shell">
        {sidebar}
        <article className="tutorial-content">
          {!sidebar && backLink}
          <p className="empty">{message}</p>
        </article>
      </div>
    );
  }

  const sorted = tutorial ? [...tutorial.lessons].sort((a, b) => a.order - b.order) : [];
  const index = sorted.findIndex((l) => l.id === lesson!.id);
  const previous = index > 0 ? sorted[index - 1] : null;
  const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null;

  return (
    <div className="tutorial-shell">
      {sidebar}
      <article className="tutorial-content">
        {sorted.length > 0 && (
          <p className="tutorial-progress">
            {t("learn.lesson.progress", { current: index + 1, total: sorted.length })}
          </p>
        )}
        <h1>{lesson!.title}</h1>
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson!.content}</ReactMarkdown>
        </div>
        {(previous || next) && (
          <nav className="lesson-pager" aria-label={t("learn.lesson.progress", { current: index + 1, total: sorted.length })}>
            {previous ? (
              <Link to={`/learn/${slug}/lessons/${previous.id}`}>
                <span className="lesson-pager-label">{t("learn.lesson.previous")}</span>
                {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/learn/${slug}/lessons/${next.id}`} className="next">
                <span className="lesson-pager-label">{t("learn.lesson.next")}</span>
                {next.title}
              </Link>
            )}
          </nav>
        )}
      </article>
    </div>
  );
}
