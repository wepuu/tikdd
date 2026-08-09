import { RegionIdSchema } from "@tikdd/contracts";

export interface CanarySchedulerConfiguration {
  deployment: string;
  region: string;
  intervalMs: number;
  leaseTtlMs: number;
  runTimeoutMs: number;
  measurementRetentionMs: number;
  rolloutMaximumStaleMs: number;
  rolloutCohortKey: Uint8Array;
}

function integer(environment: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const value = Number(environment[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} is invalid.`);
  return value;
}

export function loadCanarySchedulerConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): CanarySchedulerConfiguration {
  if (environment.TIKDD_CANARY_AUTHORIZED !== "true") {
    throw new Error("TIKDD_CANARY_AUTHORIZED=true is required after reviewing the authorization record.");
  }
  if (environment.PROVIDER_ROLLOUT_ENABLED !== "true") {
    throw new Error("Scheduled canaries require runtime rollout controls.");
  }
  if (environment.PROVIDER_HEALTH_ENABLED !== "true") {
    throw new Error("Scheduled canaries require circuit controls.");
  }
  if (environment.ADMISSION_CONTROL_ENABLED !== "true") {
    throw new Error("Scheduled canaries require distributed provider concurrency controls.");
  }
  const deployment = environment.CANARY_DEPLOYMENT ?? "development";
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(deployment)) throw new Error("CANARY_DEPLOYMENT is invalid.");
  if (environment.NODE_ENV === "production" && environment.CANARY_DEPLOYMENT === undefined) {
    throw new Error("CANARY_DEPLOYMENT is required in production.");
  }
  const region = RegionIdSchema.parse(environment.CANARY_REGION ?? "canary-global");
  if (!region.startsWith("canary-")) throw new Error("CANARY_REGION must use an isolated canary-* region.");
  const encodedKey = environment.PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL;
  if (!encodedKey || !/^[A-Za-z0-9_-]+$/.test(encodedKey)) throw new Error("A rollout cohort key is required.");
  const rolloutCohortKey = Buffer.from(encodedKey, "base64url");
  if (rolloutCohortKey.byteLength < 32 || rolloutCohortKey.toString("base64url") !== encodedKey) {
    throw new Error("The rollout cohort key must contain at least 32 bytes.");
  }
  const runTimeoutMs = integer(environment, "CANARY_RUN_TIMEOUT_MS", 120_000, 10_000, 600_000);
  const leaseTtlMs = integer(environment, "CANARY_LEASE_TTL_MS", 130_000, 15_000, 660_000);
  if (leaseTtlMs < runTimeoutMs + 5_000) throw new Error("CANARY_LEASE_TTL_MS must exceed the run timeout by five seconds.");
  return {
    deployment,
    region,
    intervalMs: integer(environment, "CANARY_INTERVAL_MS", 900_000, 300_000, 86_400_000),
    leaseTtlMs,
    runTimeoutMs,
    measurementRetentionMs: integer(environment, "CANARY_MEASUREMENT_RETENTION_MS", 2_592_000_000, 86_400_000, 31_536_000_000),
    rolloutMaximumStaleMs: integer(environment, "PROVIDER_ROLLOUT_MAX_STALE_MS", 15_000, 5_000, 60_000),
    rolloutCohortKey
  };
}
