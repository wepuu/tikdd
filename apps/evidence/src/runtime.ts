import { createDatabasePool,PilotControlRepository,PilotEvidenceRepository,RolloutRuleRepository } from "@tikdd/persistence";
import { RedisPilotGuardStore } from "@tikdd/rollout-control";
import Redis from "ioredis";
import { loadEvidenceConfiguration } from "./configuration";
import { RedisEvidenceLease } from "./lease";
import { runEvidenceCycle } from "./runner";

export async function executeEvidenceCycle(){
  const configuration=loadEvidenceConfiguration();
  const redisUrl=process.env.REDIS_URL;if(!redisUrl)throw new Error("REDIS_URL is required.");
  const pool=createDatabasePool();const redis=new Redis(redisUrl,{maxRetriesPerRequest:1,enableOfflineQueue:false,lazyConnect:true});
  await redis.connect();
  const result=await runEvidenceCycle({evidence:new PilotEvidenceRepository(pool),pilot:new PilotControlRepository(pool),
    rollout:new RolloutRuleRepository(pool),publisher:new RedisPilotGuardStore(redis),lease:new RedisEvidenceLease(redis,configuration.deployment),configuration});
  return {result,close:async()=>{redis.disconnect();await pool.end();}};
}
