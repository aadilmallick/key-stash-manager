import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.fn();

vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({ authenticateRequest }),
}));

import { verifyProAccess } from "./verifyProAccess";

const fakeRequest = new Request("https://example.com/api/proxy-spend", {
  method: "POST",
});

describe("verifyProAccess", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    authenticateRequest.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("no-ops outside production without calling authenticateRequest", async () => {
    process.env.CONTEXT = "dev";
    const result = await verifyProAccess(fakeRequest);
    expect(result).toEqual({ ok: true, status: 200 });
    expect(authenticateRequest).not.toHaveBeenCalled();
  });

  it("fails closed with 500 when Clerk keys are missing in production", async () => {
    process.env.CONTEXT = "production";
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.VITE_CLERK_PUBLISHABLE_KEY;
    const result = await verifyProAccess(fakeRequest);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it("returns 401 when not signed in", async () => {
    process.env.CONTEXT = "production";
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    authenticateRequest.mockResolvedValue({ isAuthenticated: false });
    const result = await verifyProAccess(fakeRequest);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it("returns 403 when signed in but not on the Pro plan", async () => {
    process.env.CONTEXT = "production";
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ has: () => false }),
    });
    const result = await verifyProAccess(fakeRequest);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("returns ok when signed in with the Pro plan", async () => {
    process.env.CONTEXT = "production";
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    const has = vi.fn().mockReturnValue(true);
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ has }),
    });
    const result = await verifyProAccess(fakeRequest);
    expect(result).toEqual({ ok: true, status: 200 });
    expect(has).toHaveBeenCalledWith({ plan: "varstash_pro" });
  });
});
