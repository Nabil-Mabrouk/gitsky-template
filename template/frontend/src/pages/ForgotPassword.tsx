import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

const API = import.meta.env.VITE_API_URL ?? "";

// Page publique (Chap 7bis) — /api/auth/forgot-password répond toujours 202,
// que l'email corresponde à un compte ou non : le message affiché ici ne
// doit donc jamais varier selon la réponse (pas de fuite d'existence).
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await fetch(`${API}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  }

  if (sent) {
    return <p className="max-w-sm text-sm">{t("auth.forgotPassword.sent")}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-sm gap-3">
      <h1 className="text-2xl font-bold">{t("auth.forgotPassword.title")}</h1>
      <p className="text-sm text-black/60">{t("auth.forgotPassword.subtitle")}</p>
      <input
        className="rounded border p-2"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.forgotPassword.email")}
      />
      <button
        className="rounded p-2 font-medium text-white"
        style={{ background: "var(--color-primary)" }}
      >
        {t("auth.forgotPassword.submit")}
      </button>
    </form>
  );
}
