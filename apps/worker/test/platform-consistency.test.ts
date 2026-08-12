import { describe, expect, it, vi } from "vitest";
import { verifyResolveJobPlatform } from "../src/platform-consistency";

describe("resolve job platform consistency", () => {
  it("returns the freshly generated canonical URL when the queue platform matches", () => {
    const result = verifyResolveJobPlatform({
      sourceUrl: "https://twitter.com/tikdd/status/123?s=20",
      platform: "x"
    });
    expect(result).toMatchObject({ platform: "x", canonicalUrl: "https://x.com/tikdd/status/123" });
  });

  it("terminates a spoofed queue platform before any Provider can be selected", () => {
    const detect = vi.fn(() => ({
      platform: "tiktok" as const,
      canonicalUrl: "https://www.tiktok.com/@tikdd/video/123"
    }));
    expect(() => verifyResolveJobPlatform({
      sourceUrl: "https://www.tiktok.com/@tikdd/video/123",
      platform: "x"
    }, detect)).toThrow("queued platform no longer matches");
    expect(detect).toHaveBeenCalledOnce();
  });
});
