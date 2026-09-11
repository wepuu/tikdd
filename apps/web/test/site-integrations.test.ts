import { describe, expect, it } from "vitest";
import { SiteIntegrationsSchema } from "@tikdd/admin-contracts";
import { analyticsInlineScript, SiteIntegrations } from "../components/site-integrations";

describe("site integrations", () => {
  it("accepts bounded Google identifiers and defaults them off", () => {
    expect(SiteIntegrationsSchema.parse({})).toEqual({ googleAnalyticsMeasurementId: null, googleAdsensePublisherId: null });
    expect(SiteIntegrationsSchema.parse({ googleAnalyticsMeasurementId: "G-ABC12345", googleAdsensePublisherId: "ca-pub-1234567890123456" })).toEqual({
      googleAnalyticsMeasurementId: "G-ABC12345",
      googleAdsensePublisherId: "ca-pub-1234567890123456"
    });
  });

  it("rejects arbitrary scripts and malformed publisher IDs", () => {
    expect(() => SiteIntegrationsSchema.parse({ googleAnalyticsMeasurementId: "<script>alert(1)</script>" })).toThrow();
    expect(() => SiteIntegrationsSchema.parse({ googleAdsensePublisherId: "ca-pub-abc" })).toThrow();
  });

  it("escapes identifiers before placing them in the inline analytics bootstrap", () => {
    const script = analyticsInlineScript("G-ABC12345");
    expect(script).toContain("gtag('config', \"G-ABC12345\")");
    expect(script).not.toContain("</script>");
  });

  it("keeps both tags disabled when the published snapshot has no IDs", () => {
    expect(SiteIntegrations({ integrations: { googleAnalyticsMeasurementId: null, googleAdsensePublisherId: null } })).toBeNull();
  });
});
