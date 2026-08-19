import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptValue, encryptValue, getOrCreateVaultKey } from "./crypto";

beforeEach(() => {
  localStorage.clear();
});

describe("encryptValue / decryptValue round trip", () => {
  it("round-trips an empty string", async () => {
    const key = await getOrCreateVaultKey();
    const cipher = await encryptValue("", key);
    expect(await decryptValue(cipher, key)).toBe("");
  });

  it("round-trips a short string", async () => {
    const key = await getOrCreateVaultKey();
    const cipher = await encryptValue("sk-abc123", key);
    expect(await decryptValue(cipher, key)).toBe("sk-abc123");
  });

  it("round-trips a long, multiline secret-shaped value", async () => {
    const key = await getOrCreateVaultKey();
    const plaintext = [
      "-----BEGIN PRIVATE KEY-----",
      "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj",
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const cipher = await encryptValue(plaintext, key);
    expect(await decryptValue(cipher, key)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext across calls (random IV)", async () => {
    const key = await getOrCreateVaultKey();
    const a = await encryptValue("same-value", key);
    const b = await encryptValue("same-value", key);
    expect(a).not.toBe(b);
    expect(await decryptValue(a, key)).toBe("same-value");
    expect(await decryptValue(b, key)).toBe("same-value");
  });
});

// getOrCreateVaultKey memoizes the key in module state, so these two tests
// use vi.resetModules() + a dynamic re-import to get a fresh module
// instance per test - otherwise the memoized key from an earlier test would
// short-circuit the localStorage read/write path being tested here.
describe("getOrCreateVaultKey persistence", () => {
  it("writes a JWK to localStorage on first call", async () => {
    expect(localStorage.getItem("key-stash-manager-vault-key")).toBeNull();
    vi.resetModules();
    const fresh = await import("./crypto");
    await fresh.getOrCreateVaultKey();
    expect(localStorage.getItem("key-stash-manager-vault-key")).not.toBeNull();
  });

  it("reuses the persisted key across a fresh module instance", async () => {
    vi.resetModules();
    const first = await import("./crypto");
    const key1 = await first.getOrCreateVaultKey();
    const cipher = await first.encryptValue("persisted-check", key1);

    vi.resetModules();
    const second = await import("./crypto");
    const key2 = await second.getOrCreateVaultKey();
    expect(await second.decryptValue(cipher, key2)).toBe("persisted-check");
  });
});
