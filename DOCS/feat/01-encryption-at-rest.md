There are three primary architectural approaches for implementing client-side
encryption at rest in a browser-based, local-first app using the **Web Crypto
API** and **IndexedDB**:

---

### Option 1: Master Passphrase-Derived Key (PBKDF2 + AES-GCM 256)

_The Industry Standard for Zero-Knowledge Web Vaults (e.g., Bitwarden,
1Password)._

#### Architectural Flow

1. User creates a Master Password.
2. Web Crypto uses `PBKDF2` (with a high iteration count like 600,000 and a
   16-byte random salt) to stretch the password and derive a 256-bit AES-GCM
   encryption key.
3. Secrets are encrypted using `AES-GCM` with a unique, randomized 12-byte
   initialization vector (IV) per secret.
4. Only the ciphertext, salt, and IV are written to IndexedDB. The key lives
   purely in JavaScript memory and is purged on tab close/lock.

```typescript
// crypto-vault.ts
const PBKDF2_ITERATIONS = 600_000;

export interface EncryptedPayload {
    cipherText: string; // Base64
    iv: string; // Base64
    salt: string; // Base64
}

// 1. Derive AES-GCM key from user password
export async function deriveKeyFromPassword(
    password: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as any,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false, // Non-extractable key
        ["encrypt", "decrypt"],
    );
}

// 2. Encrypt secret before writing to IndexedDB
export async function encryptSecret(
    secret: string,
    key: CryptoKey,
    salt: Uint8Array,
): Promise<EncryptedPayload> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM
    const encodedData = new TextEncoder().encode(secret);

    const cipherBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData,
    );

    return {
        cipherText: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt)),
    };
}

// 3. Decrypt secret upon reading from IndexedDB
export async function decryptSecret(
    payload: EncryptedPayload,
    key: CryptoKey,
): Promise<string> {
    const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
    const cipherData = Uint8Array.from(
        atob(payload.cipherText),
        (c) => c.charCodeAt(0),
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherData,
    );

    return new TextDecoder().decode(decryptedBuffer);
}
```

- **Trade-offs:**
- **Pros:** True zero-knowledge; even if someone steals the device's IndexedDB
  file, it cannot be decrypted without brute-forcing PBKDF2.
- **Cons:** If the user forgets their master password, their local keys are
  permanently lost (requires recovery key design).

---

### Option 2: Transparent Device-Bound Key Storage (Non-Extractable CryptoKey in IndexedDB)

_The "Invisible Frictionless" Approach._

#### Architectural Flow

1. On first app load, generate a cryptographically strong 256-bit AES-GCM key
   marked as `extractable: false`.
2. Store the `CryptoKey` object directly in an IndexedDB object store (browsers
   natively allow storing raw `CryptoKey` objects).
3. All API keys and secrets are encrypted with this key before being stored.

```typescript
// device-key.ts
const DB_NAME = "keystash_internal";
const STORE_NAME = "crypto_keys";

// Generate and store an unexportable key directly in IndexedDB
export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
    const db = await openKeyDB();
    const existingKey = await getKeyFromDB(db, "vault_master_key");
    if (existingKey) return existingKey;

    const newKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false, // extractable: false prevents JS from exporting raw bytes
        ["encrypt", "decrypt"],
    );

    await saveKeyToDB(db, "vault_master_key", newKey);
    return newKey;
}

function openKeyDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getKeyFromDB(db: IDBDatabase, id: string): Promise<CryptoKey | null> {
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

function saveKeyToDB(
    db: IDBDatabase,
    id: string,
    key: CryptoKey,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(key, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
```

- **Trade-offs:**
- **Pros:** 100% frictionless UX. The user never needs to remember or type a
  master password. Raw secrets are never stored as plaintext strings in storage.
- **Cons:** Weak against local attackers who have direct physical access to the
  browser, since any script running on the origin can load the `CryptoKey` from
  IndexedDB and decrypt the records.

---

### Option 3: Hardware-Derived Passkey Encryption (WebAuthn PRF Extension)

_The Modern Pro / Enterprise Approach._

#### Architectural Flow

1. The app registers a WebAuthn Passkey (TouchID, FaceID, or YubiKey) using the
   `prf` (Pseudo-Random Function) extension.
2. When the user unlocks the vault, the browser requests biometric
   authentication.
3. The hardware authenticator executes `prf` with a fixed salt and returns a
   deterministic 32-byte secret.
4. Web Crypto imports this output via `HKDF` to derive the AES-GCM vault
   decryption key.

```typescript
// webauthn-prf.ts
const PRF_SALT = new TextEncoder().encode("keystash-vault-derivation-salt-v1");

export async function deriveKeyFromPasskey(
    credentialId: Uint8Array,
): Promise<CryptoKey> {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Request passkey assertion with WebAuthn PRF extension
    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge,
            allowCredentials: [{ id: credentialId as any, type: "public-key" }],
            extensions: {
                prf: {
                    eval: { first: PRF_SALT },
                },
            } as any,
        },
    }) as PublicKeyCredential;

    const extensionResults: any = assertion.getClientExtensionResults();
    if (!extensionResults.prf?.results?.first) {
        throw new Error("WebAuthn PRF not supported on this device/browser");
    }

    const rawDerivedSecret = extensionResults.prf.results.first; // ArrayBuffer from hardware

    // Import derived secret to create AES-GCM Key
    const prfKeyMaterial = await crypto.subtle.importKey(
        "raw",
        rawDerivedSecret,
        "HKDF",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            salt: new Uint8Array(),
            info: new TextEncoder().encode("keystash-vault-key"),
            hash: "SHA-256",
        },
        prfKeyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}
```

- **Trade-offs:**
- **Pros:** True passwordless hardware-level encryption. Private key material
  never leaves the secure enclave / YubiKey.
- **Cons:** Supported primarily on Chromium-based browsers, Safari 18+, and
  modern authenticators; requires a password fallback for legacy devices.

---

### Comparison & Architectural Recommendation

| Metric                    | Option 1: Master Password (PBKDF2)   | Option 2: IndexedDB CryptoKey       | Option 3: WebAuthn PRF Passkey     |
| ------------------------- | ------------------------------------ | ----------------------------------- | ---------------------------------- |
| **Security Level**        | High (Zero-Knowledge)                | Low-Medium (Obfuscation)            | Very High (Hardware-Bound)         |
| **UX Friction**           | Requires entering password on unlock | Completely transparent (0 friction) | Quick Biometric / TouchID prompt   |
| **Browser Compatibility** | 100% of modern browsers              | 100% of modern browsers             | Modern Chromium / Safari 18+       |
| **Recovery Path**         | Manual 24-word recovery phrase       | Device loss = complete data loss    | Secondary password or passkey sync |

**Recommended Implementation Strategy for KeyStash:**

1. **Free Tier (Default):** Use **Option 1 (PBKDF2 + AES-GCM)**. Set a default
   session unlock timeout (e.g., auto-lock after 30 minutes of inactivity by
   wiping the `CryptoKey` from memory).
2. **Pro Tier Upgrade:** Add **Option 3 (WebAuthn PRF)** as the seamless "Unlock
   Vault with TouchID/FaceID" convenience feature, falling back to Option 1 when
   biometrics are unavailable.
