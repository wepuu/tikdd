import { randomUUID } from "node:crypto";
import type { TaskRepository } from "@tikdd/persistence";
import {
  CircuitPolicySchema,
  RedisCircuitStore,
  refreshCircuitHealth,
  type CircuitPolicy
} from "@tikdd/routing-health";

export interface ProviderHealthConfiguration {
  enabled: boolean;
  policy: CircuitPolicy | null;
  refreshIntervalMs: number;
}

export function loadProviderHealthConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): ProviderHealthConfiguration {
  const enabled = (environment.PROVIDER_HEALTH_ENABLED ?? "false") === "true";
  const refreshIntervalMs = Number.parseInt(
    environment.PROVIDER_HEALTH_REFRESH_MS ?? "10000",
    10
  );
  if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs < 1_000) {
    throw new Error("PROVIDER_HEALTH_REFRESH_MS must be at least 1000.");
  }
  if (!enabled) {
    return { enabled: false, policy: null, refreshIntervalMs };
  }
  if (!environment.PROVIDER_HEALTH_POLICY_JSON) {
    throw new Error("PROVIDER_HEALTH_POLICY_JSON is required when provider health is enabled.");
  }
  let rawPolicy: unknown;
  try {
    rawPolicy = JSON.parse(environment.PROVIDER_HEALTH_POLICY_JSON);
  } catch {
    throw new Error("PROVIDER_HEALTH_POLICY_JSON must contain valid JSON.");
  }
  const policy = CircuitPolicySchema.parse(rawPolicy);
  if (refreshIntervalMs > policy.probeLeaseMs) {
    throw new Error(
      "PROVIDER_HEALTH_REFRESH_MS must not exceed the configured probeLeaseMs."
    );
  }
  return {
    enabled: true,
    policy,
    refreshIntervalMs
  };
}

export interface HealthRefreshLoop {
  stop(): void;
}

export function startHealthRefreshLoop(options: {
  tasks: TaskRepository;
  store: RedisCircuitStore;
  policy: CircuitPolicy;
  refreshIntervalMs: number;
  onResult?: (message: string) => void;
  onError?: (error: unknown) => void;
}): HealthRefreshLoop {
  const owner = randomUUID();
  let running = false;

  const refresh = async () => {
    if (running) {
      return;
    }
    running = true;
    let leaseAcquired = false;
    try {
      leaseAcquired = await options.store.acquireAggregationLease(
        owner,
        options.policy.aggregationLeaseMs
      );
      if (!leaseAcquired) {
        return;
      }
      const result = await refreshCircuitHealth({
        source: options.tasks,
        store: options.store,
        policy: options.policy
      });
      options.onResult?.(
        `Health refresh observed ${result.observationCount} attempts across ${result.circuitCount} circuits; ${result.updatedCount} updated and ${result.conflictCount} conflicted.`
      );
    } catch (error) {
      options.onError?.(error);
    } finally {
      if (leaseAcquired) {
        await options.store.releaseAggregationLease(owner).catch((error) => options.onError?.(error));
      }
      running = false;
    }
  };

  void refresh();
  const timer = setInterval(() => void refresh(), options.refreshIntervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
