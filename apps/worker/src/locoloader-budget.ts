import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { LocoLoaderBudgetPermit, LocoLoaderRequestBudget } from "@tikdd/providers";

const RESERVE_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then return 0 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[2])
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[3]) then return 0 end
local last = tonumber(redis.call('GET', KEYS[3]) or '0')
if last > 0 and tonumber(ARGV[2]) < last + tonumber(ARGV[4]) then return 0 end
local nextCount = redis.call('INCR', KEYS[1])
if nextCount == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[5]) end
redis.call('ZADD', KEYS[2], tonumber(ARGV[2]) + tonumber(ARGV[6]), ARGV[7])
redis.call('PEXPIRE', KEYS[2], ARGV[6])
redis.call('SET', KEYS[3], ARGV[2], 'PX', ARGV[5])
return 1
`;

const RELEASE_SCRIPT = "return redis.call('ZREM', KEYS[1], ARGV[1])";

export interface RedisLocoLoaderRequestBudgetOptions {
  region: string;
  maxExtractions?: number;
  windowMs?: number;
  maxConcurrency?: number;
  minIntervalMs?: number;
  now?: () => number;
}

/**
 * One shared extraction window for the NL worker fleet. A token is consumed when the
 * extraction POST is admitted and is never returned on release; release only clears the
 * short-lived in-flight slot after the request has completed.
 */
export class RedisLocoLoaderRequestBudget implements LocoLoaderRequestBudget {
  private readonly maxExtractions: number;
  private readonly windowMs: number;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly countKey: string;
  private readonly activeKey: string;
  private readonly lastKey: string;
  private readonly redis: Redis;

  constructor(redis: Redis, options: RedisLocoLoaderRequestBudgetOptions) {
    this.redis = redis;
    this.maxExtractions = Math.max(1, Math.min(100, Math.floor(options.maxExtractions ?? 2)));
    this.windowMs = Math.max(1_000, Math.min(24 * 60 * 60 * 1_000, Math.floor(options.windowMs ?? 6 * 60 * 60 * 1_000)));
    this.maxConcurrency = Math.max(1, Math.min(16, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 1_000)));
    this.now = options.now ?? Date.now;
    const prefix = `tikdd:provider-budget:locoloader:${options.region}`;
    this.countKey = `${prefix}:extractions`;
    this.activeKey = `${prefix}:active`;
    this.lastKey = `${prefix}:last`;
  }

  async acquire(): Promise<LocoLoaderBudgetPermit | null> {
    const token = randomUUID();
    const now = this.now();
    let result: unknown;
    try {
      result = await this.redis.eval(
        RESERVE_SCRIPT,
        3,
        this.countKey,
        this.activeKey,
        this.lastKey,
        String(this.maxExtractions),
        String(now),
        String(this.maxConcurrency),
        String(this.minIntervalMs),
        String(this.windowMs),
        String(Math.max(90_000, this.minIntervalMs + 60_000)),
        token
      );
    } catch {
      // Redis is the source of truth for this finite upstream allowance. Fail closed if
      // the budget store is unavailable instead of calling LocoLoader without a reservation.
      return null;
    }
    if (Number(result) !== 1) return null;
    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        await this.redis.eval(RELEASE_SCRIPT, 1, this.activeKey, token).catch(() => undefined);
      }
    };
  }
}
