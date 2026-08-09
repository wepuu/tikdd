import {
  PlatformIdSchema,
  ProviderFailureCodeSchema,
  RegionIdSchema
} from "@tikdd/contracts";
import { z } from "zod";

export const ProviderCircuitKeySchema = z.object({
  providerId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  platform: PlatformIdSchema,
  region: RegionIdSchema
});
export type ProviderCircuitKey = z.infer<typeof ProviderCircuitKeySchema>;

export const HealthFailureGroupSchema = z.enum([
  "integrity",
  "access-friction",
  "availability"
]);
export type HealthFailureGroup = z.infer<typeof HealthFailureGroupSchema>;

export const ProviderHealthObservationSchema = z
  .object({
    taskId: z.string().regex(/^tsk_[a-f0-9]{32}$/),
    providerId: ProviderCircuitKeySchema.shape.providerId,
    platform: PlatformIdSchema,
    region: RegionIdSchema,
    status: z.enum(["succeeded", "failed"]),
    failureCode: ProviderFailureCodeSchema.nullable(),
    durationMs: z.number().int().nonnegative(),
    finishedAt: z.string().datetime()
  })
  .superRefine((observation, context) => {
    if (observation.status === "succeeded" && observation.failureCode !== null) {
      context.addIssue({
        code: "custom",
        message: "A successful observation cannot have a failure code.",
        path: ["failureCode"]
      });
    }
    if (observation.status === "failed" && observation.failureCode === null) {
      context.addIssue({
        code: "custom",
        message: "A failed observation requires a failure code.",
        path: ["failureCode"]
      });
    }
  });
export type ProviderHealthObservation = z.infer<typeof ProviderHealthObservationSchema>;

const FailureThresholdSchema = z.object({
  minimumFailures: z.number().int().min(1).max(10_000),
  openRate: z.number().min(0).max(1)
});

export const CircuitPolicySchema = z
  .object({
    version: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    observationWindowMs: z.number().int().min(10_000).max(24 * 60 * 60 * 1_000),
    minimumDistinctTasks: z.number().int().min(1).max(10_000),
    thresholds: z.object({
      integrity: FailureThresholdSchema,
      accessFriction: FailureThresholdSchema,
      availability: FailureThresholdSchema
    }),
    baseCooldownMs: z.number().int().min(1_000).max(60 * 60 * 1_000),
    maximumCooldownMs: z.number().int().min(1_000).max(24 * 60 * 60 * 1_000),
    recoverySuccesses: z.number().int().min(1).max(100),
    snapshotTtlMs: z.number().int().min(10_000).max(48 * 60 * 60 * 1_000),
    probeLeaseMs: z.number().int().min(1_000).max(10 * 60 * 1_000),
    aggregationLeaseMs: z.number().int().min(1_000).max(10 * 60 * 1_000)
  })
  .superRefine((policy, context) => {
    if (policy.maximumCooldownMs < policy.baseCooldownMs) {
      context.addIssue({
        code: "custom",
        message: "maximumCooldownMs must be at least baseCooldownMs.",
        path: ["maximumCooldownMs"]
      });
    }
    if (policy.snapshotTtlMs < policy.observationWindowMs) {
      context.addIssue({
        code: "custom",
        message: "snapshotTtlMs must cover the observation window.",
        path: ["snapshotTtlMs"]
      });
    }
  });
export type CircuitPolicy = z.infer<typeof CircuitPolicySchema>;

export const CircuitStateSchema = z.enum(["closed", "open", "half-open"]);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const CircuitCountsSchema = z.object({
  succeeded: z.number().int().nonnegative(),
  integrity: z.number().int().nonnegative(),
  accessFriction: z.number().int().nonnegative(),
  availability: z.number().int().nonnegative(),
  neutralContentPolicy: z.number().int().nonnegative(),
  neutralCapability: z.number().int().nonnegative()
});
export type CircuitCounts = z.infer<typeof CircuitCountsSchema>;

export const CircuitSnapshotSchema = z.object({
  key: ProviderCircuitKeySchema,
  state: CircuitStateSchema,
  successRate: z.number().min(0).max(1),
  latencyP95Ms: z.number().int().nonnegative(),
  sampleCount: z.number().int().nonnegative(),
  counts: CircuitCountsSchema,
  insufficientData: z.boolean(),
  reason: HealthFailureGroupSchema.nullable(),
  calculatedAt: z.string().datetime(),
  windowStartedAt: z.string().datetime(),
  lastTransitionAt: z.string().datetime(),
  openedAt: z.string().datetime().nullable(),
  openUntil: z.string().datetime().nullable(),
  probeLeaseExpiresAt: z.string().datetime().nullable(),
  consecutiveOpenCount: z.number().int().nonnegative(),
  recoverySuccessCount: z.number().int().nonnegative(),
  policyVersion: z.string().min(1).max(64),
  revision: z.number().int().nonnegative()
});
export type CircuitSnapshot = z.infer<typeof CircuitSnapshotSchema>;

export interface ProviderRoutingHealthSnapshot {
  state: CircuitState;
  successRate: number;
  latencyP95Ms: number;
  insufficientData: boolean;
  openUntil: string | null;
  calculatedAt: string;
}

export interface ProviderRoutingHealthSource {
  get(key: ProviderCircuitKey): Promise<ProviderRoutingHealthSnapshot>;
  acquireProbe(key: ProviderCircuitKey): Promise<boolean>;
}
