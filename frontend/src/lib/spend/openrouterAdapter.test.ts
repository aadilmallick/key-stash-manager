import { describe, expect, it } from "vitest";
import { openrouterAdapter } from "./openrouterAdapter";

describe("openrouterAdapter.parseSnapshot", () => {
  it("parses a capped key", () => {
    const snapshot = openrouterAdapter.parseSnapshot({
      data: {
        label: "my-key",
        usage: 12.34,
        limit: 100,
        limit_remaining: 87.66,
      },
    });
    expect(snapshot).toEqual({
      provider: "openrouter",
      spendUsd: 12.34,
      limitUsd: 100,
      remainingUsd: 87.66,
      periodLabel: "Lifetime (this key)",
    });
  });

  it("parses an uncapped key (null limit/remaining)", () => {
    const snapshot = openrouterAdapter.parseSnapshot({
      data: { usage: 5, limit: null, limit_remaining: null },
    });
    expect(snapshot.limitUsd).toBeNull();
    expect(snapshot.remainingUsd).toBeNull();
    expect(snapshot.spendUsd).toBe(5);
  });

  it("throws on missing data.usage", () => {
    expect(() => openrouterAdapter.parseSnapshot({ data: {} })).toThrow();
  });

  it("throws on completely unexpected shape", () => {
    expect(() => openrouterAdapter.parseSnapshot(null)).toThrow();
    expect(() => openrouterAdapter.parseSnapshot("not json")).toThrow();
  });

  it("buildProxyParams returns undefined (no query params needed)", () => {
    expect(openrouterAdapter.buildProxyParams()).toBeUndefined();
  });
});
