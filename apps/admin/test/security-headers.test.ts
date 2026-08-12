import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Admin document security headers", () => {
  it("keeps every Admin path private, non-indexable, and framed only by nobody", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(rules?.[0]?.headers.map(({ key, value }) => [key.toLowerCase(), value]));
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-robots-tag")).toContain("noindex");
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
  });
});
