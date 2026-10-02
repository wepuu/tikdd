import { describe, expect, it } from "vitest";
import { loadYtDlpActivationConfiguration } from "../src/ytdlp-activation";
describe("yt-dlp activation", () => {
  it("defaults closed", () => expect(loadYtDlpActivationConfiguration({})).toMatchObject({ enabled: false, approvedPlatforms: [] }));
  it("requires both approvals and an explicit delivery capability", () => {
    expect(() => loadYtDlpActivationConfiguration({ ENABLE_YTDLP_PROVIDER: "true" })).toThrow(/gates/);
    expect(loadYtDlpActivationConfiguration({ ENABLE_YTDLP_PROVIDER: "true", YTDLP_RUNTIME_APPROVED: "true", YTDLP_DELIVERY_AUDIT_APPROVED: "true",
      YTDLP_APPROVED_PLATFORMS: "dailymotion", YTDLP_DELIVERY_VERIFIED_CAPABILITIES: "dailymotion:relay" }))
      .toMatchObject({ deliveryVerifiedCapabilities: { dailymotion: "relay" } });
  });
});
