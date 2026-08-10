import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CanaryFileSchema } from "../src/runtime";

describe("scheduled canary provider file", () => {
  it("accepts the current versioned authorization file and SSSTwitter IDs", async () => {
    const current = JSON.parse(
      await readFile(new URL("../../../config/provider-canaries.json", import.meta.url), "utf8")
    );
    expect(CanaryFileSchema.parse(current).version).toBe(2);
    expect(() =>
      CanaryFileSchema.parse({
        ...current,
        canaries: [
          {
            id: "ssstwitter-x-fixture",
            provider: "ssstwitter",
            platform: "x",
            url: "https://x.com/authorized/status/123"
          }
        ]
      })
    ).not.toThrow();
  });
});
