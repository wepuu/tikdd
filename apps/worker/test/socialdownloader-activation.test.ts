import { describe, expect, it } from "vitest";
import { loadSocialDownloaderActivationConfiguration } from "../src/socialdownloader-activation";

describe("SocialDownloader activation", () => {
  it("defaults to disabled", () => {
    expect(loadSocialDownloaderActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false,
      approvedPlatforms: ["facebook"],
      deliveryVerifiedPlatforms: ["facebook"],
      maxConcurrency: 1,
      minIntervalMs: 750,
      maxCooldownMs: 60_000
    });
  });

  it("requires both approvals before enabling", () => {
    expect(() => loadSocialDownloaderActivationConfiguration({
      ENABLE_SOCIALDOWNLOADER_PROVIDER: "true"
    })).toThrow(/SOCIALDOWNLOADER_TERMS_APPROVED/);
    expect(() => loadSocialDownloaderActivationConfiguration({
      ENABLE_SOCIALDOWNLOADER_PROVIDER: "true",
      SOCIALDOWNLOADER_TERMS_APPROVED: "true"
    })).toThrow(/SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED/);
    expect(loadSocialDownloaderActivationConfiguration({
      ENABLE_SOCIALDOWNLOADER_PROVIDER: "true",
      SOCIALDOWNLOADER_TERMS_APPROVED: "true",
      SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED: "true"
    })).toEqual({
      enabled: true,
      termsApproved: true,
      deliveryAuditApproved: true,
      approvedPlatforms: ["facebook"],
      deliveryVerifiedPlatforms: ["facebook"],
      maxConcurrency: 1,
      minIntervalMs: 750,
      maxCooldownMs: 60_000
    });
  });

  it("parses a bounded platform allowlist and shared budget", () => {
    expect(loadSocialDownloaderActivationConfiguration({
      SOCIALDOWNLOADER_APPROVED_PLATFORMS: "facebook,x,tiktok",
      SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS: "facebook,x",
      SOCIALDOWNLOADER_MAX_CONCURRENCY: "2",
      SOCIALDOWNLOADER_MIN_INTERVAL_MS: "1200",
      SOCIALDOWNLOADER_MAX_COOLDOWN_MS: "90000"
    })).toMatchObject({
      approvedPlatforms: ["facebook", "x", "tiktok"],
      deliveryVerifiedPlatforms: ["facebook", "x"],
      maxConcurrency: 2,
      minIntervalMs: 1200,
      maxCooldownMs: 90000
    });
  });

  it("requires verified platforms to be approved", () => {
    expect(() => loadSocialDownloaderActivationConfiguration({
      SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS: "facebook,x"
    })).toThrow(/must be a subset/);
  });

  it("rejects verified platforms without a reviewed Delivery policy", () => {
    expect(() => loadSocialDownloaderActivationConfiguration({
      SOCIALDOWNLOADER_APPROVED_PLATFORMS: "facebook,instagram",
      SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS: "facebook,instagram"
    })).toThrow(/without a reviewed Delivery policy/);
  });
});
