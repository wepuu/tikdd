import { describe, expect, it } from "vitest";
import {
  OKRU_DELIVERY_POC_EVIDENCE,
  OKRU_PROVIDER_BATCH_2_EVIDENCE,
  OkruBatchEvidenceSchema,
  OkruProviderEvidenceSchema,
  assessOkruBatch2Portfolio,
  assessOkruBatchEvidence,
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

describe("Work Item 119 OK.ru Provider batch 2", () => {
  it("keeps all four candidates isolated, sanitized, and outside production routing", () => {
    expect(OKRU_PROVIDER_BATCH_2_EVIDENCE.map(({ providerId }) => providerId)).toEqual([
      "okvid-download",
      "pastedownload-okru",
      "snapfrom-okru",
      "anydownloader-web-okru"
    ]);

    const serialized = JSON.stringify(OKRU_PROVIDER_BATCH_2_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/cookie|nonce|token|signature|cdn/i);

    const assessments = assessOkruBatch2Portfolio();
    expect(assessments.map(({ status }) => status)).toEqual([
      "no-media",
      "no-media",
      "blocked",
      "blocked"
    ]);
    expect(assessments.every(({ productionRouteEligible }) => !productionRouteEligible)).toBe(true);

    const portfolioIds = qualifyFreeProviderPortfolio().map(({ providerId }) => providerId);
    expect(portfolioIds).toContain("anydownloader");
    expect(portfolioIds).toContain("anydownloader-web-okru");
  });

  it("requires both samples, Range, cross-exit replay, and a browser save mode", () => {
    const base = {
      providerId: "fixture-okru-batch",
      endpointPath: "/resolve",
      endpointMethod: "POST" as const,
      samplesAttempted: 2,
      samplesResolved: 2,
      mediaRangeVerified: true,
      crossExitVerified: true,
      browserSaveMode: "cors-download" as const,
      browserStateRequired: false,
      requiresProviderPost: false,
      requiresProviderPage: false,
      sourceIpBound: false,
      temporaryFailure: false,
      failures: []
    };

    expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse(base))).toMatchObject({
      status: "qualified",
      adapterEligible: true,
      productionRouteEligible: true
    });

    for (const incomplete of [
      { ...base, samplesAttempted: 1 },
      { ...base, samplesResolved: 1 },
      { ...base, mediaRangeVerified: false },
      { ...base, crossExitVerified: false },
      { ...base, browserSaveMode: null }
    ]) {
      const assessment = assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse(incomplete));
      expect(assessment.productionRouteEligible).toBe(false);
    }
  });

  it("rejects unsafe response and delivery topologies", () => {
    const base = {
      providerId: "fixture-okru-reject",
      endpointPath: "/resolve",
      endpointMethod: "POST" as const,
      samplesAttempted: 1,
      samplesResolved: 0,
      mediaRangeVerified: false,
      crossExitVerified: false,
      browserSaveMode: null,
      browserStateRequired: false,
      requiresProviderPost: false,
      requiresProviderPage: false,
      sourceIpBound: false,
      temporaryFailure: false,
      failures: ["no_media" as const]
    };
    expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse(base)).status).toBe("no-media");
    expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse({
      ...base,
      failures: ["invalid_media_descriptor"]
    })).status).toBe("no-media");
    expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse({
      ...base,
      sourceIpBound: true,
      failures: ["source_ip_bound"]
    })).status).toBe("delivery-blocked");
    expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse({
      ...base,
      requiresProviderPost: true,
      failures: ["provider_post_only"]
    })).status).toBe("delivery-blocked");
    expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse({
      ...base,
      browserStateRequired: true,
      failures: ["browser_state_required"]
    })).status).toBe("blocked");

    for (const failure of [
      "hls_only",
      "split_media_only",
      "invalid_mime",
      "empty_media",
      "unsafe_media_host"
    ] as const) {
      expect(assessOkruBatchEvidence(OkruBatchEvidenceSchema.parse({
        ...base,
        failures: [failure]
      })).status).toBe("no-media");
    }
  });
});
