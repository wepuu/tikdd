import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import type Redis from "ioredis";
import { z } from "zod";

const ProviderIdSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const RuntimeRoutePolicySchema = z.strictObject({
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  policyRevision: z.number().int().positive(),
  orderedProviderIds: z.array(ProviderIdSchema).max(16),
  trafficShares: z.array(z.strictObject({
    providerId: ProviderIdSchema,
    shareBps: z.number().int().positive().max(10_000)
  })).max(16).default([]),
  concurrencyCaps: z.array(z.strictObject({
    providerId: ProviderIdSchema,
    limit: z.number().int().positive().max(1_000)
  })).max(16)
}).superRefine((policy, context) => {
  const ids = policy.trafficShares.map(({ providerId }) => providerId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Traffic-share Provider IDs must be unique.", path: ["trafficShares"] });
  }
  if (policy.trafficShares.length > 0 && policy.trafficShares.reduce((sum, item) => sum + item.shareBps, 0) !== 10_000) {
    context.addIssue({ code: "custom", message: "Traffic shares must total exactly 10,000 basis points.", path: ["trafficShares"] });
  }
  for (const id of ids) {
    if (!policy.orderedProviderIds.includes(id)) {
      context.addIssue({ code: "custom", message: "Traffic-share Providers must be present in the manual order.", path: ["trafficShares"] });
    }
  }
});

export const RoutePolicySnapshotSchema = z.strictObject({
  schemaVersion: z.literal("2"),
  revision: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime({ offset: true }),
  policies: z.array(RuntimeRoutePolicySchema).max(2_000)
});

export type RuntimeRoutePolicy = z.infer<typeof RuntimeRoutePolicySchema>;
export type RoutePolicySnapshot = z.infer<typeof RoutePolicySnapshotSchema>;

export interface ProviderPreferenceSource {
  get(platform: string, region: string): Promise<RuntimeRoutePolicy | null>;
}

const snapshotKey = "tikdd:route-policy:v2:snapshot";
const changeChannel = "tikdd:route-policy:v2:changed";
const putScript = `
-- tikdd:put-route-policy-snapshot
local current = redis.call("GET", KEYS[1])
local notify = 1
if current then
  local currentRevision = tonumber(cjson.decode(current)["revision"])
  if currentRevision > tonumber(ARGV[1]) then return 0 end
  if currentRevision == tonumber(ARGV[1]) then notify = 0 end
end
redis.call("SET", KEYS[1], ARGV[2], "PX", ARGV[3])
if notify == 1 then redis.call("PUBLISH", ARGV[4], ARGV[1]) end
return 1
`;

export class RedisRoutePolicyStore {
  constructor(private readonly redis: Redis) {}

  async getSnapshot(): Promise<RoutePolicySnapshot | null> {
    const raw = await this.redis.get(snapshotKey);
    if (!raw) return null;
    try { return RoutePolicySnapshotSchema.parse(JSON.parse(raw)); } catch { return null; }
  }

  async putSnapshot(input: RoutePolicySnapshot, ttlMs: number): Promise<boolean> {
    const snapshot = RoutePolicySnapshotSchema.parse(input);
    if (!Number.isInteger(ttlMs) || ttlMs < 5_000 || ttlMs > 86_400_000) {
      throw new Error("Route-policy snapshot TTL is invalid.");
    }
    const result = await this.redis.eval(
      putScript, 1, snapshotKey, String(snapshot.revision), JSON.stringify(snapshot), String(ttlMs), changeChannel
    );
    return Number(result) === 1;
  }
}

export class RuntimeRoutePolicySource implements ProviderPreferenceSource {
  private cached: RoutePolicySnapshot | null = null;

  constructor(
    private readonly store: RedisRoutePolicyStore,
    private readonly loadDurable: () => Promise<RoutePolicySnapshot>,
    private readonly maximumStaleMs: number,
    private readonly now: () => Date = () => new Date()
  ) {
    if (!Number.isInteger(maximumStaleMs) || maximumStaleMs < 5_000 || maximumStaleMs > 300_000) {
      throw new Error("Route-policy maximum stale interval is invalid.");
    }
  }

  private fresh(snapshot: RoutePolicySnapshot): boolean {
    const age = this.now().getTime() - new Date(snapshot.generatedAt).getTime();
    return age >= -5_000 && age <= this.maximumStaleMs;
  }

  async get(platformInput: string, regionInput: string): Promise<RuntimeRoutePolicy | null> {
    const platform = PlatformIdSchema.parse(platformInput);
    const region = RegionIdSchema.parse(regionInput);
    let snapshot: RoutePolicySnapshot | null = null;
    try { snapshot = await this.store.getSnapshot(); } catch { snapshot = null; }
    if (!snapshot || !this.fresh(snapshot) || (this.cached && snapshot.revision < this.cached.revision)) {
      try {
        const durable = RoutePolicySnapshotSchema.parse(await this.loadDurable());
        snapshot = this.cached && durable.revision < this.cached.revision ? this.cached : durable;
      } catch {
        snapshot = this.cached;
      }
    }
    if (!snapshot || !this.fresh(snapshot)) return null;
    this.cached = snapshot;
    return snapshot.policies.find((policy) => policy.platform === platform && policy.region === region) ?? null;
  }
}

export const routePolicyRedisKeys = Object.freeze({ snapshotKey, changeChannel });
