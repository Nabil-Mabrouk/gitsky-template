import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Security from "./Security";

// Même mock passthrough que Analytics.test.tsx — voir son commentaire.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Security", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche le résumé par sévérité et la table d'événements", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ total: 3, by_severity: { high: 2, medium: 1 } }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 1,
            event_type: "injection_attempt",
            severity: "high",
            ip_address: "1.2.3.4",
            path: "/api/x",
            created_at: "2026-08-01T00:00:00Z",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<Security />);

    await waitFor(() => expect(screen.getByText("injection_attempt")).toBeInTheDocument());
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1.2.3.4")).toBeInTheDocument();
  });

  it("refait une requête avec le paramètre severity quand le filtre change", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ total: 0, by_severity: {} }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<Security />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "critical");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const lastCallUrl = fetchMock.mock.calls[2][0] as string;
    expect(lastCallUrl).toContain("severity=critical");
  });
});
