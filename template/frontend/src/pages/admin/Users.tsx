import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../api";

// Onglet Utilisateurs (Chap 9, shell) — modifier le rôle d'un compte ou
// suspendre son accès. GET/PATCH /api/admin/users, require_admin côté API.
const ROLES = ["anonymous", "waitlist", "user", "premium", "admin"] as const;

interface UserRow {
  id: number;
  email: string;
  role: (typeof ROLES)[number];
  is_active: boolean;
}

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/users").then(async (r) => {
      if (r.ok) setUsers((await r.json()) as UserRow[]);
      else setError(true);
    });
  }, []);

  async function updateUser(id: number, patch: Partial<Pick<UserRow, "role" | "is_active">>) {
    const r = await apiFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      const updated = (await r.json()) as UserRow;
      setUsers((prev) => prev?.map((u) => (u.id === id ? updated : u)) ?? prev);
    }
  }

  if (error) return <p className="text-sm text-red-600">{t("admin.users.error")}</p>;
  if (!users) return <p>{t("admin.users.loading")}</p>;
  if (users.length === 0) return <p>{t("admin.users.empty")}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin.users.title")}</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 font-medium">{t("admin.users.columns.email")}</th>
            <th className="p-2 font-medium">{t("admin.users.columns.role")}</th>
            <th className="p-2 font-medium">{t("admin.users.columns.status")}</th>
            <th className="p-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.email}</td>
              <td className="p-2">
                <select
                  value={u.role}
                  onChange={(e) => updateUser(u.id, { role: e.target.value as UserRow["role"] })}
                  className="rounded border p-1 text-sm"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                {u.is_active ? t("admin.users.active") : t("admin.users.suspended")}
              </td>
              <td className="p-2">
                <button
                  onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                  className="rounded border p-1 text-sm hover:bg-black/5"
                >
                  {u.is_active ? t("admin.users.suspend") : t("admin.users.reactivate")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
