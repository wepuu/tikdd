import type Redis from "ioredis";
import { describe, expect, it } from "vitest";
import {
  aggregateCircuitHealth,
  CircuitPolicySchema,
  RedisCircuitStore,
  RedisProviderRoutingHealthSource,
  refreshCircuitHealth,
  type CircuitPolicy,
  type ProviderCircuitKey,
  type ProviderHealthObservation
} from "../src/index";

interface Entry {
  value: string;
  expiresAt: number | null;
}

class MemoryRedis {
  private readonly entries = new Map<string, Entry>();

  private read(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string) {
    return this.read(key);
  }

  async set(key: string, value: string, ...arguments_: Array<string | number>) {
    const onlyIfAbsent = arguments_.includes("NX");
    if (onlyIfAbsent && this.read(key) !== null) {
      return null;
    }
    const pxIndex = arguments_.indexOf("PX");
    const ttl = pxIndex >= 0 ? Number(arguments_[pxIndex + 1]) : null;
    this.entries.set(key, {
      value,
      expiresAt: ttl === null ? null : Date.now() + ttl
    });
    return "OK";
  }

  async del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      deleted += this.entries.delete(key) ? 1 : 0;
    }
    return deleted;
  }

  async mget(...keys: string[]) {
    return keys.map((key) => this.read(key));
  }

  async scan(_cursor: string, _match: string, pattern: string) {
    const prefix = pattern.slice(0, -1);
    return ["0", [...this.entries.keys()].filter((key) => key.startsWith(prefix))] as const;
  }

  async eval(script: string, numberOfKeys: number, ...allArguments: string[]) {
    const keys = allArguments.slice(0, numberOfKeys);
    const arguments_ = allArguments.slice(numberOfKeys);
    const snapshotKey = keys[0] as string;

    if (script.includes("tikdd:put-circuit-snapshot")) {
      const current = this.read(snapshotKey);
      const currentRevision = current ? Number(JSON.parse(current).revision) : -1;
      if (currentRevision !== Number(arguments_[0])) {
        return 0;
      }
      await this.set(snapshotKey, arguments_[1] as string, "PX", arguments_[2] as string);
      if (arguments_[3] !== "half-open") {
        await this.del(keys[1] as string);
      }
      return 1;
    }

    if (script.includes("tikdd:acquire-half-open-probe")) {
      const current = this.read(snapshotKey);
      if (!current) {
        return 0;
      }
      const snapshot = JSON.parse(current) as Record<string, unknown>;
      if (snapshot.state === "closed") {
        return 0;
      }
      if (
        snapshot.state === "open" &&
        Number(snapshot.openUntilEpochMs) > Number(arguments_[0])
      ) {
        return 0;
      }
      const lease = await this.set(
        keys[1] as string,
        arguments_[1] as string,
        "NX",
        "PX",
        arguments_[2] as string
      );
      if (!lease) {
        return 0;
      }
      snapshot.state = "half-open";
      snapshot.lastTransitionAt = arguments_[3];
      snapshot.probeLeaseExpiresAt = arguments_[4];
      snapshot.revision = Number(snapshot.revision) + 1;
      await this.set(snapshotKey, JSON.stringify(snapshot), "PX", arguments_[5] as string);
      return 1;
    }

    if (script.includes("tikdd:release-owned-lease")) {
      if (this.read(snapshotKey) === arguments_[0]) {
        return this.del(snapshotKey);
      }
      return 0;
    }

    throw new Error("Unexpected Lua script.");
  }
}

const key: ProviderCircuitKey = {
  providerId: "provider-a",
  platform: "x",
  region: "global"
};
const now = new Date("2026-08-07T12:00:00.000Z");
const policy: CircuitPolicy = CircuitPolicySchema.parse({
  version: "redis-test-v1",
  observationWindowMs: 60_000,
  minimumDistinctTasks: 2,
  thresholds: {
    integrity: { minimumFailures: 2, openRate: 1 },
    accessFriction: { minimumFailures: 2, openRate: 1 },
    availability: { minimumFailures: 2, openRate: 1 }
  },
  baseCooldownMs: 1_000,
  maximumCooldownMs: 8_000,
  recoverySuccesses: 1,
  snapshotTtlMs: 120_000,
  probeLeaseMs: 5_000,
  aggregationLeaseMs: 5_000
});

function failedObservation(number: number): ProviderHealthObservation {
  return {
    taskId: `tsk_${number.toString(16).padStart(32, "0")}`,
    ...key,
    status: "failed",
    failureCode: "provider_timeout",
    durationMs: 100,
    finishedAt: new Date(now.getTime() - number * 100).toISOString()
  };
}

describe("Redis routing health state", () => {
  it("publishes snapshots with revision compare-and-set", async () => {
    const store = new RedisCircuitStore(new MemoryRedis() as unknown as Redis);
    const snapshot = aggregateCircuitHealth({
      key,
      policy,
      now,
      observations: [failedObservation(1), failedObservation(2)]
    });

    expect(await store.putSnapshot(snapshot, null, policy.snapshotTtlMs)).toBe(true);
    expect((await store.getSnapshot(key))?.revision).toBe(0);
    expect(await store.putSnapshot(snapshot, null, policy.snapshotTtlMs)).toBe(false);
    expect(await store.putSnapshot(snapshot, 0, policy.snapshotTtlMs)).toBe(true);
    expect((await store.getSnapshot(key))?.revision).toBe(1);
  });

  it("grants only one probe after cooldown and exposes half-open state", async () => {
    const store = new RedisCircuitStore(new MemoryRedis() as unknown as Redis);
    const openedAt = new Date(now.getTime() - 2_000);
    const snapshot = aggregateCircuitHealth({
      key,
      policy,
      now: openedAt,
      observations: [
        { ...failedObservation(1), finishedAt: openedAt.toISOString() },
        { ...failedObservation(2), finishedAt: openedAt.toISOString() }
      ]
    });
    await store.putSnapshot(snapshot, null, policy.snapshotTtlMs);

    const results = await Promise.all([
      store.acquireProbe(key, policy, now),
      store.acquireProbe(key, policy, now)
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect((await store.getSnapshot(key))?.state).toBe("half-open");
  });

  it("returns neutral routing health for missing snapshots", async () => {
    const store = new RedisCircuitStore(new MemoryRedis() as unknown as Redis);
    const source = new RedisProviderRoutingHealthSource(store, policy, () => now);

    await expect(source.get(key)).resolves.toMatchObject({
      state: "closed",
      successRate: 0,
      insufficientData: true
    });
  });

  it("refreshes one snapshot per exact observed circuit", async () => {
    const store = new RedisCircuitStore(new MemoryRedis() as unknown as Redis);
    const result = await refreshCircuitHealth({
      store,
      policy,
      now,
      source: {
        async listProviderHealthObservations() {
          return [failedObservation(1), failedObservation(2)];
        }
      }
    });

    expect(result).toEqual({
      observationCount: 2,
      circuitCount: 1,
      updatedCount: 1,
      conflictCount: 0
    });
    expect((await store.getSnapshot(key))?.state).toBe("open");
  });
});
