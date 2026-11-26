import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UmamiTracker, { UMAMI_SCRIPT_ID } from "./UmamiTracker";

const CONFIG = {
  script_url: "https://stats.0-hitl.com/s.js",
  website_id: "4f6c1b2a-9d3e-4c5f-8a7b-0123456789ab",
  domains: "f-ynd.com",
};

function stubHealth(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  document.getElementById(UMAMI_SCRIPT_ID)?.remove();
  vi.unstubAllGlobals();
});

describe("UmamiTracker", () => {
  it("injecte le script de suivi avec la config renvoyée par /health", async () => {
    stubHealth({ status: "ok", umami: CONFIG });
    render(<UmamiTracker />);
    await waitFor(() => expect(document.getElementById(UMAMI_SCRIPT_ID)).not.toBeNull());
    const script = document.getElementById(UMAMI_SCRIPT_ID) as HTMLScriptElement;
    expect(script.src).toBe(CONFIG.script_url);
    expect(script.defer).toBe(true);
    expect(script.getAttribute("data-website-id")).toBe(CONFIG.website_id);
    expect(script.getAttribute("data-domains")).toBe("f-ynd.com");
    expect(script.getAttribute("data-do-not-track")).toBe("true");
  });

  it("ne charge rien quand le projet n'est pas branché sur Umami", async () => {
    const fetchMock = stubHealth({ status: "ok", modules: {} });
    render(<UmamiTracker />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById(UMAMI_SCRIPT_ID)).toBeNull();
  });

  it("ne casse rien si /health échoue", async () => {
    const fetchMock = stubHealth({ detail: "down" }, 503);
    render(<UmamiTracker />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById(UMAMI_SCRIPT_ID)).toBeNull();
  });

  it("n'injecte le script qu'une seule fois", async () => {
    stubHealth({ status: "ok", umami: CONFIG });
    render(
      <>
        <UmamiTracker />
        <UmamiTracker />
      </>,
    );
    await waitFor(() => expect(document.getElementById(UMAMI_SCRIPT_ID)).not.toBeNull());
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll(`#${UMAMI_SCRIPT_ID}`)).toHaveLength(1);
  });
});
