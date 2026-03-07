import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  base64UrlEncode,
} from "@services/googleAuth";

// ---------------------------------------------------------------------------
// PKCE Utilities (§3.3) — P3-005
// ---------------------------------------------------------------------------

describe("googleAuth PKCE utilities", () => {
  describe("base64UrlEncode", () => {
    it("should encode an empty buffer", () => {
      expect(base64UrlEncode(new Uint8Array([]))).toBe("");
    });

    it("should produce URL-safe characters (no +, /, or =)", () => {
      // Use bytes that would produce +, /, and = in standard base64
      const bytes = new Uint8Array([251, 255, 254, 63, 0, 1]);
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toMatch(/[+/=]/);
    });

    it("should replace + with - and / with _", () => {
      // 0xFB = 251 → in base64, certain byte combos yield + and /
      // Manually verify round-trip correctness with known values
      const bytes = new Uint8Array([0, 0, 62]); // standard base64: "AAA+"
      const encoded = base64UrlEncode(bytes);
      expect(encoded).toContain("-"); // + replaced with -
    });

    it("should strip padding characters", () => {
      // Single byte → standard base64 would have == padding
      const bytes = new Uint8Array([65]); // "QQ==" in standard base64
      const encoded = base64UrlEncode(bytes);
      expect(encoded).toBe("QQ");
    });

    it("should encode known byte sequences correctly", () => {
      // "Hello" → base64: "SGVsbG8=" → base64url: "SGVsbG8"
      const hello = new TextEncoder().encode("Hello");
      expect(base64UrlEncode(hello)).toBe("SGVsbG8");
    });
  });

  describe("generateCodeVerifier", () => {
    it("should produce a 43-character string (32 bytes → base64url)", () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBe(43);
    });

    it("should only contain base64url-safe characters", () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique values on successive calls", () => {
      const a = generateCodeVerifier();
      const b = generateCodeVerifier();
      expect(a).not.toBe(b);
    });
  });

  describe("generateCodeChallenge", () => {
    it("should produce a base64url string", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should differ from the verifier", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).not.toBe(verifier);
    });

    it("should produce a 43-character string (SHA-256 = 32 bytes)", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge.length).toBe(43);
    });

    it("should be deterministic for the same verifier", async () => {
      const verifier = "test-verifier-for-determinism";
      const a = await generateCodeChallenge(verifier);
      const b = await generateCodeChallenge(verifier);
      expect(a).toBe(b);
    });

    it("should differ for different verifiers", async () => {
      const a = await generateCodeChallenge("verifier-alpha");
      const b = await generateCodeChallenge("verifier-bravo");
      expect(a).not.toBe(b);
    });
  });
});
