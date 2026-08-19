import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptValue, encryptValue, getOrCreateVaultKey } from "./crypto";

function deleteVaultKeyDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("key-stash-manager-keys");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  localStorage.clear();
  await deleteVaultKeyDb();
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

// Reads the raw IndexedDB record directly (bypassing the module's own
// memoization) so these tests actually exercise the storage layer instead
// of just the in-memory cache.
function readVaultKeyRecordFromIndexedDb(): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open("key-stash-manager-keys", 1);
    openReq.onupgradeneeded = () => {
      openReq.result.createObjectStore("keys");
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      const getReq = db
        .transaction("keys", "readonly")
        .objectStore("keys")
        .get("vault-key");
      getReq.onsuccess = () => {
        resolve(getReq.result as CryptoKey | undefined);
        db.close();
      };
      getReq.onerror = () => {
        reject(getReq.error);
        db.close();
      };
    };
    openReq.onerror = () => reject(openReq.error);
  });
}

// getOrCreateVaultKey memoizes the key in module state, so these tests use
// vi.resetModules() + a dynamic re-import to get a fresh module instance
// per test - otherwise the memoized key from an earlier test would
// short-circuit the storage read/write path being tested here.
describe("getOrCreateVaultKey persistence", () => {
  it("writes a non-extractable key to IndexedDB on first call", async () => {
    expect(await readVaultKeyRecordFromIndexedDb()).toBeUndefined();
    vi.resetModules();
    const fresh = await import("./crypto");
    await fresh.getOrCreateVaultKey();
    const stored = await readVaultKeyRecordFromIndexedDb();
    expect(stored).toBeDefined();
    expect(stored?.extractable).toBe(false);
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

  it("migrates a legacy localStorage JWK into IndexedDB and removes it", async () => {
    // Simulates a pre-hardening user: an *extractable* key exported to a
    // JWK in localStorage, the way the old getOrCreateVaultKey used to
    // store it (the current code only ever creates non-extractable keys,
    // so this has to be constructed by hand rather than via the module).
    const legacyKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", legacyKey);
    localStorage.setItem("key-stash-manager-vault-key", JSON.stringify(jwk));

    vi.resetModules();
    const fresh = await import("./crypto");
    const cipher = await fresh.encryptValue("migrate-me", legacyKey);
    const migratedKey = await fresh.getOrCreateVaultKey();

    expect(await fresh.decryptValue(cipher, migratedKey)).toBe("migrate-me");
    expect(localStorage.getItem("key-stash-manager-vault-key")).toBeNull();
    const stored = await readVaultKeyRecordFromIndexedDb();
    expect(stored?.extractable).toBe(false);
  });
});
