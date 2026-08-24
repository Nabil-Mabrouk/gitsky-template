import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Onglet Waitlist (Chap 9, shell) — envoyer/renvoyer une invitation en un
// clic à un compte role=waitlist. POST /api/admin/users/{id}/invite,
// require_admin côté API ; l'endpoint accepte aussi bien un premier envoi
// qu'un renvoi (pas de distinction côté API ni ici).
interface UserRow {
  id: number;
  email: string;
}

export default function Waitlist() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState(false);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    apiFetch("/api/admin/users?role=waitlist").then(async (r) => {
      if (r.ok) setUsers((await r.json()) as UserRow[]);
      else setError(true);
    });
  }, []);

  async function invite(id: number) {
    const r = await apiFetch(`/api/admin/users/${id}/invite`, { method: "POST" });
    if (r.ok) setSentIds((prev) => new Set(prev).add(id));
  }

  if (error) return <p className="text-sm text-red-600">{t("admin.waitlist.error")}</p>;
  if (!users) return <p>{t("admin.waitlist.loading")}</p>;
  if (users.length === 0) return <p>{t("admin.waitlist.empty")}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin.waitlist.title")}</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 font-medium">{t("admin.waitlist.columns.email")}</th>
            <th className="p-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.email}</td>
              <td className="p-2">
                <button
                  onClick={() => invite(u.id)}
                  className="rounded border p-1 text-sm hover:bg-black/5"
                >
                  {sentIds.has(u.id) ? t("admin.waitlist.sent") : t("admin.waitlist.invite")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
