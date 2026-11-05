import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface LessonSummary {
  id: number;
  title: string;
  order: number;
}

interface Props {
  tutorialTitle: string;
  slug: string;
  lessons: LessonSummary[];
  activeLessonId?: number;
}

// Sommaire persistant pendant la lecture (TutorialDetail + LessonView) —
// avant, il fallait revenir en arrière pour voir la liste des leçons, ce qui
// faisait perdre le contexte du tutoriel en cours (retour utilisateur).
export default function TutorialSidebar({ tutorialTitle, slug, lessons, activeLessonId }: Props) {
  const { t } = useTranslation();
  const sorted = [...lessons].sort((a, b) => a.order - b.order);

  return (
    <nav className="tutorial-sidebar" aria-label={tutorialTitle}>
      <Link to="/learn" className="tutorial-sidebar-back">
        {t("learn.detail.back")}
      </Link>
      <h2 className="tutorial-sidebar-title">{tutorialTitle}</h2>
      <ol>
        {sorted.map((lesson, i) => (
          <li key={lesson.id}>
            <Link
              to={`/learn/${slug}/lessons/${lesson.id}`}
              className={lesson.id === activeLessonId ? "active" : undefined}
              aria-current={lesson.id === activeLessonId ? "page" : undefined}
            >
              <span className="tutorial-sidebar-index">{i + 1}</span>
              {lesson.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
