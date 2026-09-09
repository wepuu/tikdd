import { describe, expect, it } from "vitest";
import { suggestedDownloadFilename } from "../lib/download-filename";

const format = (overrides: Partial<{ container: string; quality: string; hasVideo: boolean }> = {}) => ({
  container: "mp4",
  quality: "720p",
  hasVideo: true,
  ...overrides
});

describe("suggestedDownloadFilename", () => {
  it("uses the X status ID and quality", () => {
    expect(suggestedDownloadFilename({
      id: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      platform: "x",
      canonicalUrl: "https://x.com/creator/status/2093477720638341395"
    }, format())).toBe("TikDD-X-2093477720638341395-720p.mp4");
  });

  it("uses the Instagram shortcode", () => {
    expect(suggestedDownloadFilename({
      id: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      platform: "instagram",
      canonicalUrl: "https://www.instagram.com/reel/DcSBz8UCbTG/"
    }, format())).toBe("TikDD-Instagram-DcSBz8UCbTG-720p.mp4");
  });

  it("falls back to a task suffix and a safe extension", () => {
    expect(suggestedDownloadFilename({
      id: "tsk_0123456789abcdef0123456789abcdef",
      platform: "instagram",
      canonicalUrl: "https://www.instagram.com/"
    }, format({ container: "exe", quality: "1080p / \"unsafe\"" }))).toBe(
      "TikDD-Instagram-89abcdef-1080p-unsafe.mp4"
    );
  });

  it("bounds long and unsafe values without allowing path separators", () => {
    const filename = suggestedDownloadFilename({
      id: "tsk_0123456789abcdef0123456789abcdef",
      platform: "instagram",
      canonicalUrl: "https://www.instagram.com/reel/short/"
    }, format({ quality: "x".repeat(300) }));
    expect(filename.startsWith("TikDD-Instagram-short-")).toBe(true);
    expect(filename.endsWith(".mp4")).toBe(true);
    expect(filename).not.toMatch(/[\\/]/);
    expect(filename.length).toBeLessThanOrEqual(120);
  });
});
