import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api";
import "../learn.css";

interface LessonSummary {
  id: number;
  title: string;
  order: number;
}

interface TutorialDetailData {
  id: number;
  title: string;
  slug: string;
  lang: string;
  access_role: string;
  lessons: LessonSummary[];
}

// /learn/:slug n'affiche plus elle-même la liste des leçons (Chap 11, round
// navigation) : ce sommaire vit maintenant dans TutorialSidebar, visible en
// permanence pendant la lecture. Cette route se contente de rediriger vers
// la première leçon — GET /api/content/tutorials/{slug} reste public, le
// contrôle d'accès réel se fait par leçon (LessonView).
export default function TutorialDetail() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [tutorial, setTutorial] = useState<TutorialDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setTutorial(null);
    setNotFound(false);
    apiFetch(`/api/content/tutorials/${slug}`).then(async (r) => {
      if (r.ok) setTutorial((await r.json()) as TutorialDetailData);
      else setNotFound(true);
    });
  }, [slug]);

  if (notFound)
    return (
      <section className="learn-catalogue">
        <p className="empty">{t("learn.detail.notFound")}</p>
      </section>
    );
  if (!tutorial)
    return (
      <section className="learn-catalogue">
        <p className="empty">{t("learn.detail.loading")}</p>
      </section>
    );

  const first = [...tutorial.lessons].sort((a, b) => a.order - b.order)[0];
  if (first) {
    return <Navigate to={`/learn/${tutorial.slug}/lessons/${first.id}`} replace />;
  }

  return (
    <section className="learn-catalogue">
      <Link to="/learn" className="tutorial-sidebar-back">
        {t("learn.detail.back")}
      </Link>
      <h1>{tutorial.title}</h1>
      <p className="empty">{t("learn.empty")}</p>
    </section>
  );
}
