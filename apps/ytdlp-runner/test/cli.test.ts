import { describe, expect, it } from "vitest";
import { classifyYtDlpProcessFailure } from "../src/cli";

describe("yt-dlp process failure classification", () => {
  it("classifies a missing impersonation runtime without preserving upstream output", () => {
    const message = classifyYtDlpProcessFailure(
      "ERROR: extractor attempted impersonation, but none of these impersonate targets are available: firefox https://example.invalid/private",
      1
    );

    expect(message).toBe("yt-dlp impersonation runtime is unavailable.");
    expect(message).not.toContain("example.invalid");
  });

  it("keeps other subprocess failures generic", () => {
    expect(classifyYtDlpProcessFailure("ERROR: upstream response changed", 7))
      .toBe("yt-dlp exited with status 7.");
  });
});
