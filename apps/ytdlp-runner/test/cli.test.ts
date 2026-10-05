import { describe, expect, it } from "vitest";
import { buildYtDlpPlatformArgs, classifyYtDlpProcessFailure } from "../src/cli";

describe("yt-dlp process failure classification", () => {
  it("enables the PO Token plugin only for YouTube", () => {
    const previousClient = process.env.YTDLP_YOUTUBE_PLAYER_CLIENT;
    const previousProvider = process.env.YTDLP_YOUTUBE_POT_PROVIDER_URL;
    process.env.YTDLP_YOUTUBE_PLAYER_CLIENT = "mweb";
    process.env.YTDLP_YOUTUBE_POT_PROVIDER_URL = "http://ytdlp-pot-provider:4416";
    try {
      const youtube = buildYtDlpPlatformArgs("youtube").join(" ");
      const dailymotion = buildYtDlpPlatformArgs("dailymotion").join(" ");
      expect(youtube).toContain("player-client=mweb");
      expect(youtube).toContain("youtubepot-bgutilhttp:base_url=http://ytdlp-pot-provider:4416");
      expect(youtube).not.toContain("--no-plugin-dirs");
      expect(dailymotion).toContain("--no-plugin-dirs");
    } finally {
      if (previousClient === undefined) delete process.env.YTDLP_YOUTUBE_PLAYER_CLIENT;
      else process.env.YTDLP_YOUTUBE_PLAYER_CLIENT = previousClient;
      if (previousProvider === undefined) delete process.env.YTDLP_YOUTUBE_POT_PROVIDER_URL;
      else process.env.YTDLP_YOUTUBE_POT_PROVIDER_URL = previousProvider;
    }
  });

  it("classifies a missing impersonation runtime without preserving upstream output", () => {
    const message = classifyYtDlpProcessFailure(
      "ERROR: extractor attempted impersonation, but none of these impersonate targets are available: firefox https://example.invalid/private",
      1
    );

    expect(message).toEqual({
      code: "runtime_dependency_unavailable",
      message: "yt-dlp impersonation runtime is unavailable."
    });
    expect(JSON.stringify(message)).not.toContain("example.invalid");
  });

  it("classifies YouTube rate limits and bot challenges without leaking stderr", () => {
    expect(classifyYtDlpProcessFailure("HTTP Error 429: Too Many Requests https://youtube.invalid/watch?v=secret", 1))
      .toEqual({ code: "rate_limited", message: "yt-dlp upstream rate limit was reached." });
    expect(classifyYtDlpProcessFailure("Sign in to confirm you're not a bot; visitor data=secret", 1))
      .toEqual({ code: "bot_challenge", message: "yt-dlp upstream requested an anonymous bot check." });
  });

  it("classifies PO Token and no-media failures", () => {
    expect(classifyYtDlpProcessFailure("Unable to fetch GVS PO Token: Missing required Visitor Data", 1))
      .toEqual({ code: "po_token_required", message: "yt-dlp could not obtain the required YouTube proof-of-origin data." });
    expect(classifyYtDlpProcessFailure("ERROR: No video formats found", 1))
      .toEqual({ code: "no_media", message: "yt-dlp found no downloadable media." });
  });

  it("keeps unknown subprocess failures generic", () => {
    expect(classifyYtDlpProcessFailure("ERROR: upstream response changed", 7))
      .toEqual({ code: "extractor_error", message: "yt-dlp exited with status 7." });
  });
});
