import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret } from "../src/crypto/secrets.js";

describe("AES-256-GCM secrets", () => {
  it("round-trips plaintext", () => {
    const key = randomBytes(32);
    const cipher = encryptSecret("hunter2", key);
    expect(cipher).not.toContain("hunter2");
    expect(decryptSecret(cipher, key)).toBe("hunter2");
  });

  it("fails with the wrong key", () => {
    const cipher = encryptSecret("secret", randomBytes(32));
    expect(() => decryptSecret(cipher, randomBytes(32))).toThrow();
  });

  it("masks secrets", () => {
    expect(maskSecret("ab")).toBe("****");
    expect(maskSecret("abcdef")).toBe("ab****ef");
  });
});
