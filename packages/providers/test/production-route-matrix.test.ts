import { describe, expect, it } from "vitest";
import {
  FDownIsuruProvider,
  PinterestVideoDownloaderProvider,
  SaveFromInsProvider,
  SnapTikMonsterProvider,
  SocialDownloaderProvider,
  SSSTwitterProvider,
  TikCDProvider,
  VidDownProvider,
  LocoLoaderProvider
} from "../src/index";

function priority(provider: { manifest: { platforms: readonly { platform: string; priority: number }[] } }, platform: string) {
  return provider.manifest.platforms.find((capability) => capability.platform === platform)?.priority;
}

describe("production route matrix", () => {
  it("keeps the approved primary and sequential fallback order deterministic", () => {
    const ssstwitter = new SSSTwitterProvider({ enabled: true });
    const savefromins = new SaveFromInsProvider({ enabled: true });
    const snaptik = new SnapTikMonsterProvider({ enabled: true });
    const tikcd = new TikCDProvider({ enabled: true });
    const fdown = new FDownIsuruProvider({ enabled: true });
    const social = new SocialDownloaderProvider({
      enabled: true,
      approvedPlatforms: ["facebook", "x"],
      deliveryVerifiedPlatforms: ["facebook", "x"]
    });
    const viddown = new VidDownProvider({ enabled: true });

    expect([priority(ssstwitter, "x"), priority(social, "x")]).toEqual([800, 650]);
    expect(priority(savefromins, "instagram")).toBe(900);
    expect([priority(snaptik, "tiktok"), priority(tikcd, "tiktok")]).toEqual([850, 760]);
    expect([priority(fdown, "facebook"), priority(social, "facebook")]).toEqual([700, 650]);
    expect(priority(viddown, "vimeo")).toBe(760);
  });

  it("keeps Pinterest implemented but default-off until the production gate is approved", () => {
    const pinterest = new PinterestVideoDownloaderProvider();
    expect(pinterest.manifest.enabled).toBe(false);
    expect(pinterest.manifest.platforms).toEqual([
      expect.objectContaining({ platform: "pinterest", priority: 760, deliveryModes: ["redirect"] })
    ]);
  });

  it("keeps xHamster implemented but default-off until the production gate is approved", () => {
    const xhamster = new LocoLoaderProvider();
    expect(xhamster.manifest.enabled).toBe(false);
    expect(xhamster.manifest.platforms).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "xhamster", priority: 480, deliveryModes: ["redirect"] }),
      expect.objectContaining({ platform: "tiktok", deliveryModes: [] }),
      expect.objectContaining({ platform: "facebook", deliveryModes: [] })
    ]));
  });
});
