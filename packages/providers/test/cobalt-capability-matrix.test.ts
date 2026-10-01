import { describe, expect, it } from "vitest";
import {
  assessCobaltPlatformQualification,
  mapCobaltRuntimeServicesToPlatforms,
  parseCobaltRuntimeServices,
  CobaltPlatformQualificationEvidenceSchema
} from "../src";

const qualified = {
  providerId: "cobalt-selfhosted" as const,
  platform: "vimeo",
  runtimeProbePassed: true,
  runtimeServiceAdvertised: true,
  apiKeyAllowed: true,
  serviceDisabled: false,
  samplesAttempted: 2,
  samplesResolved: 2,
  responseModes: ["redirect", "picker"] as const,
  deliveryTopology: "direct-source" as const,
  mediaHostPolicyVerified: true,
  mediaRangeVerified: true,
  resolverExitVerified: true,
  clientDirectExitVerified: true,
  clientProxyExitVerified: true,
  originHairpinStatus: "not-applicable" as const,
  tunnelBoundaryVerified: false,
  localProcessingVerified: false,
  deliveryHandoffVerified: true,
  browserSaveMode: "attachment" as const,
  browserSaveVerified: true,
  browserStateRequired: false,
  requiresProviderPage: false,
  sourceIpBound: false,
  temporaryFailure: false,
  failures: [] as const
};

describe("Cobalt capability matrix", () => {
  it("reads only the documented cobalt.services path and normalizes reviewed aliases", () => {
    expect(parseCobaltRuntimeServices({
      services: ["twitter", "spoofed"],
      cobalt: { services: ["twitter", { id: "ok" }, { name: "vimeo" }, "twitter"] }
    })).toEqual(["twitter", "ok", "vimeo"]);
    expect(mapCobaltRuntimeServicesToPlatforms(["twitter", "ok", "vimeo", "unknown"]))
      .toEqual(["x", "odnoklassniki", "vimeo"]);
    expect(parseCobaltRuntimeServices({ services: ["vimeo"] })).toEqual([]);
  });

  it("requires runtime, two samples and all direct-delivery gates", () => {
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse(qualified)))
      .toMatchObject({ status: "qualified-secondary", adapterEligible: true, productionRouteEligible: true });

    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      samplesAttempted: 1,
      samplesResolved: 1,
      failures: ["range_unverified"]
    }))).toMatchObject({ status: "delivery-blocked", productionRouteEligible: false });

    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      samplesAttempted: 1,
      samplesResolved: 1
    }))).toMatchObject({ status: "resolved-candidate", productionRouteEligible: false });
  });

  it("qualifies an audited tunnel without requiring the origin hairpin", () => {
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      responseModes: ["tunnel"],
      deliveryTopology: "provider-tunnel",
      resolverExitVerified: false,
      originHairpinStatus: "edge-blocked",
      tunnelBoundaryVerified: true
    }))).toMatchObject({ status: "qualified-secondary", productionRouteEligible: true });
  });

  it("keeps tunnel and local-processing results closed until their mode-specific audits pass", () => {
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      responseModes: ["tunnel"],
      deliveryTopology: "provider-tunnel",
      resolverExitVerified: false,
      originHairpinStatus: "edge-blocked",
      tunnelBoundaryVerified: true,
      deliveryHandoffVerified: false,
      browserSaveVerified: false,
      failures: ["delivery_handoff_unverified", "browser_save_unverified"]
    }))).toMatchObject({ status: "resolved-conditional", productionRouteEligible: false });
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      responseModes: ["local-processing"],
      deliveryTopology: "browser-local-processing",
      resolverExitVerified: false,
      originHairpinStatus: "edge-blocked",
      tunnelBoundaryVerified: true,
      localProcessingVerified: false,
      failures: ["local_processing_unverified"]
    }))).toMatchObject({ status: "resolved-conditional", productionRouteEligible: false });
  });

  it("rejects missing client exits and delivery-blocked outcomes", () => {
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      responseModes: ["tunnel"],
      deliveryTopology: "provider-tunnel",
      resolverExitVerified: false,
      clientProxyExitVerified: false,
      originHairpinStatus: "edge-blocked",
      tunnelBoundaryVerified: true,
      failures: ["client_exit_unverified"]
    }))).toMatchObject({ status: "delivery-blocked", productionRouteEligible: false });
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      sourceIpBound: true,
      failures: ["source_ip_bound"]
    }))).toMatchObject({ status: "delivery-blocked", productionRouteEligible: false });
  });

  it("does not serialize URLs, response bodies, credentials or signed values", () => {
    const serialized = JSON.stringify(qualified);
    expect(serialized).not.toMatch(/https?:\/\/|cookie|token|nonce|signature|cdn/i);
  });
});
