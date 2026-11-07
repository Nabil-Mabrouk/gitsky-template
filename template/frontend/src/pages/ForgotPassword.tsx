import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

const API = import.meta.env.VITE_API_URL ?? "";

// Page publique (Chap 7bis) — /api/auth/forgot-password répond toujours 202,
// que l'email corresponde à un compte ou non : le message affiché ici ne
// doit donc jamais varier selon la réponse (pas de fuite d'existence).
//
// Garde anti-double-submit + distinction service inaccessible (fetch qui
// rejette) / succès — trou réel trouvé par l'agent dev de f-ynd (2026-11-07) :
// setSent(true) était appelé sans jamais vérifier que la requête avait
// réussi, et une erreur réseau pure (fetch rejeté) n'était interceptée nulle
// part (promesse rejetée non gérée, formulaire figé sans retour).
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setUnavailable(false);
    try {
      await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setUnavailable(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      {sent ? (
        <p className="w-full max-w-sm text-sm">{t("auth.forgotPassword.sent")}</p>
      ) : (
        <form onSubmit={onSubmit} className="grid w-full max-w-sm gap-3">
          <h1 className="text-2xl font-bold">{t("auth.forgotPassword.title")}</h1>
          <p className="text-sm text-black/60">{t("auth.forgotPassword.subtitle")}</p>
          <input
            className="rounded border p-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.forgotPassword.email")}
          />
          {unavailable && <p className="text-sm text-red-600">{t("auth.forgotPassword.unavailable")}</p>}
          <button
            disabled={pending}
            className="rounded p-2 font-medium text-white"
            style={{ background: "var(--color-primary)" }}
          >
            {t("auth.forgotPassword.submit")}
          </button>
        </form>
      )}
    </div>
  );
}
