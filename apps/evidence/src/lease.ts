import { randomUUID } from "node:crypto";
import type Redis from "ioredis";

export class RedisEvidenceLease {
  constructor(private readonly redis: Redis,private readonly deployment: string) {}
  async acquire(ttlMs: number): Promise<{release():Promise<void>}|null> {
    const key=`tikdd:evidence:v1:lease:${this.deployment}`;
    const owner=randomUUID();
    const acquired=await this.redis.set(key,owner,"PX",ttlMs,"NX");
    if (acquired!=="OK") return null;
    return {release:async()=>{ await this.redis.eval(`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`,1,key,owner); }};
  }
}
