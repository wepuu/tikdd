import { describe, expect, it } from "vitest";
import { loadSocialDownloaderActivationConfiguration } from "../src/socialdownloader-activation";

describe("SocialDownloader activation", () => {
  it("defaults to disabled", () => {
    expect(loadSocialDownloaderActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
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
    })).toEqual({ enabled: true, termsApproved: true, deliveryAuditApproved: true });
  });
});
