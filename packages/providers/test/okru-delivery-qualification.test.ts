import { describe, expect, it } from "vitest";
import {
  OKRU_DELIVERY_POC_EVIDENCE,
  OkruProviderEvidenceSchema,
  assessOkruDeliveryEvidence,
  assessOkruDeliveryPortfolio,
  qualifyFreeProviderPortfolio
} from "../src/index";

describe("Work Item 118 OK.ru delivery qualification", () => {
  it("keeps the eight reviewed candidates code-owned and sanitized", () => {
    expect(OKRU_DELIVERY_POC_EVIDENCE.map(({ providerId }) => providerId)).toEqual([
      "tryunsora-okru",
      "mediapuller-okru",
      "get-from-okru",
      "a2z-okru",
      "toolsphare-okru",
      "saveclips-okru",
      "okgrabber",
      "sparkdownloader-okru"
    ]);

    const serialized = JSON.stringify(OKRU_DELIVERY_POC_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/cookie|nonce|token|sig|srcIp/i);
  });

  it("keeps every OK.ru candidate outside implementation and production routing", () => {
    const providerIds = OKRU_DELIVERY_POC_EVIDENCE.map(({ providerId }) => providerId);
    const assessments = qualifyFreeProviderPortfolio().filter(({ providerId }) =>
      providerIds.includes(providerId)
    );

    expect(assessments).toHaveLength(providerIds.length);
    for (const assessment of assessments) {
      expect(assessment).toMatchObject({
        status: "deferred",
        eligibleForImplementation: false,
        productionRouteEligible: false
      });
    }
  });

  it("blocks the repeatable OKGrabber resolver because its media is source-IP-bound", () => {
    const assessment = assessOkruDeliveryPortfolio().find(({ providerId }) => providerId === "okgrabber");
    expect(assessment).toEqual({
      providerId: "okgrabber",
      status: "blocked",
      adapterEligible: false,
      productionRouteEligible: false,
      failures: ["source_ip_bound", "provider_page_handoff", "cross_exit_unverified"]
    });
  });

  it("does not mistake a success envelope or anonymous nonce for deliverable media", () => {
    const assessments = assessOkruDeliveryPortfolio();
    expect(assessments.find(({ providerId }) => providerId === "toolsphare-okru")).toMatchObject({
      status: "deferred",
      adapterEligible: false,
      failures: expect.arrayContaining(["invalid_media_descriptor", "provider_post_only"])
    });
    expect(assessments.find(({ providerId }) => providerId === "saveclips-okru")).toMatchObject({
      status: "deferred",
      adapterEligible: false,
      failures: expect.arrayContaining(["no_media"])
    });
  });

  it("qualifies only a repeatable, portable browser GET with verified media Range", () => {
    const qualified = OkruProviderEvidenceSchema.parse({
      providerId: "fixture-okru",
      endpointPath: "/media",
      samplesAttempted: 2,
      samplesResolved: 2,
      mediaRangeVerified: true,
      crossExitVerified: true,
      browserGetEligible: true,
      requiresProviderPost: false,
      requiresProviderPage: false,
      sourceIpBound: false,
      failures: []
    });
    expect(assessOkruDeliveryEvidence(qualified)).toEqual({
      providerId: "fixture-okru",
      status: "qualified",
      adapterEligible: true,
      productionRouteEligible: true,
      failures: []
    });
  });
});
