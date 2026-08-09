import { aggregateCircuitHealth } from "./aggregate";
import {
  CircuitPolicySchema,
  ProviderHealthObservationSchema,
  type CircuitPolicy,
  type CircuitSnapshot,
  type ProviderCircuitKey,
  type ProviderHealthObservation
} from "./model";
import { RedisCircuitStore, circuitStorageKey } from "./redis";

export interface ProviderHealthObservationSource {
  listProviderHealthObservations(since: Date): Promise<readonly ProviderHealthObservation[]>;
}

export interface RefreshCircuitHealthOptions {
  source: ProviderHealthObservationSource;
  store: RedisCircuitStore;
  policy: CircuitPolicy;
  now?: Date;
}

export interface RefreshCircuitHealthResult {
  observationCount: number;
  circuitCount: number;
  updatedCount: number;
  conflictCount: number;
}

export async function refreshCircuitHealth(
  options: RefreshCircuitHealthOptions
): Promise<RefreshCircuitHealthResult> {
  const policy = CircuitPolicySchema.parse(options.policy);
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - policy.observationWindowMs);
  const observations = (await options.source.listProviderHealthObservations(since)).map(
    (observation) => ProviderHealthObservationSchema.parse(observation)
  );
  const existing = await options.store.listSnapshots();
  const circuits = new Map<
    string,
    { key: ProviderCircuitKey; previous: CircuitSnapshot | null }
  >();

  for (const snapshot of existing) {
    circuits.set(circuitStorageKey(snapshot.key), { key: snapshot.key, previous: snapshot });
  }
  for (const observation of observations) {
    const key = {
      providerId: observation.providerId,
      platform: observation.platform,
      region: observation.region
    };
    const storageKey = circuitStorageKey(key);
    if (!circuits.has(storageKey)) {
      circuits.set(storageKey, { key, previous: null });
    }
  }

  let updatedCount = 0;
  let conflictCount = 0;
  for (const { key, previous } of circuits.values()) {
    const snapshot = aggregateCircuitHealth({ key, observations, policy, previous, now });
    if (
      await options.store.putSnapshot(snapshot, previous?.revision ?? null, policy.snapshotTtlMs)
    ) {
      updatedCount += 1;
    } else {
      conflictCount += 1;
    }
  }

  return {
    observationCount: observations.length,
    circuitCount: circuits.size,
    updatedCount,
    conflictCount
  };
}
