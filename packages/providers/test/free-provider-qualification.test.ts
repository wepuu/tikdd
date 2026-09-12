import { describe, expect, it } from "vitest";
import {
  FREE_PROVIDER_MIN_FAILURE_FIXTURES,
  qualifyFreeProviderCandidate,
  type FreeProviderCandidate
} from "../src/index";

const candidate = (overrides: Partial<FreeProviderCandidate> = {}): FreeProviderCandidate => ({
  id: "candidate-free",
  displayName: "Candidate free",
  platforms: ["instagram"],
  freeAccess: true,
  publicContentOnly: true,
  requiresLogin: false,
  requiresCookies: false,
  requiresInteractiveChallenge: false,
  requiresPaidApi: false,
  manifestReviewed: true,
  hostPolicyReviewed: true,
  deliveryMode: "redirect",
  deliveryVerified: true,
  successFixtureCount: 1,
  failureFixtureCount: FREE_PROVIDER_MIN_FAILURE_FIXTURES,
  evidenceState: "qualified",
  ...overrides
});

describe("free Provider qualification", () => {
  it("accepts only a fully reviewed public free candidate", () => {
    expect(qualifyFreeProviderCandidate(candidate())).toEqual({
      providerId: "candidate-free",
      status: "accepted",
      eligibleForImplementation: true,
      productionRouteEligible: true,
      reasons: []
    });
  });

  it("rejects policy-incompatible access requirements", () => {
    const result = qualifyFreeProviderCandidate(candidate({
      freeAccess: false,
      publicContentOnly: false,
      requiresLogin: true,
      requiresCookies: true,
      requiresInteractiveChallenge: true,
      requiresPaidApi: true
    }));
    expect(result.status).toBe("rejected");
    expect(result.eligibleForImplementation).toBe(false);
    expect(result.productionRouteEligible).toBe(false);
    expect(result.reasons).toEqual([
      "not_free",
      "public_only_boundary",
      "login_required",
      "cookies_required",
      "interactive_challenge",
      "paid_api_required"
    ]);
  });

  it("defers candidates until fixtures, host policy and delivery are reviewed", () => {
    const result = qualifyFreeProviderCandidate(candidate({
      manifestReviewed: false,
      hostPolicyReviewed: false,
      successFixtureCount: 0,
      failureFixtureCount: 0,
      deliveryVerified: false,
      evidenceState: "evaluating"
    }));
    expect(result.status).toBe("deferred");
    expect(result.eligibleForImplementation).toBe(false);
    expect(result.productionRouteEligible).toBe(false);
    expect(result.reasons).toEqual([
      "manifest_unreviewed",
      "host_policy_unreviewed",
      "missing_success_fixture",
      "missing_failure_fixtures",
      "delivery_unverified",
      "not_evaluated"
    ]);
  });

  it("does not require delivery verification for resolution-only technical candidates", () => {
    const result = qualifyFreeProviderCandidate(candidate({
      deliveryMode: "resolution-only",
      deliveryVerified: false
    }));
    expect(result.status).toBe("accepted");
    expect(result.eligibleForImplementation).toBe(true);
    expect(result.productionRouteEligible).toBe(false);
  });
});
