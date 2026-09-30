import { describe, expect, it } from "vitest";
import {
  assessCobaltOkruQualification,
  assessCurrentCobaltOkruQualification,
  COBALT_OKRU_QUALIFICATION_EVIDENCE,
  CobaltOkruQualificationEvidenceSchema
} from "../src";

const qualified = {
  ...COBALT_OKRU_QUALIFICATION_EVIDENCE,
  samplesAttempted: 2,
  samplesResolved: 2,
  mediaHostPolicyVerified: true,
  mediaRangeVerified: true,
  crossExitVerified: true,
  browserSaveMode: "attachment" as const,
  failures: []
};

describe("Work Item 125 Cobalt OK.ru qualification", () => {
  it("keeps the failed closed-gate canary outside production", () => {
    expect(assessCurrentCobaltOkruQualification()).toEqual({
      providerId: "cobalt-selfhosted",
      platform: "odnoklassniki",
      status: "no-media",
      adapterEligible: false,
      productionRouteEligible: false,
      failures: [
        "provider_error_envelope",
        "insufficient_samples",
        "range_unverified",
        "cross_exit_unverified",
        "browser_save_unverified"
      ]
    });
  });

  it("requires both samples, portable OK CDN media, cross-exit Range and browser save", () => {
    expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse(qualified))).toMatchObject({
      status: "qualified",
      adapterEligible: true,
      productionRouteEligible: true,
      failures: []
    });

    for (const incomplete of [
      { ...qualified, samplesAttempted: 1 },
      { ...qualified, samplesResolved: 1 },
      { ...qualified, mediaHostPolicyVerified: false, failures: ["unsafe_media_host"] },
      { ...qualified, mediaRangeVerified: false, failures: ["range_unverified"] },
      { ...qualified, crossExitVerified: false, failures: ["cross_exit_unverified"] },
      { ...qualified, browserSaveMode: null, failures: ["browser_save_unverified"] }
    ]) {
      expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse(incomplete)).productionRouteEligible)
        .toBe(false);
    }
  });

  it("separates delivery blockers and browser-state blockers", () => {
    expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse({
      ...qualified,
      sourceIpBound: true,
      failures: ["source_ip_bound"]
    }))).toMatchObject({ status: "delivery-blocked", productionRouteEligible: false });

    expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse({
      ...qualified,
      browserStateRequired: true,
      failures: ["browser_state_required"]
    }))).toMatchObject({ status: "blocked", productionRouteEligible: false });
  });

  it("does not promote an unverified runtime or transient canary result", () => {
    expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse({
      ...qualified,
      runtimeProbePassed: false,
      failures: ["runtime_not_verified"]
    }))).toMatchObject({ status: "deferred", productionRouteEligible: false });
    expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse({
      ...qualified,
      temporaryFailure: true,
      failures: ["temporary_failure"]
    }))).toMatchObject({ status: "deferred", productionRouteEligible: false });
  });

  it("classifies a Cobalt error envelope with no media as no-media", () => {
    expect(assessCobaltOkruQualification(CobaltOkruQualificationEvidenceSchema.parse({
      ...COBALT_OKRU_QUALIFICATION_EVIDENCE,
      samplesAttempted: 1,
      failures: ["provider_error_envelope"]
    }))).toMatchObject({ status: "no-media", productionRouteEligible: false });
  });

  it("never serializes sample URLs, media URLs, credentials, or response bodies", () => {
    const serialized = JSON.stringify(COBALT_OKRU_QUALIFICATION_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/cookie|token|nonce|signature|response|cdn\.ru/i);
  });
});
