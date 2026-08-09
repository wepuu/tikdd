import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import {
  AdmissionControlPolicySchema,
  ProviderConcurrencyKeySchema,
  resolveProviderConcurrencyLimit,
  type AdmissionControlPolicy,
  type ProviderConcurrencyKey
} from "./model";

const prefix = "tikdd:admission:v1";

const admitTaskScript = `
-- tikdd:admit-anonymous-task
local redisTime = redis.call("TIME")
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
local clientRate = tonumber(redis.call("GET", KEYS[1]) or "0")
local globalRate = tonumber(redis.call("GET", KEYS[2]) or "0")
if clientRate >= tonumber(ARGV[1]) or globalRate >= tonumber(ARGV[2]) then
  local retry = math.max(redis.call("PTTL", KEYS[1]), redis.call("PTTL", KEYS[2]), 1000)
  return {2, retry}
end
clientRate = redis.call("INCR", KEYS[1])
if clientRate == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[3]) end
globalRate = redis.call("INCR", KEYS[2])
if globalRate == 1 then redis.call("PEXPIRE", KEYS[2], ARGV[3]) end
if redis.call("EXISTS", KEYS[5]) == 1 then
  redis.call("SADD", KEYS[6], ARGV[9])
  local permitTtl = redis.call("PTTL", KEYS[5])
  if permitTtl > 0 then redis.call("PEXPIRE", KEYS[6], permitTtl) end
  return {1, 0}
end
redis.call("ZREMRANGEBYSCORE", KEYS[3], "-inf", nowMs)
redis.call("ZREMRANGEBYSCORE", KEYS[4], "-inf", nowMs)
local clientActive = redis.call("ZCARD", KEYS[3])
local globalActive = redis.call("ZCARD", KEYS[4])
if clientActive >= tonumber(ARGV[4]) or globalActive >= tonumber(ARGV[5]) then
  local clientNext = redis.call("ZRANGE", KEYS[3], 0, 0, "WITHSCORES")
  local globalNext = redis.call("ZRANGE", KEYS[4], 0, 0, "WITHSCORES")
  local nextExpiry = nowMs + 60000
  if clientNext[2] then nextExpiry = math.min(nextExpiry, tonumber(clientNext[2])) end
  if globalNext[2] then nextExpiry = math.min(nextExpiry, tonumber(globalNext[2])) end
  return {3, math.max(1000, nextExpiry - nowMs)}
end
local permitExpiry = nowMs + tonumber(ARGV[7])
redis.call("ZADD", KEYS[3], permitExpiry, ARGV[6])
redis.call("ZADD", KEYS[4], permitExpiry, ARGV[6])
if redis.call("PTTL", KEYS[3]) < tonumber(ARGV[7]) then redis.call("PEXPIRE", KEYS[3], ARGV[7]) end
if redis.call("PTTL", KEYS[4]) < tonumber(ARGV[7]) then redis.call("PEXPIRE", KEYS[4], ARGV[7]) end
redis.call("HSET", KEYS[5], "identity", ARGV[8])
redis.call("SADD", KEYS[6], ARGV[9])
redis.call("PEXPIRE", KEYS[5], ARGV[7])
redis.call("PEXPIRE", KEYS[6], ARGV[7])
return {1, 0}
`;

const releaseTaskScript = `
-- tikdd:release-anonymous-task
local identity = redis.call("HGET", KEYS[1], "identity")
if not identity then return 0 end
if redis.call("SREM", KEYS[3], ARGV[3]) == 0 then return 0 end
if redis.call("SCARD", KEYS[3]) > 0 then return 0 end
redis.call("ZREM", ARGV[1] .. identity, ARGV[2])
redis.call("ZREM", KEYS[2], ARGV[2])
redis.call("DEL", KEYS[1], KEYS[3])
return 1
`;

const acquireProviderScript = `
-- tikdd:acquire-provider-concurrency
local redisTime = redis.call("TIME")
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
if redis.call("ZCARD", KEYS[1]) >= tonumber(ARGV[1]) then
  local nextLease = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  return {0, math.max(1000, tonumber(nextLease[2]) - nowMs)}
end
redis.call("ZADD", KEYS[1], nowMs + tonumber(ARGV[3]), ARGV[2])
redis.call("PEXPIRE", KEYS[1], ARGV[4])
return {1, 0}
`;

const releaseProviderScript = `
-- tikdd:release-owned-provider-concurrency
return redis.call("ZREM", KEYS[1], ARGV[1])
`;

function digestHex(input: Uint8Array): string {
  const value = Buffer.from(input);
  if (value.byteLength !== 32) {
    throw new Error("Client identity digest must contain exactly 32 bytes.");
  }
  return value.toString("hex");
}

