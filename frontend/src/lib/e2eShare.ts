import {
  base64ToBuffer,
  bufferToBase64,
  decryptValue,
  encryptValue,
} from "@/lib/crypto";

// Manual E2E sharing: a fresh, one-time AES-256-GCM key per share (never
// the vault key), so the ciphertext file and the token are the only two
// things needed to decrypt - and nothing else the app stores. Reuses
// crypto.ts's encryptValue/decryptValue (already base64(iv||ciphertext))
// for the payload; the token is just the raw key, base64-encoded, meant
// to travel through a *different* channel than the file itself.
export interface EncryptedShare {
  ciphertext: string;
  token: string;
}

export async function encryptForSharing(
  plaintext: string,
): Promise<EncryptedShare> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const ciphertext = await encryptValue(plaintext, key);
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return { ciphertext, token: bufferToBase64(rawKey) };
}

export async function decryptFromSharing(
  ciphertext: string,
  token: string,
): Promise<string> {
  const rawKey = base64ToBuffer(token);
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  return decryptValue(ciphertext, key);
}
