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
  mediaHostPolicyVerified: true,
  mediaRangeVerified: true,
  crossExitVerified: true,
  browserSaveMode: "attachment" as const,
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

  it("rejects proxy-only and delivery-blocked outcomes", () => {
    expect(assessCobaltPlatformQualification(CobaltPlatformQualificationEvidenceSchema.parse({
      ...qualified,
      responseModes: ["tunnel"],
      failures: ["non_portable_result"]
    }))).toMatchObject({ status: "proxy-only", productionRouteEligible: false });
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
