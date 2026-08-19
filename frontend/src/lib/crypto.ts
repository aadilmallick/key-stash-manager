// Basic client-side encryption at rest for secret values.
//
// Model: a random per-device AES-256-GCM key is generated once and stored as
// a JWK in localStorage under VAULT_KEY_STORAGE_KEY - deliberately a
// different storage location than the SQLite/OPFS database file, so copying
// just the DB file doesn't also leak the key. There is no password/unlock
// flow: the key is available transparently, so this protects the data at
// rest (e.g. someone reading the raw OPFS file or a DB backup) but not
// against arbitrary script execution in the same browser origin.

const VAULT_KEY_STORAGE_KEY = "key-stash-manager-vault-key";

let memoizedKey: CryptoKey | null = null;

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function getOrCreateVaultKey(): Promise<CryptoKey> {
  if (memoizedKey) return memoizedKey;

  const stored = localStorage.getItem(VAULT_KEY_STORAGE_KEY);
  if (stored) {
    const jwk = JSON.parse(stored);
    memoizedKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
    return memoizedKey;
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem(VAULT_KEY_STORAGE_KEY, JSON.stringify(jwk));
  memoizedKey = key;
  return memoizedKey;
}

export async function encryptValue(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufferToBase64(combined);
}

export async function decryptValue(
  ciphertext: string,
  key: CryptoKey,
): Promise<string> {
  const combined = base64ToBuffer(ciphertext);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return new TextDecoder().decode(plaintext);
}
