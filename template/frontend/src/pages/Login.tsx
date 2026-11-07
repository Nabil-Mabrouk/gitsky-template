import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

// Garde anti-double-submit (submitting ref) + distinction erreur applicative
// (identifiants invalides) / service inaccessible (fetch qui rejette, ex.
// coupure réseau) — trou réel trouvé par l'agent dev de f-ynd (2026-11-07) :
// ces 5 pages n'avaient aucun try/catch autour de leur appel réseau, le
// formulaire restait figé sans retour en cas d'échec réseau pur.
export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(false);
    setUnavailable(false);
    try {
      if (await login(email, password)) navigate("/learn");
      else setError(true);
    } catch {
      setUnavailable(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <form onSubmit={onSubmit} className="grid w-full max-w-sm gap-3">
        <h1 className="text-2xl font-bold">{t("auth.login.title")}</h1>
        <input
          className="rounded border p-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.login.email")}
        />
        <input
          className="rounded border p-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.login.password")}
        />
        {error && <p className="text-sm text-red-600">{t("auth.login.error")}</p>}
        {unavailable && <p className="text-sm text-red-600">{t("auth.login.unavailable")}</p>}
        <button
          disabled={pending}
          className="rounded p-2 font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {t("auth.login.submit")}
        </button>
        <Link to="/forgot-password" className="text-sm underline">
          {t("auth.login.forgot")}
        </Link>
      </form>
    </div>
  );
}
