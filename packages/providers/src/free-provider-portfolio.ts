import {
  qualifyFreeProviderCandidate,
  type FreeProviderCandidate,
  type FreeProviderQualificationResult
} from "./free-provider-qualification";

/**
 * Offline owner-supplied candidate matrix for Work Item 51. These records are intentionally
 * code-owned and do not make network calls, persist state, or grant rollout permission.
 */
export const FREE_PROVIDER_PORTFOLIO: readonly FreeProviderCandidate[] = [
  {
    id: "tikvid",
    displayName: "TikVid.cc",
    platforms: ["tiktok"],
    freeAccess: true,
    publicContentOnly: true,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: true,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 1,
    failureFixtureCount: 4,
    evidenceState: "evaluating"
  },
  {
    id: "snapinsta",
    displayName: "SnapInsta.to",
    platforms: ["instagram"],
    freeAccess: true,
    publicContentOnly: true,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: true,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 1,
    failureFixtureCount: 4,
    evidenceState: "evaluating"
  },
  {
    id: "tokvid",
    displayName: "TokVid.io",
    platforms: ["tiktok"],
    freeAccess: true,
    publicContentOnly: true,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: false,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 0,
    failureFixtureCount: 0,
    evidenceState: "not-evaluated"
  },
  {
    id: "tikcd",
    displayName: "TikCD.com",
    platforms: ["tiktok"],
    freeAccess: true,
    publicContentOnly: true,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: false,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 0,
    failureFixtureCount: 0,
    evidenceState: "not-evaluated"
  },
  {
    id: "tikvid-io",
    displayName: "TikVid.io",
    platforms: ["tiktok"],
    freeAccess: true,
    publicContentOnly: true,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: false,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 0,
    failureFixtureCount: 0,
    evidenceState: "not-evaluated"
  },
  {
    id: "gramsnap",
    displayName: "GramSnap",
    platforms: ["instagram"],
    freeAccess: true,
    publicContentOnly: true,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: false,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 0,
    failureFixtureCount: 0,
    evidenceState: "not-evaluated"
  },
  {
    id: "savevid",
    displayName: "SaveVid.net",
    platforms: ["instagram"],
    freeAccess: true,
    publicContentOnly: false,
    requiresLogin: false,
    requiresCookies: false,
    requiresInteractiveChallenge: false,
    requiresPaidApi: false,
    manifestReviewed: false,
    hostPolicyReviewed: false,
    deliveryMode: "resolution-only",
    deliveryVerified: false,
    successFixtureCount: 0,
    failureFixtureCount: 0,
    evidenceState: "not-evaluated"
  }
] as const;

export function qualifyFreeProviderPortfolio(): readonly FreeProviderQualificationResult[] {
  return FREE_PROVIDER_PORTFOLIO.map((candidate) => qualifyFreeProviderCandidate(candidate));
}
