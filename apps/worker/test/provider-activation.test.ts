import { describe, expect, it } from "vitest";
import { loadSSSTwitterActivationConfiguration } from "../src/provider-activation";
import { loadSnapInstaActivationConfiguration } from "../src/snapinsta-activation";
import { loadTikVidActivationConfiguration } from "../src/tikvid-activation";
import { loadPinterestVideoDownloaderActivationConfiguration } from "../src/pinterest-videodownloader-activation";
import { loadVidDownActivationConfiguration } from "../src/viddown-activation";
import { loadLocoLoaderActivationConfiguration } from "../src/locoloader-activation";
import { loadNineXBuddyActivationConfiguration } from "../src/nine-x-buddy-activation";
import { loadGetXHamsterActivationConfiguration } from "../src/getxhamster-activation";

describe("SSSTwitter worker activation", () => {
  it("is fail-closed by default", () => {
    expect(loadSSSTwitterActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
  });

  it("refuses enablement without independent terms approval", () => {
    expect(() =>
      loadSSSTwitterActivationConfiguration({ ENABLE_SSSTWITTER_PROVIDER: "true" })
    ).toThrow(/SSSTWITTER_TERMS_APPROVED/);
  });

  it("refuses enablement until the delivery audit is approved", () => {
    expect(() =>
      loadSSSTwitterActivationConfiguration({
        ENABLE_SSSTWITTER_PROVIDER: "true",
        SSSTWITTER_TERMS_APPROVED: "true"
      })
    ).toThrow(/SSSTWITTER_DELIVERY_AUDIT_APPROVED/);
  });

  it("admits registration only after both independent gates are explicit", () => {
    expect(
      loadSSSTwitterActivationConfiguration({
        ENABLE_SSSTWITTER_PROVIDER: "true",
        SSSTWITTER_TERMS_APPROVED: "true",
        SSSTWITTER_DELIVERY_AUDIT_APPROVED: "true"
      }).enabled
    ).toBe(true);
  });
});

describe("Work Item 51 candidate activation", () => {
  it("keeps TikVid and SnapInsta disabled by default", () => {
    expect(loadTikVidActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
    expect(loadSnapInstaActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
  });

  it.each([
    ["TikVid", loadTikVidActivationConfiguration, "ENABLE_TIKVID_PROVIDER", "TIKVID_TERMS_APPROVED", "TIKVID_DELIVERY_AUDIT_APPROVED"],
    ["SnapInsta", loadSnapInstaActivationConfiguration, "ENABLE_SNAPINSTA_PROVIDER", "SNAPINSTA_TERMS_APPROVED", "SNAPINSTA_DELIVERY_AUDIT_APPROVED"]
  ] as const)("requires independent gates for %s", (_name, load, enabledKey, termsKey, deliveryKey) => {
    expect(() => load({ [enabledKey]: "true" })).toThrow(termsKey);
    expect(() => load({ [enabledKey]: "true", [termsKey]: "true" })).toThrow(deliveryKey);
    expect(load({ [enabledKey]: "true", [termsKey]: "true", [deliveryKey]: "true" }).enabled).toBe(true);
  });
});

describe("Work Item 79 Pinterest activation", () => {
  it("is disabled by default and requires both gates", () => {
    expect(loadPinterestVideoDownloaderActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
    expect(() => loadPinterestVideoDownloaderActivationConfiguration({
      ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER: "true"
    })).toThrow(/PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED/);
    expect(() => loadPinterestVideoDownloaderActivationConfiguration({
      ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER: "true",
      PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED: "true"
    })).toThrow(/PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED/);
    expect(loadPinterestVideoDownloaderActivationConfiguration({
      ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER: "true",
      PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED: "true",
      PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
  });
});

describe("Work Item 83 VidDown Vimeo activation", () => {
  it("is disabled by default and requires both gates", () => {
    expect(loadVidDownActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
    expect(() => loadVidDownActivationConfiguration({
      ENABLE_VIDDOWN_PROVIDER: "true"
    })).toThrow(/VIDDOWN_TERMS_APPROVED/);
    expect(() => loadVidDownActivationConfiguration({
      ENABLE_VIDDOWN_PROVIDER: "true",
      VIDDOWN_TERMS_APPROVED: "true"
    })).toThrow(/VIDDOWN_DELIVERY_AUDIT_APPROVED/);
    expect(loadVidDownActivationConfiguration({
      ENABLE_VIDDOWN_PROVIDER: "true",
      VIDDOWN_TERMS_APPROVED: "true",
      VIDDOWN_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
  });
});

describe("Work Item 98 LocoLoader xHamster activation", () => {
  it("is disabled by default and requires both gates", () => {
    expect(loadLocoLoaderActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false,
      approvedPlatforms: ["xhamster"],
      deliveryVerifiedPlatforms: ["xhamster"],
      maxExtractions: 2,
      quotaWindowMs: 6 * 60 * 60 * 1_000,
      maxConcurrency: 1,
      minIntervalMs: 1_000
    });
    expect(() => loadLocoLoaderActivationConfiguration({ ENABLE_LOCOLOADER_PROVIDER: "true" }))
      .toThrow(/LOCOLOADER_TERMS_APPROVED/);
    expect(() => loadLocoLoaderActivationConfiguration({
      ENABLE_LOCOLOADER_PROVIDER: "true",
      LOCOLOADER_TERMS_APPROVED: "true"
    })).toThrow(/LOCOLOADER_DELIVERY_AUDIT_APPROVED/);
    expect(loadLocoLoaderActivationConfiguration({
      ENABLE_LOCOLOADER_PROVIDER: "true",
      LOCOLOADER_TERMS_APPROVED: "true",
      LOCOLOADER_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
    expect(loadLocoLoaderActivationConfiguration({
      LOCOLOADER_APPROVED_PLATFORMS: "xhamster,tiktok",
      LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS: "xhamster",
      LOCOLOADER_MAX_EXTRACTIONS: "2",
      LOCOLOADER_QUOTA_WINDOW_MS: "21600000"
    }).approvedPlatforms).toEqual(["xhamster", "tiktok"]);
    expect(() => loadLocoLoaderActivationConfiguration({
      LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS: "tiktok"
    })).toThrow(/may only contain xhamster/);
  });
});

describe("Work Item 100 9xBuddy xHamster activation", () => {
  it("is disabled by default and keeps Dailymotion Lab-only", () => {
    expect(loadNineXBuddyActivationConfiguration({})).toEqual({
      enabled: false,
      automationUseApproved: false,
      deliveryAuditApproved: false,
      approvedPlatforms: ["xhamster"],
      deliveryVerifiedPlatforms: ["xhamster"],
      maxConcurrency: 1,
      minIntervalMs: 2_000
    });
    expect(() => loadNineXBuddyActivationConfiguration({ ENABLE_9XBUDDY_PROVIDER: "true" }))
      .toThrow(/NINE_X_BUDDY_AUTOMATION_USE_APPROVED/);
    expect(() => loadNineXBuddyActivationConfiguration({
      ENABLE_9XBUDDY_PROVIDER: "true",
      NINE_X_BUDDY_AUTOMATION_USE_APPROVED: "true"
    })).toThrow(/NINE_X_BUDDY_DELIVERY_AUDIT_APPROVED/);
    expect(loadNineXBuddyActivationConfiguration({
      ENABLE_9XBUDDY_PROVIDER: "true",
      NINE_X_BUDDY_AUTOMATION_USE_APPROVED: "true",
      NINE_X_BUDDY_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
    expect(() => loadNineXBuddyActivationConfiguration({
      NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS: "dailymotion"
    })).toThrow(/may only contain xhamster/);
  });
});

describe("Work Item 105 GetXHamster xHamster activation", () => {
  it("is disabled by default and requires both approvals", () => {
    expect(loadGetXHamsterActivationConfiguration({})).toEqual({
      enabled: false,
      automationUseApproved: false,
      deliveryAuditApproved: false,
      approvedPlatforms: ["xhamster"],
      deliveryVerifiedPlatforms: ["xhamster"],
      maxConcurrency: 1,
      minIntervalMs: 2_000
    });
    expect(() => loadGetXHamsterActivationConfiguration({ ENABLE_GETXHAMSTER_PROVIDER: "true" }))
      .toThrow(/GETXHAMSTER_AUTOMATION_USE_APPROVED/);
    expect(() => loadGetXHamsterActivationConfiguration({
      ENABLE_GETXHAMSTER_PROVIDER: "true",
      GETXHAMSTER_AUTOMATION_USE_APPROVED: "true"
    })).toThrow(/GETXHAMSTER_DELIVERY_AUDIT_APPROVED/);
    expect(loadGetXHamsterActivationConfiguration({
      ENABLE_GETXHAMSTER_PROVIDER: "true",
      GETXHAMSTER_AUTOMATION_USE_APPROVED: "true",
      GETXHAMSTER_DELIVERY_AUDIT_APPROVED: "true",
      GETXHAMSTER_MAX_CONCURRENCY: "1",
      GETXHAMSTER_MIN_INTERVAL_MS: "2000"
    }).enabled).toBe(true);
    expect(() => loadGetXHamsterActivationConfiguration({
      GETXHAMSTER_DELIVERY_VERIFIED_PLATFORMS: "tiktok"
    })).toThrow(/contains unsupported platform/i);
  });
});
