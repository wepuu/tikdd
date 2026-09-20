import { describe, expect, it } from "vitest";
import { loadSSSTwitterActivationConfiguration } from "../src/provider-activation";
import { loadSnapInstaActivationConfiguration } from "../src/snapinsta-activation";
import { loadTikVidActivationConfiguration } from "../src/tikvid-activation";
import { loadPinterestVideoDownloaderActivationConfiguration } from "../src/pinterest-videodownloader-activation";

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
