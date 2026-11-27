import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminLayout, { umamiDashboardUrl } from "./AdminLayout";

// useTranslation mocké en passthrough (clé -> clé) : ces tests de composant
// vérifient le rendu des DONNÉES, pas les traductions — initialiser
// i18next-http-backend (fetch réseau des locales) en test est hors scope.
// Les autres tests admin réutilisent ce même mock.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubApi(health: unknown, healthStatus = 200) {
  const fetchMock = vi.fn().mockImplementation((url: string) =>
    Promise.resolve(
      url.endsWith("/health")
        ? jsonResponse(health, healthStatus)
        : jsonResponse({ admin: true, fleet: false, analytics: true }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <AdminLayout />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("umamiDashboardUrl", () => {
  it("renvoie l'origine du script de suivi", () => {
    expect(umamiDashboardUrl({ umami: { script_url: "https://stats.0-hitl.com/s.js" } })).toBe(
      "https://stats.0-hitl.com",
    );
  });

  it("refuse l'absence de config, une URL invalide ou non HTTPS", () => {
    expect(umamiDashboardUrl({ status: "ok" })).toBeNull();
    expect(umamiDashboardUrl(null)).toBeNull();
    expect(umamiDashboardUrl({ umami: { script_url: "pas une url" } })).toBeNull();
    expect(umamiDashboardUrl({ umami: { script_url: "http://stats.example.com/s.js" } })).toBeNull();
  });
});

describe("AdminLayout", () => {
  it("affiche le lien Audience vers Umami quand le projet y est branché", async () => {
    stubApi({ status: "ok", umami: { script_url: "https://stats.0-hitl.com/s.js" } });
    renderLayout();
    const link = await screen.findByText("admin.tabs.audience");
    expect(link.closest("a")).toHaveAttribute("href", "https://stats.0-hitl.com");
    expect(link.closest("a")).toHaveAttribute("target", "_blank");
    expect(link.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("n'affiche pas de lien Audience sans config Umami", async () => {
    const fetchMock = stubApi({ status: "ok" });
    renderLayout();
    await screen.findByText("admin.tabs.users");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("admin.tabs.audience")).toBeNull();
  });

  it("n'a plus d'onglet Analytics maison, même si un vieux backend renvoie le flag", async () => {
    stubApi({ status: "ok" });
    renderLayout();
    await screen.findByText("admin.tabs.users");
    expect(screen.queryByText("admin.tabs.analytics")).toBeNull();
  });

  it("une panne de /health ne casse pas l'admin", async () => {
    stubApi({ detail: "down" }, 503);
    renderLayout();
    expect(await screen.findByText("admin.tabs.users")).toBeInTheDocument();
    expect(screen.queryByText("admin.tabs.audience")).toBeNull();
  });
});
