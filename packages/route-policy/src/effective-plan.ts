import { PlatformIdSchema, RegionIdSchema, type Platform, type RegionId } from "@tikdd/contracts";
import { z } from "zod";

const ProviderIdSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

/** Reasons are deliberately small and sanitized so they can be shown in Admin without leaking provider data. */
export const EffectiveRouteExclusionReasonSchema = z.enum([
  "manifest_disabled",
  "platform_unsupported",
  "region_ineligible",
  "no_delivery_mode",
  "mock_provider",
  "rollout_denied",
  "rollout_unavailable",
  "zero_allocation",
  "circuit_open",
  "concurrency_unavailable",
  "max_attempts"
]);

export type EffectiveRouteExclusionReason = z.infer<typeof EffectiveRouteExclusionReasonSchema>;

export interface EffectiveRouteRankInput {
  providerId: string;
  basePriority: number;
  costWeight: number;
  preferencePosition: number | null;
  manualOrderSize?: number;
  successRateBps?: number | null;
  p95LatencyMs?: number | null;
}

export interface RankedEffectiveRoute<T extends EffectiveRouteRankInput> {
  input: T;
  score: number;
}

/**
 * The single scoring function used by the worker and read-only Admin projections.
 * Manual order remains dominant; runtime health only breaks ties inside that order.
 */
export function effectiveRouteScore(input: EffectiveRouteRankInput): number {
  const successRate = Math.min(Math.max(input.successRateBps ?? 0, 0), 10_000) / 10_000;
  const latencyPenalty = Math.min(Math.max(input.p95LatencyMs ?? 0, 0) / 1_000, 50);
  const baseScore = input.basePriority * 1_000 + successRate * 100 - latencyPenalty - Math.max(input.costWeight, 0);
  if (input.preferencePosition === null) return baseScore;
  const orderSize = Math.max(input.manualOrderSize ?? input.preferencePosition, input.preferencePosition);
  return (orderSize - input.preferencePosition + 1) * 1_000_000_000 + baseScore;
}

export function rankEffectiveRoutes<T extends EffectiveRouteRankInput>(inputs: readonly T[]): RankedEffectiveRoute<T>[] {
  return inputs
    .map((input) => ({ input, score: effectiveRouteScore(input) }))
    .sort((left, right) => right.score - left.score || left.input.providerId.localeCompare(right.input.providerId));
}

export type EffectiveRouteEligibility =
  | "eligible"
  | "manifest_disabled"
  | "platform_unsupported"
  | "region_ineligible"
  | "no_delivery_mode"
  | "mock_provider"
  | "rollout_denied"
  | "rollout_unavailable"
  | "zero_allocation"
  | "circuit_open"
  | "concurrency_unavailable";

export interface EffectiveRouteCandidate extends EffectiveRouteRankInput {
  platform: Platform;
  region: RegionId;
  manifestEnabled: boolean;
  capabilityDeclared: boolean;
  regionEligible: boolean;
  deliveryModes: readonly string[];
  productionEligible: boolean;
  rollout: "allowed" | "denied" | "unavailable";
  allocationBps: number;
  circuitState: "closed" | "open" | "half-open" | "unknown";
  concurrencyAvailable?: boolean;
}

export interface EffectiveRoutePlanOptions {
  platform: Platform;
  region: RegionId;
  orderedProviderIds?: readonly string[];
  maxAttempts?: number;
}

export interface EffectiveRoutePlanEntry {
  providerId: string;
  eligibility: EffectiveRouteEligibility;
  exclusionReason: EffectiveRouteExclusionReason | null;
  score: number | null;
  preferencePosition: number | null;
}

export interface EffectiveRoutePlan {
  platform: Platform;
  region: RegionId;
  maxAttempts: number;
  manualOrder: {
    valid: boolean;
    configuredCount: number;
    unknownProviderCount: number;
  };
  attemptProviderIds: string[];
  entries: EffectiveRoutePlanEntry[];
}

type GateExclusionReason = Exclude<EffectiveRouteExclusionReason, "max_attempts">;

function exclusionFor(candidate: EffectiveRouteCandidate): GateExclusionReason | null {
  if (!candidate.capabilityDeclared) return "platform_unsupported";
  if (!candidate.regionEligible) return "region_ineligible";
  if (!candidate.manifestEnabled) return "manifest_disabled";
  if (candidate.deliveryModes.length === 0) return "no_delivery_mode";
  if (!candidate.productionEligible && candidate.deliveryModes.length > 0) return "mock_provider";
  if (candidate.rollout === "unavailable") return "rollout_unavailable";
  if (candidate.rollout === "denied") return "rollout_denied";
  if (candidate.allocationBps <= 0) return "zero_allocation";
  if (candidate.circuitState === "open") return "circuit_open";
  if (candidate.concurrencyAvailable === false) return "concurrency_unavailable";
  return null;
}

/** Build the explainable, bounded attempt order without probing a Provider. */
export function buildEffectiveRoutePlan(
  candidates: readonly EffectiveRouteCandidate[],
  options: EffectiveRoutePlanOptions
): EffectiveRoutePlan {
  const platform = PlatformIdSchema.parse(options.platform);
  const region = RegionIdSchema.parse(options.region);
  const maxAttempts = Math.min(Math.max(Math.trunc(options.maxAttempts ?? 4), 1), 16);
  const orderedProviderIds = [...new Set((options.orderedProviderIds ?? []).map((id) => ProviderIdSchema.parse(id)))];
  const candidateIds = new Set(candidates.map((candidate) => ProviderIdSchema.parse(candidate.providerId)));
  const unknownProviderCount = orderedProviderIds.filter((id) => !candidateIds.has(id)).length;
  const manualPositions = new Map(orderedProviderIds.map((providerId, index) => [providerId, index + 1]));
  const manualOrder = {
    valid: unknownProviderCount === 0 && orderedProviderIds.length === new Set(options.orderedProviderIds ?? []).size,
    configuredCount: orderedProviderIds.length,
    unknownProviderCount
  };

  const normalizedCandidates = candidates.map((candidate) => {
    const manualOrderSize = orderedProviderIds.length || candidate.manualOrderSize;
    return {
      ...candidate,
      preferencePosition: manualPositions.get(candidate.providerId) ?? candidate.preferencePosition,
      ...(manualOrderSize === undefined ? {} : { manualOrderSize })
    };
  });
  const entries: EffectiveRoutePlanEntry[] = normalizedCandidates.map((candidate) => {
    const reason = exclusionFor(candidate);
    return {
      providerId: ProviderIdSchema.parse(candidate.providerId),
      eligibility: reason ?? "eligible" as const,
      exclusionReason: reason,
      score: reason ? null : effectiveRouteScore(candidate),
      preferencePosition: candidate.preferencePosition
    };
  });
  const eligible = normalizedCandidates.filter((candidate) => exclusionFor(candidate) === null);
  const ranked = rankEffectiveRoutes(eligible);
  const attemptProviderIds = ranked.slice(0, maxAttempts).map(({ input }) => input.providerId);
  const attemptSet = new Set(attemptProviderIds);
  for (const entry of entries) {
    if (entry.eligibility === "eligible" && !attemptSet.has(entry.providerId)) {
      entry.eligibility = "eligible";
      entry.exclusionReason = "max_attempts";
    }
  }

  return { platform, region, maxAttempts, manualOrder, attemptProviderIds, entries };
}
