import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

const releaseScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end
return 0
`;

export class RedisCanaryLease {
  private readonly key: string;
  constructor(private readonly redis: Redis, deployment: string) {
    this.key = `tikdd:canary:v1:${deployment}:lease`;
  }
  storageKey(): string { return this.key; }
  async acquire(ttlMs: number): Promise<{ release(): Promise<void> } | null> {
    const owner = randomUUID();
    if ((await this.redis.set(this.key, owner, "PX", ttlMs, "NX")) !== "OK") return null;
    return { release: async () => { await this.redis.eval(releaseScript, 1, this.key, owner); } };
  }
}
