import { describe, expect, it } from "vitest";
import { openaiAdapter } from "./openaiAdapter";

describe("openaiAdapter.parseSnapshot", () => {
  it("sums amount.value across multiple buckets/results", () => {
    const snapshot = openaiAdapter.parseSnapshot({
      object: "page",
      data: [
        {
          object: "bucket",
          start_time: 1736553600,
          end_time: 1736640000,
          results: [{ amount: { value: 0.1308, currency: "usd" } }],
        },
        {
          object: "bucket",
          start_time: 1736640000,
          end_time: 1736726400,
          results: [
            { amount: { value: 0.5, currency: "usd" } },
            { amount: { value: 0.25, currency: "usd" } },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    });
    expect(snapshot.provider).toBe("openai");
    expect(snapshot.spendUsd).toBeCloseTo(0.8808, 4);
    expect(snapshot.limitUsd).toBeNull();
    expect(snapshot.remainingUsd).toBeNull();
    expect(snapshot.periodLabel).toBe("This month (UTC)");
  });

  it("returns 0 spend for an empty bucket list", () => {
    const snapshot = openaiAdapter.parseSnapshot({ data: [] });
    expect(snapshot.spendUsd).toBe(0);
  });

  it("throws on unexpected shape", () => {
    expect(() => openaiAdapter.parseSnapshot(null)).toThrow();
    expect(() => openaiAdapter.parseSnapshot({ notData: [] })).toThrow();
  });

  it("buildProxyParams returns numeric startTime/endTime", () => {
    const params = openaiAdapter.buildProxyParams();
    expect(params).toBeDefined();
    expect(typeof params!.startTime).toBe("number");
    expect(typeof params!.endTime).toBe("number");
    expect(params!.startTime).toBeLessThanOrEqual(params!.endTime);
  });
});
