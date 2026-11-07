import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_URL ?? "";

// Page publique reçue par lien email (Chap 7bis) — même patron que
// AcceptInvite.tsx : POST /api/auth/reset-password définit le nouveau mot
// de passe et connecte directement.
//
// Garde anti-double-submit + distinction service inaccessible (fetch qui
// rejette) / erreur applicative (lien invalide) — trou réel trouvé par
// l'agent dev de f-ynd (2026-11-07) : res.ok était bien vérifié, mais rien
// n'entourait l'appel fetch lui-même, une erreur réseau pure restait non
// gérée (promesse rejetée non gérée, formulaire figé).
export default function ResetPassword() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (password !== confirm || password.length < 8) {
      setError(true);
      return;
    }
    submitting.current = true;
    setPending(true);
    setError(false);
    setUnavailable(false);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = (await res.json()) as { access_token: string };
      localStorage.setItem("access_token", data.access_token);
      await refreshUser();
      navigate("/learn");
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
        <h1 className="text-2xl font-bold">{t("auth.resetPassword.title")}</h1>
        <input
          className="rounded border p-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.resetPassword.password")}
        />
        <input
          className="rounded border p-2"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("auth.resetPassword.confirm")}
        />
        {error && <p className="text-sm text-red-600">{t("auth.resetPassword.error")}</p>}
        {unavailable && <p className="text-sm text-red-600">{t("auth.resetPassword.unavailable")}</p>}
        <button
          disabled={pending}
          className="rounded p-2 font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {t("auth.resetPassword.submit")}
        </button>
      </form>
    </div>
  );
}
