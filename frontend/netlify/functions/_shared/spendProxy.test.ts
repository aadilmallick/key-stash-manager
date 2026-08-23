import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import spendProxyModule from "./spendProxy.cjs";

const { handleSpendProxyRequest, validateRequestBody } = spendProxyModule;

describe("validateRequestBody", () => {
  it("accepts a valid openrouter request", () => {
    const result = validateRequestBody({
      provider: "openrouter",
      apiKey: "sk-or-abc",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown provider", () => {
    const result = validateRequestBody({ provider: "anthropic", apiKey: "x" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing/empty apiKey", () => {
    expect(validateRequestBody({ provider: "openai", apiKey: "" }).ok).toBe(
      false,
    );
    expect(validateRequestBody({ provider: "openai" }).ok).toBe(false);
  });

  it("rejects non-numeric params", () => {
    const result = validateRequestBody({
      provider: "openai",
      apiKey: "sk-admin-x",
      params: { startTime: "not-a-number" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateRequestBody(null).ok).toBe(false);
    expect(validateRequestBody("hello").ok).toBe(false);
  });
});

describe("handleSpendProxyRequest", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns 400 for an invalid body without calling fetch", async () => {
    const result = await handleSpendProxyRequest({ provider: "bogus" });
    expect(result.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("only ever fetches the two hardcoded allowlisted URLs", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { usage: 1 } }),
    });

    await handleSpendProxyRequest({ provider: "openrouter", apiKey: "k" });
    const [calledUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe("https://openrouter.ai/api/v1/auth/key");

    await handleSpendProxyRequest({ provider: "openai", apiKey: "k" });
    const [openaiUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(openaiUrl).toMatch(/^https:\/\/api\.openai\.com\/v1\/organization\/costs/);
  });

  it("passes the apiKey as a Bearer header, never as part of the URL", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    await handleSpendProxyRequest({ provider: "openrouter", apiKey: "secret-123" });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).not.toContain("secret-123");
    expect(init.headers.Authorization).toBe("Bearer secret-123");
  });

  it("relays a non-OK upstream response as 502", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "invalid key" }),
    });
    const result = await handleSpendProxyRequest({
      provider: "openai",
      apiKey: "bad-key",
    });
    expect(result.status).toBe(502);
    expect(result.body.status).toBe(401);
  });

  it("returns 500 when the upstream fetch throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );
    const result = await handleSpendProxyRequest({
      provider: "openai",
      apiKey: "k",
    });
    expect(result.status).toBe(500);
  });

  it("returns 200 with the verbatim upstream JSON on success", async () => {
    const upstreamJson = { data: { usage: 4.2, limit: null } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(upstreamJson),
    });
    const result = await handleSpendProxyRequest({
      provider: "openrouter",
      apiKey: "k",
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ provider: "openrouter", raw: upstreamJson });
  });
});
