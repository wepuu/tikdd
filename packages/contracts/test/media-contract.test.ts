import { describe, expect, it } from "vitest";
import { PublicThumbnailUrlSchema } from "../src/index";

describe("public thumbnail URL contract", () => {
  it("accepts bounded credential-free HTTPS URLs", () => {
    expect(PublicThumbnailUrlSchema.parse("https://pbs.twimg.com/media/preview.jpg"))
      .toBe("https://pbs.twimg.com/media/preview.jpg");
  });

  it.each([
    "http://pbs.twimg.com/media/preview.jpg",
    "https://user:pass@pbs.twimg.com/media/preview.jpg",
    "https://pbs.twimg.com:8443/media/preview.jpg",
    `https://pbs.twimg.com/${"a".repeat(4_100)}`
  ])("rejects an unsafe public thumbnail URL: %s", (value) => {
    expect(PublicThumbnailUrlSchema.safeParse(value).success).toBe(false);
  });
});
