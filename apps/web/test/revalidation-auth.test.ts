import { describe, expect, it } from "vitest";
import { signContentRevalidation, verifyContentRevalidation } from "../lib/revalidation-auth";

describe("public content revalidation authentication", () => {
  const secret = "content-revalidation-secret-at-least-32-bytes";
  it("accepts a current exact body signature", () => {
    const timestamp = String(Date.now()); const body = '{"snapshotId":"named"}';
    expect(verifyContentRevalidation(secret, timestamp, signContentRevalidation(secret, timestamp, body), body)).toBe(true);
  });
  it("rejects replay, tampering, and weak configuration", () => {
    const timestamp = String(Date.now() - 31_000); const body = "{}"; const signature = signContentRevalidation(secret, timestamp, body);
    expect(verifyContentRevalidation(secret, timestamp, signature, body)).toBe(false);
    expect(verifyContentRevalidation(secret, String(Date.now()), signature, "changed")).toBe(false);
    expect(verifyContentRevalidation("short", String(Date.now()), signature, body)).toBe(false);
  });
});
