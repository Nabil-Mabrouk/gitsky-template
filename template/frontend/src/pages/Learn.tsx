import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api";
import "../learn.css";

interface Tutorial {
  id: number;
  title: string;
  slug: string;
  lang: string;
  access_role: string;
}

// Catalogue public : ne montre que les cours de la langue courante (Chap 11).
export default function Learn() {
  const { t, i18n } = useTranslation();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);

  useEffect(() => {
    const lang = i18n.language.split("-")[0];
    apiFetch(`/api/content/tutorials?lang=${lang}`).then(async (r) => {
      if (r.ok) setTutorials((await r.json()) as Tutorial[]);
    });
  }, [i18n.language]);

  return (
    <section className="learn-catalogue">
      <h1>{t("learn.title")}</h1>
      <ul>
        {tutorials.map((tut) => (
          <li key={tut.id}>
            <Link to={`/learn/${tut.slug}`}>
              {tut.title}
              {tut.access_role !== "anonymous" && (
                <span className="badge-premium">{t("learn.premium")}</span>
              )}
            </Link>
          </li>
        ))}
        {tutorials.length === 0 && <li className="empty">{t("learn.empty")}</li>}
      </ul>
    </section>
  );
}
