import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task admission OpenAPI boundary", () => {
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
    expect(specification).not.toMatch(/existing task id|existing result/i);
  });
});
