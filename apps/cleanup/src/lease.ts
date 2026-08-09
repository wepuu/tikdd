import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

const releaseOwnedLeaseScript = `
-- tikdd:release-owned-cleanup-lease
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export class RedisCleanupLease {
  private readonly key: string;

  constructor(
    private readonly redis: Redis,
    deployment: string
  ) {
    this.key = `tikdd:cleanup:v1:${deployment}:lease`;
  }

  storageKey(): string {
    return this.key;
  }

  async acquire(ttlMs: number): Promise<{ release(): Promise<void> } | null> {
    const owner = randomUUID();
    const acquired = await this.redis.set(this.key, owner, "PX", ttlMs, "NX");
    if (acquired !== "OK") return null;
    return {
      release: async () => {
        await this.redis.eval(releaseOwnedLeaseScript, 1, this.key, owner);
      }
    };
  }
}
