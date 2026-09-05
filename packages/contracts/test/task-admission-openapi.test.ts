import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CreateResolveTaskRequestSchema } from "../src/index";

describe("task admission OpenAPI boundary", () => {
  it("accepts a URL-only request and ignores legacy client extras", () => {
    expect(CreateResolveTaskRequestSchema.parse({
      url: "https://x.com/example/status/1",
      legacyClientFlag: true
    })).toEqual({ url: "https://x.com/example/status/1" });
    expect(CreateResolveTaskRequestSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });

  it("documents the idempotency header and capability-safe admission responses", async () => {
    const specification = await readFile(
      new URL("../../../openapi/tikdd.v1.yaml", import.meta.url),
      "utf8"
    );

    expect(specification).toContain("name: Idempotency-Key");
    expect(specification).toContain('"409":');
    expect(specification).toContain('"429":');
    expect(specification).toContain("Retry-After:");
    expect(specification).toContain("RATE_LIMITED");
    expect(specification).toContain("CONCURRENCY_LIMITED");
    expect(specification).toContain("equivalent-source allowance");
    expect(specification).toContain("required: [url]");
    expect(specification).not.toMatch(/existing task id|existing result/i);
  });
});
