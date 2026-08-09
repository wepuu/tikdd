import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import {
  CircuitPolicySchema,
  CircuitSnapshotSchema,
  ProviderCircuitKeySchema,
  type CircuitPolicy,
  type CircuitSnapshot,
  type ProviderCircuitKey,
  type ProviderRoutingHealthSnapshot,
  type ProviderRoutingHealthSource
} from "./model";

const snapshotPrefix = "tikdd:routing-health:v1";
const aggregationLeaseKey = `${snapshotPrefix}:aggregation-lease`;

const putSnapshotScript = `
-- tikdd:put-circuit-snapshot
local current = redis.call("GET", KEYS[1])
local currentRevision = -1
if current then
  currentRevision = tonumber(cjson.decode(current)["revision"])
end
if currentRevision ~= tonumber(ARGV[1]) then
  return 0
end
redis.call("SET", KEYS[1], ARGV[2], "PX", ARGV[3])
if ARGV[4] ~= "half-open" then
  redis.call("DEL", KEYS[2])
end
return 1
`;

const acquireProbeScript = `
-- tikdd:acquire-half-open-probe
local raw = redis.call("GET", KEYS[1])
if not raw then
  return 0
end
local snapshot = cjson.decode(raw)
local state = snapshot["state"]
if state == "closed" then
  return 0
end
if state == "open" then
  local openUntil = snapshot["openUntilEpochMs"]
  if not openUntil or tonumber(openUntil) > tonumber(ARGV[1]) then
    return 0
  end
end
local acquired = redis.call("SET", KEYS[2], ARGV[2], "NX", "PX", ARGV[3])
if not acquired then
  return 0
end
snapshot["state"] = "half-open"
snapshot["lastTransitionAt"] = ARGV[4]
snapshot["probeLeaseExpiresAt"] = ARGV[5]
snapshot["revision"] = tonumber(snapshot["revision"]) + 1
redis.call("SET", KEYS[1], cjson.encode(snapshot), "PX", ARGV[6])
return 1
`;

const releaseLeaseScript = `
-- tikdd:release-owned-lease
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export function circuitStorageKey(key: ProviderCircuitKey): string {
  const parsed = ProviderCircuitKeySchema.parse(key);
  return `${snapshotPrefix}:${parsed.providerId}:${parsed.platform}:${parsed.region}`;
}

function probeLeaseKey(key: ProviderCircuitKey): string {
  return `${circuitStorageKey(key)}:probe-lease`;
}

function serializeSnapshot(snapshot: CircuitSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    openUntilEpochMs: snapshot.openUntil ? new Date(snapshot.openUntil).getTime() : null
  });
}

function parseSnapshot(raw: string | null): CircuitSnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    delete parsed.openUntilEpochMs;
    return CircuitSnapshotSchema.parse(parsed);
  } catch {
    return null;
  }
}

export class RedisCircuitStore {
  constructor(private readonly redis: Redis) {}

  async getSnapshot(key: ProviderCircuitKey): Promise<CircuitSnapshot | null> {
    return parseSnapshot(await this.redis.get(circuitStorageKey(key)));
  }

  async putSnapshot(
    rawSnapshot: CircuitSnapshot,
    expectedRevision: number | null,
    ttlMs: number
  ): Promise<boolean> {
    const snapshot = CircuitSnapshotSchema.parse({
      ...rawSnapshot,
      revision: (expectedRevision ?? -1) + 1
    });
    const result = await this.redis.eval(
      putSnapshotScript,
      2,
      circuitStorageKey(snapshot.key),
      probeLeaseKey(snapshot.key),
      String(expectedRevision ?? -1),
      serializeSnapshot(snapshot),
      String(ttlMs),
      snapshot.state
    );
    return Number(result) === 1;
  }

  async acquireProbe(
    key: ProviderCircuitKey,
    policyInput: CircuitPolicy,
    now = new Date()
  ): Promise<boolean> {
    const policy = CircuitPolicySchema.parse(policyInput);
    const leaseExpiresAt = new Date(now.getTime() + policy.probeLeaseMs);
    const result = await this.redis.eval(
      acquireProbeScript,
      2,
      circuitStorageKey(key),
      probeLeaseKey(key),
      String(now.getTime()),
      randomUUID(),
      String(policy.probeLeaseMs),
      now.toISOString(),
      leaseExpiresAt.toISOString(),
      String(policy.snapshotTtlMs)
    );
    return Number(result) === 1;
  }

  async listSnapshots(): Promise<CircuitSnapshot[]> {
    const snapshots: CircuitSnapshot[] = [];
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        `${snapshotPrefix}:*`,
        "COUNT",
        100
      );
      cursor = nextCursor;
      const snapshotKeys = keys.filter(
        (key) => !key.endsWith(":probe-lease") && key !== aggregationLeaseKey
      );
      if (snapshotKeys.length > 0) {
        const values = await this.redis.mget(...snapshotKeys);
        for (const value of values) {
          const snapshot = parseSnapshot(value);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        }
      }
    } while (cursor !== "0");
    return snapshots;
  }

  async acquireAggregationLease(owner: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.set(aggregationLeaseKey, owner, "PX", ttlMs, "NX")) === "OK";
  }

  async releaseAggregationLease(owner: string): Promise<void> {
    await this.redis.eval(releaseLeaseScript, 1, aggregationLeaseKey, owner);
  }
}

export class RedisProviderRoutingHealthSource implements ProviderRoutingHealthSource {
  private readonly policy: CircuitPolicy;

  constructor(
    private readonly store: RedisCircuitStore,
    policy: CircuitPolicy,
    private readonly now: () => Date = () => new Date()
  ) {
    this.policy = CircuitPolicySchema.parse(policy);
  }

  async get(key: ProviderCircuitKey): Promise<ProviderRoutingHealthSnapshot> {
    const now = this.now();
    let snapshot: CircuitSnapshot | null;
    try {
      snapshot = await this.store.getSnapshot(key);
    } catch {
      snapshot = null;
    }
    if (
      !snapshot ||
      now.getTime() - new Date(snapshot.calculatedAt).getTime() > this.policy.snapshotTtlMs
    ) {
      return {
        state: "closed",
        successRate: 0,
        latencyP95Ms: 0,
        insufficientData: true,
        openUntil: null,
        calculatedAt: now.toISOString()
      };
    }
    return {
      state: snapshot.state,
      successRate: snapshot.insufficientData ? 0 : snapshot.successRate,
      latencyP95Ms: snapshot.insufficientData ? 0 : snapshot.latencyP95Ms,
      insufficientData: snapshot.insufficientData,
      openUntil: snapshot.openUntil,
      calculatedAt: snapshot.calculatedAt
    };
  }

  async acquireProbe(key: ProviderCircuitKey): Promise<boolean> {
    try {
      return await this.store.acquireProbe(key, this.policy, this.now());
    } catch {
      return false;
    }
  }
}