function boundedRetryAfter(milliseconds: number): number {
  return Math.min(60, Math.max(1, Math.ceil(milliseconds / 1_000)));
}

export type AnonymousTaskAdmissionDecision =
  | { kind: "accepted" }
  | { kind: "rate-limited"; retryAfterSeconds: number }
  | { kind: "concurrency-limited"; retryAfterSeconds: number };

export interface ProviderPermit {
  release(): Promise<void>;
}

export class RedisAdmissionStore {
  private readonly policy: AdmissionControlPolicy;
  private readonly namespace: string;

  constructor(
    private readonly redis: Redis,
    policyInput: AdmissionControlPolicy
  ) {
    this.policy = AdmissionControlPolicySchema.parse(policyInput);
    this.namespace = `${prefix}:${this.policy.deployment}:${this.policy.region}:${this.policy.version}`;
  }

  async admitTask(input: {
    clientIdentityDigest: Uint8Array;
    permitId: string;
    referenceId: string;
    permitTtlMs?: number;
  }): Promise<AnonymousTaskAdmissionDecision> {
    if (!/^(?:tsk_[a-f0-9]{32}|adp_[a-f0-9]{64})$/.test(input.permitId)) {
      throw new Error("Admission permit ID is invalid.");
    }
    if (!/^adr_[a-f0-9]{32}$/.test(input.referenceId)) {
      throw new Error("Admission reference ID is invalid.");
    }
    const identity = digestHex(input.clientIdentityDigest);
    const permitTtlMs = Math.min(
      input.permitTtlMs ?? this.policy.taskPermitTtlMs,
      this.policy.taskPermitTtlMs
    );
    if (!Number.isInteger(permitTtlMs) || permitTtlMs < 1_000) {
      throw new Error("Task permit TTL is invalid.");
    }
    const clientActivePrefix = `${this.namespace}:active:client:`;
    const result = (await this.redis.eval(
      admitTaskScript,
      6,
      `${this.namespace}:rate:client:${identity}`,
      `${this.namespace}:rate:global`,
      `${clientActivePrefix}${identity}`,
      `${this.namespace}:active:global`,
      `${this.namespace}:task:${input.permitId}`,
      `${this.namespace}:task:${input.permitId}:references`,
      String(this.policy.clientRequestLimit),
      String(this.policy.globalRequestLimit),
      String(this.policy.requestWindowMs),
      String(this.policy.clientActiveTaskLimit),
      String(this.policy.globalActiveTaskLimit),
      input.permitId,
      String(permitTtlMs),
      identity,
      input.referenceId
    )) as [number, number];
    if (Number(result[0]) === 1) return { kind: "accepted" };
    if (Number(result[0]) === 2) {
      return { kind: "rate-limited", retryAfterSeconds: boundedRetryAfter(Number(result[1])) };
    }
    return {
      kind: "concurrency-limited",
      retryAfterSeconds: boundedRetryAfter(Number(result[1]))
    };
  }

  async releaseTask(permitId: string, referenceId: string): Promise<void> {
    if (!/^(?:tsk_[a-f0-9]{32}|adp_[a-f0-9]{64})$/.test(permitId)) {
      throw new Error("Admission permit ID is invalid.");
    }
    if (!/^adr_[a-f0-9]{32}$/.test(referenceId)) {
      throw new Error("Admission reference ID is invalid.");
    }
    await this.redis.eval(
      releaseTaskScript,
      3,
      `${this.namespace}:task:${permitId}`,
      `${this.namespace}:active:global`,
      `${this.namespace}:task:${permitId}:references`,
      `${this.namespace}:active:client:`,
      permitId,
      referenceId
    );
  }

  async acquireProvider(keyInput: ProviderConcurrencyKey): Promise<ProviderPermit | null> {
    const key = ProviderConcurrencyKeySchema.parse(keyInput);
    const limit = resolveProviderConcurrencyLimit(this.policy, key);
    const owner = randomUUID();
    const storageKey = this.providerKey(key);
    const result = (await this.redis.eval(
      acquireProviderScript,
      1,
      storageKey,
      String(limit),
      owner,
      String(this.policy.providerLeaseTtlMs),
      String(this.policy.providerLeaseTtlMs + 60_000)
    )) as [number, number];
    if (Number(result[0]) !== 1) {
      return null;
    }
    return {
      release: async () => {
        await this.redis.eval(releaseProviderScript, 1, storageKey, owner);
      }
    };
  }

  keyPrefix(): string {
    return `${this.namespace}:`;
  }

  private providerKey(key: ProviderConcurrencyKey): string {
    return `${this.namespace}:provider:${key.providerId}:${key.platform}:${key.region}`;
  }
}
