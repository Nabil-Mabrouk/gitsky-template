import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

// Sert à la fois le changement forcé (must_change_password, Chap 7bis —
// redirigé ici par PasswordGate dans App.tsx) et le changement volontaire :
// même formulaire, la bannière ci-dessous ne s'affiche que dans le premier
// cas. PATCH /api/auth/change-password révoque les sessions précédentes et
// renvoie un nouvel access token — il faut le stocker ici comme après un
// login normal, sinon les appels suivants échouent avec l'ancien jeton.
//
// Garde anti-double-submit + distinction service inaccessible (fetch qui
// rejette) / erreur applicative — trou réel trouvé par l'agent dev de f-ynd
// (2026-11-07) : res.ok était bien vérifié, mais rien n'entourait l'appel
// réseau lui-même, une erreur réseau pure restait non gérée.
export default function ChangePassword() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (password !== confirm || password.length < 8) {
      setError(t("auth.changePassword.mismatch"));
      return;
    }
    submitting.current = true;
    setPending(true);
    setError(null);
    setUnavailable(false);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: password }),
      });
      if (!res.ok) {
        setError(t("auth.changePassword.error"));
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
        <h1 className="text-2xl font-bold">{t("auth.changePassword.title")}</h1>
        {user?.must_change_password && (
          <p className="text-sm text-black/60">{t("auth.changePassword.forcedNotice")}</p>
        )}
        <input
          className="rounded border p-2"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={t("auth.changePassword.current")}
        />
        <input
          className="rounded border p-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.changePassword.new")}
        />
        <input
          className="rounded border p-2"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("auth.changePassword.confirm")}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {unavailable && <p className="text-sm text-red-600">{t("auth.changePassword.unavailable")}</p>}
        <button
          disabled={pending}
          className="rounded p-2 font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {t("auth.changePassword.submit")}
        </button>
      </form>
    </div>
  );
}
