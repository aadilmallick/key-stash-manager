// Basic client-side encryption at rest for secret values.
//
// Model: a random per-device, non-extractable AES-256-GCM key is generated
// once and stored as a CryptoKey object directly in IndexedDB (browsers can
// structured-clone CryptoKey), under a database deliberately separate from
// the SQLite/OPFS database file, so copying just the DB file doesn't also
// give you the key. Being non-extractable means the raw key bytes can never
// be read out (not even by this code) - only used via crypto.subtle. There
// is no password/unlock flow: the key is available transparently, so this
// protects the data at rest (e.g. someone reading the raw OPFS file or a DB
// backup) but does not fully protect against arbitrary script execution in
// the same browser origin (such a script could still call
// crypto.subtle.decrypt using the key, just not exfiltrate the key itself).
//
// Legacy users may still have an *extractable* JWK from an earlier version
// of this app in localStorage under LEGACY_JWK_STORAGE_KEY -
// getOrCreateVaultKey migrates that into a non-extractable IndexedDB key on
// first read and removes the localStorage copy, so existing encrypted data
// stays decryptable.

const LEGACY_JWK_STORAGE_KEY = "key-stash-manager-vault-key";
const KEY_DB_NAME = "key-stash-manager-keys";
const KEY_STORE_NAME = "keys";
const KEY_RECORD_ID = "vault-key";

let memoizedKey: CryptoKey | null = null;

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(KEY_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readVaultKeyFromIndexedDb(): Promise<CryptoKey | undefined> {
  const db = await openKeyDb();
  try {
    return await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const request = db
        .transaction(KEY_STORE_NAME, "readonly")
        .objectStore(KEY_STORE_NAME)
        .get(KEY_RECORD_ID);
      request.onsuccess = () =>
        resolve(request.result as CryptoKey | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeVaultKeyToIndexedDb(key: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, "readwrite");
      tx.objectStore(KEY_STORE_NAME).put(key, KEY_RECORD_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

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

// In-flight-promise guard: without this, two concurrent first-run callers
// (e.g. React 18 StrictMode's dev-mode double-effect-invoke) could each
// generate/migrate a *different* key and race to write IndexedDB, leaving
// already-encrypted data from one caller undecryptable under the other's
// key. Mirrors the seedPromise pattern in lib/db/migrations.ts. Only reset
// on failure, so a genuine error allows a retry.
let keyPromise: Promise<CryptoKey> | null = null;

export function getOrCreateVaultKey(): Promise<CryptoKey> {
  if (memoizedKey) return Promise.resolve(memoizedKey);
  if (!keyPromise) {
    keyPromise = loadOrCreateVaultKey().catch((error) => {
      keyPromise = null;
      throw error;
    });
  }
  return keyPromise;
}

async function loadOrCreateVaultKey(): Promise<CryptoKey> {
  const existing = await readVaultKeyFromIndexedDb();
  if (existing) {
    memoizedKey = existing;
    return existing;
  }

  const legacyJwk = localStorage.getItem(LEGACY_JWK_STORAGE_KEY);
  if (legacyJwk) {
    const migrated = await crypto.subtle.importKey(
      "jwk",
      JSON.parse(legacyJwk),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    await writeVaultKeyToIndexedDb(migrated);
    localStorage.removeItem(LEGACY_JWK_STORAGE_KEY);
    memoizedKey = migrated;
    return migrated;
  }

  const generated = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  await writeVaultKeyToIndexedDb(generated);
  memoizedKey = generated;
  return generated;
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
  if (combined.length <= 12) {
    throw new Error("Ciphertext is too short to contain an IV and payload");
  }
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return new TextDecoder().decode(plaintext);
}
