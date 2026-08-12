import { describe, expect, it } from "vitest";
import { AdminCsrfProtector } from "../src/csrf";

describe("Admin mutation CSRF primitive", () => {
  it("binds a short-lived token to owner, exact origin, JSON, and same-origin fetch metadata", () => {
    const protector = new AdminCsrfProtector("csrf-secret-with-at-least-32-characters", 60_000);
    const now = new Date("2026-08-11T12:00:00.000Z");
    const token = protector.issue("owner_tikdd", "https://admin.tikdd.example", now);
    const valid = {
      token,
      subject: "owner_tikdd",
      origin: "https://admin.tikdd.example",
      expectedOrigin: "https://admin.tikdd.example",
      contentType: "application/json",
      fetchSite: "same-origin",
      now: new Date(now.getTime() + 10_000)
    };
    expect(protector.verify(valid)).toBe(true);
    expect(protector.verify({ ...valid, subject: "different_owner" })).toBe(false);
    expect(protector.verify({ ...valid, origin: "https://attacker.example" })).toBe(false);
    expect(protector.verify({ ...valid, contentType: "text/plain" })).toBe(false);
    expect(protector.verify({ ...valid, fetchSite: "cross-site" })).toBe(false);
    expect(protector.verify({ ...valid, now: new Date(now.getTime() + 61_000) })).toBe(false);
  });
});
