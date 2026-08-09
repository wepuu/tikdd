import type Redis from "ioredis";
import { describe, expect, it } from "vitest";
import {
  RedisRolloutStore,
  RolloutSnapshotSchema,
  RuntimeProviderRolloutSource,
  evaluateRollout,
  rolloutBucket,
  rolloutRedisKeys,
  type ProviderRolloutRequest,
  type RolloutRule,
  type RolloutSnapshot
} from "../src/index";

const now = new Date("2026-08-09T12:00:00.000Z");
const cohortKey = Buffer.alloc(32, 7);
const request: ProviderRolloutRequest = {
  taskId: "tsk_0123456789abcdef0123456789abcdef",
  providerId: "twittersaver",
  providerKind: "site-adapter",
  platform: "x",
  region: "global"
};

function rule(overrides: Partial<RolloutRule> = {}): RolloutRule {
  return {
    id: "twittersaver-x-global",
    providerId: "twittersaver",
    platform: "x",
    region: "global",
    enabled: true,
    allocationBps: 10_000,
    revision: 1,
    activatesAt: "2026-08-09T11:00:00.000Z",
    expiresAt: null,
    ...overrides
  };
}

function snapshot(rules: RolloutRule[], revision = 1): RolloutSnapshot {
  return RolloutSnapshotSchema.parse({
    schemaVersion: "1",
    revision,
    generatedAt: now.toISOString(),
    rules
  });
}

class MemoryRedis {
  value: string | null = null;
  published: Array<[string, string]> = [];

  async get() {
    return this.value;
  }

  async eval(script: string, _numberOfKeys: number, ...arguments_: string[]) {
    if (!script.includes("tikdd:put-rollout-snapshot")) {
      throw new Error("Unexpected Lua script.");
    }
    const incomingRevision = Number(arguments_[1]);
    const currentRevision = this.value ? Number(JSON.parse(this.value).revision) : -1;
    if (currentRevision > incomingRevision) {
      return 0;
    }
    this.value = arguments_[2] as string;
    if (currentRevision !== incomingRevision) {
      this.published.push([arguments_[4] as string, arguments_[1] as string]);
    }
    return 1;
  }
}

describe("provider rollout control", () => {
  it("lets any matching deny override a more specific grant", () => {
    const decision = evaluateRollout({
      snapshot: snapshot([
        rule(),
        rule({
          id: "twittersaver-emergency-stop",
          platform: "*",
          region: "*",
          enabled: false,
          allocationBps: 0
        })
      ]),
      request,
      cohortKey,
      now
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "matching_deny",
      ruleId: "twittersaver-emergency-stop"
    });
  });

  it("uses a stable HMAC cohort without source or network data", () => {
    const bucket = rolloutBucket("twittersaver-x-global", request.taskId, cohortKey);
    expect(rolloutBucket("twittersaver-x-global", request.taskId, cohortKey)).toBe(bucket);

    const denied = evaluateRollout({
      snapshot: snapshot([rule({ allocationBps: bucket })]),
      request,
      cohortKey,
      now
    });
    const allowed = evaluateRollout({
      snapshot: snapshot([rule({ allocationBps: bucket + 1 })]),
      request,
      cohortKey,
      now
    });
    expect(denied.reason).toBe("outside_allocation");
    expect(allowed.reason).toBe("allowed");
  });

  it("rejects ambiguous equally specific overlapping grants", () => {
    expect(() =>
      snapshot([
        rule({ id: "platform-grant", region: "*" }),
        rule({ id: "region-grant", platform: "*" })
      ])
    ).toThrow(/Ambiguous equally specific grants/);
  });

  it("never grants a production mock", () => {
    const decision = evaluateRollout({
      snapshot: snapshot([rule({ providerId: "development-mock" })]),
      request: { ...request, providerId: "development-mock", providerKind: "mock" },
      cohortKey,
      now
    });
    expect(decision.reason).toBe("production_mock_denied");
  });

  it("publishes revisioned snapshots and rejects an older compiler", async () => {
    const redis = new MemoryRedis();
    const store = new RedisRolloutStore(redis as unknown as Redis);
    expect(await store.putSnapshot(snapshot([rule()], 2), 30_000)).toBe(true);
    expect(await store.putSnapshot(snapshot([rule()], 2), 30_000)).toBe(true);
    expect(await store.putSnapshot(snapshot([rule()], 1), 30_000)).toBe(false);
    expect((await store.getSnapshot())?.revision).toBe(2);
    expect(redis.published).toEqual([[rolloutRedisKeys.changeChannel, "2"]]);
  });

  it("falls back to a fresh durable snapshot and fails closed when all state is stale", async () => {
    const redis = new MemoryRedis();
    const store = new RedisRolloutStore(redis as unknown as Redis);
    const source = new RuntimeProviderRolloutSource(
      store,
      async () => snapshot([rule()]),
      cohortKey,
      10_000,
      () => now
    );
    await expect(source.decide(request)).resolves.toMatchObject({ allowed: true, reason: "allowed" });

    const stale = snapshot([rule()]);
    stale.generatedAt = "2026-08-09T11:00:00.000Z";
    const unavailable = new RuntimeProviderRolloutSource(
      { getSnapshot: async () => stale } as RedisRolloutStore,
      async () => {
        throw new Error("database unavailable");
      },
      cohortKey,
      10_000,
      () => now
    );
    await expect(unavailable.decide(request)).resolves.toMatchObject({
      allowed: false,
      reason: "control_unavailable"
    });
  });

  it("does not roll an in-process decision back to an older snapshot revision", async () => {
    const redis = new MemoryRedis();
    redis.value = JSON.stringify(snapshot([rule()], 2));
    const source = new RuntimeProviderRolloutSource(
      new RedisRolloutStore(redis as unknown as Redis),
      async () => snapshot([rule({ enabled: false, allocationBps: 0 })], 1),
      cohortKey,
      10_000,
      () => now
    );
    await expect(source.decide(request)).resolves.toMatchObject({ allowed: true, snapshotRevision: 2 });

    redis.value = JSON.stringify(snapshot([rule({ enabled: false, allocationBps: 0 })], 1));
    await expect(source.decide(request)).resolves.toMatchObject({ allowed: true, snapshotRevision: 2 });
  });
});
