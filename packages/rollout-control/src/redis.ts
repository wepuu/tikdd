import type Redis from "ioredis";
import {
  PilotGuardSnapshotSchema,
  RolloutSnapshotSchema,
  type PilotGuardSnapshot,
  type RolloutSnapshot
} from "./model";

const snapshotKey = "tikdd:rollout:v1:snapshot";
const changeChannel = "tikdd:rollout:v1:changed";

const publishSnapshotScript = `
-- tikdd:put-rollout-snapshot
local current = redis.call("GET", KEYS[1])
local shouldNotify = 1
if current then
  local currentRevision = tonumber(cjson.decode(current)["revision"])
  if currentRevision > tonumber(ARGV[1]) then
    return 0
  end
  if currentRevision == tonumber(ARGV[1]) then
    shouldNotify = 0
  end
end
redis.call("SET", KEYS[1], ARGV[2], "PX", ARGV[3])
if shouldNotify == 1 then
  redis.call("PUBLISH", ARGV[4], ARGV[1])
end
return 1
`;

function parseSnapshot(raw: string | null): RolloutSnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    return RolloutSnapshotSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export class RedisRolloutStore {
  constructor(private readonly redis: Redis) {}

  async getSnapshot(): Promise<RolloutSnapshot | null> {
    return parseSnapshot(await this.redis.get(snapshotKey));
  }

  async putSnapshot(snapshotInput: RolloutSnapshot, ttlMs: number): Promise<boolean> {
    const snapshot = RolloutSnapshotSchema.parse(snapshotInput);
    if (!Number.isInteger(ttlMs) || ttlMs < 5_000 || ttlMs > 24 * 60 * 60 * 1_000) {
      throw new Error("Rollout snapshot TTL is invalid.");
    }
    const result = await this.redis.eval(
      publishSnapshotScript,
      1,
      snapshotKey,
      String(snapshot.revision),
      JSON.stringify(snapshot),
      String(ttlMs),
      changeChannel
    );
    return Number(result) === 1;
  }
}

export const rolloutRedisKeys = Object.freeze({ snapshotKey, changeChannel });

const pilotGuardSnapshotKey = "tikdd:pilot-guard:v1:snapshot";
const pilotGuardChangeChannel = "tikdd:pilot-guard:v1:changed";

export class RedisPilotGuardStore {
  constructor(private readonly redis: Redis) {}

  async getSnapshot(): Promise<PilotGuardSnapshot | null> {
    const raw = await this.redis.get(pilotGuardSnapshotKey);
    if (!raw) return null;
    try { return PilotGuardSnapshotSchema.parse(JSON.parse(raw)); } catch { return null; }
  }

  async putSnapshot(snapshotInput: PilotGuardSnapshot, ttlMs: number): Promise<boolean> {
    const snapshot = PilotGuardSnapshotSchema.parse(snapshotInput);
    if (!Number.isInteger(ttlMs) || ttlMs < 5_000 || ttlMs > 24*60*60*1_000) throw new Error("Pilot guard snapshot TTL is invalid.");
    const result = await this.redis.eval(publishSnapshotScript,1,pilotGuardSnapshotKey,
      String(snapshot.revision),JSON.stringify(snapshot),String(ttlMs),pilotGuardChangeChannel);
    return Number(result)===1;
  }
}

export const pilotGuardRedisKeys = Object.freeze({ snapshotKey: pilotGuardSnapshotKey, changeChannel: pilotGuardChangeChannel });
