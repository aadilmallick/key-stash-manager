import { describe, expect, it } from "vitest";
import { decryptFromSharing, encryptForSharing } from "./e2eShare";

describe("encryptForSharing / decryptFromSharing round trip", () => {
  it("round-trips a plaintext payload", async () => {
    const plaintext = JSON.stringify({ hello: "world", n: 42 });
    const { ciphertext, token } = await encryptForSharing(plaintext);
    expect(await decryptFromSharing(ciphertext, token)).toBe(plaintext);
  });

  it("produces a different token and ciphertext on each call (fresh key)", async () => {
    const a = await encryptForSharing("same-value");
    const b = await encryptForSharing("same-value");
    expect(a.token).not.toBe(b.token);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects with the wrong token", async () => {
    const { ciphertext } = await encryptForSharing("secret-payload");
    const { token: wrongToken } = await encryptForSharing("unrelated");
    await expect(decryptFromSharing(ciphertext, wrongToken)).rejects.toThrow();
  });

  it("rejects a malformed (non-key-length) token", async () => {
    const { ciphertext } = await encryptForSharing("secret-payload");
    await expect(decryptFromSharing(ciphertext, "not-a-real-token")).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const { ciphertext, token } = await encryptForSharing("secret-payload");
    const tampered = ciphertext.slice(0, -4) + (ciphertext.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    await expect(decryptFromSharing(tampered, token)).rejects.toThrow();
  });
});
