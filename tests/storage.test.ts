import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSession, saveSession, type SessionState } from "@/lib/storage";

// Regression coverage for the "tabs reset when you navigate away" bug: the
// fix moved several pieces of view-local UI state (which preset group is
// expanded, which sort column P&L is on, which axis Sensitivity is plotting,
// ...) into ScenarioContext so Next.js remounting a route component no
// longer wipes them. ScenarioContext round-trips that state through
// saveSession/loadSession exactly like it already did for `open`/`pinned`,
// so this file exercises that round trip directly rather than mounting
// components (there is no React component test harness in this project).
//
// vitest's default environment here is "node" (see vitest.config.ts), so
// `window` does not exist by default. saveSession/loadSession both guard on
// `typeof window === "undefined"` and no-op/return null in that case — the
// same guard that lets them run safely during SSR. A minimal in-memory
// localStorage stand-in makes that branch exercise the real read/write path
// instead of always taking the no-op branch.
function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

const fullSession: SessionState = {
  delta: { fedFunds: 5.5 },
  horizon: 12,
  path: "immediate",
  steps: 8,
  notional: 1_000_000,
  presetId: "hiking-cycle",
  portfolioId: "p6040",
  open: { Growth: true, Policy: false },
  pinned: ["SPX", "UST10Y"],
  presetOpen: { Growth: true, Inflation: false, "Credit & Liquidity": true },
  narrativeGroupTab: "corporate-bonds",
  sensitivityXVar: "fedFunds",
  sensitivityYVar: "cpiCore",
  pnlOpenSectors: true,
  pnlSortKey: "contrib",
  pnlSortDir: "asc",
};

describe("session persistence of per-view UI state", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: fakeLocalStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips every lifted UI field through save/load", () => {
    saveSession(fullSession);
    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      presetOpen: fullSession.presetOpen,
      narrativeGroupTab: "corporate-bonds",
      sensitivityXVar: "fedFunds",
      sensitivityYVar: "cpiCore",
      pnlOpenSectors: true,
      pnlSortKey: "contrib",
      pnlSortDir: "asc",
    });
  });

  it("falls back to undefined/null for a legacy session saved before these fields existed", () => {
    // Simulates a session written by an older build of the app: only the
    // fields SessionState originally had.
    const legacy = {
      delta: {},
      horizon: 12,
      path: "immediate",
      steps: 8,
      notional: 1_000_000,
      presetId: null,
      portfolioId: "p6040",
      open: {},
      pinned: [],
    };
    window.localStorage.setItem("msp.session.v1", JSON.stringify(legacy));

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    // Must not throw and must not silently invent a bogus tab/sort state —
    // ScenarioProvider's restore effect only overwrites its defaults when a
    // field is actually present (see the `if (s.xyz)` guards there), so
    // undefined/null here is what keeps each view's sensible default intact.
    expect(loaded!.presetOpen).toBeUndefined();
    expect(loaded!.narrativeGroupTab).toBeUndefined();
    expect(loaded!.pnlSortKey).toBeNull();
    expect(loaded!.pnlSortDir).toBeUndefined();
  });

  it("rejects an out-of-range narrativeGroupTab or pnlSortKey instead of passing it through", () => {
    const corrupted = { ...fullSession, narrativeGroupTab: "crypto", pnlSortKey: "not-a-real-column" };
    window.localStorage.setItem("msp.session.v1", JSON.stringify(corrupted));

    const loaded = loadSession();
    expect(loaded!.narrativeGroupTab).toBeUndefined();
    expect(loaded!.pnlSortKey).toBeNull();
  });

  it("returns null on malformed JSON without throwing", () => {
    window.localStorage.setItem("msp.session.v1", "{not json");
    expect(() => loadSession()).not.toThrow();
    expect(loadSession()).toBeNull();
  });
});
