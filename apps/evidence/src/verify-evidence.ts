import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabasePool,PilotControlRepository,PilotEvidenceRepository,RolloutRuleRepository } from "@tikdd/persistence";
import { RedisPilotGuardStore,pilotGuardRedisKeys } from "@tikdd/rollout-control";
import Redis from "ioredis";
import { RedisEvidenceLease } from "./lease";
import { runEvidenceCycle } from "./runner";

const databaseUrl=process.env.DATABASE_URL,redisUrl=process.env.REDIS_URL;
if(!databaseUrl||!redisUrl)throw new Error("DATABASE_URL and REDIS_URL are required.");
const suffix=randomUUID().replaceAll("-","").slice(0,10),providerId=`evidence-${suffix}`,region=`verify-${suffix}`;
const pool=createDatabasePool(databaseUrl),redis=new Redis(redisUrl,{maxRetriesPerRequest:1});
const evidence=new PilotEvidenceRepository(pool),pilot=new PilotControlRepository(pool),rollout=new RolloutRuleRepository(pool);
const now=new Date(),dayEnd=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),dayStart=new Date(dayEnd.getTime()-86_400_000),day=dayStart.toISOString().slice(0,10);
const taskIds=[0,1].map((index)=>`tsk_${suffix.padEnd(31,String(index))}${index}`);
const policyId=`evidence-policy-${suffix}`,ruleId=`evidence-grant-${suffix}`;
const deployment=`verification-${suffix}`;
const previousGuardSnapshot=await redis.get(pilotGuardRedisKeys.snapshotKey);
const previousGuardTtl=await redis.pttl(pilotGuardRedisKeys.snapshotKey);
try{
  for(const [index,taskId] of taskIds.entries()){
    await pool.query(`INSERT INTO resolve_tasks(id,status,platform,canonical_url,result,created_at,updated_at,expires_at,observation_class)
      VALUES($1,'succeeded','x',$2,$3::jsonb,$4,$5,$6,'public')`,[taskId,`https://fixture.invalid/${index}`,JSON.stringify({provenance:{provider:providerId},formats:[{id:"fmt"}]}),new Date(dayStart.getTime()+1000),new Date(dayStart.getTime()+10_000+index),new Date(now.getTime()+86_400_000)]);
    const values=[taskId,providerId,"site-adapter","x",region,900,900000,"succeeded",null,null,null,new Date(dayStart.getTime()+2000),new Date(dayStart.getTime()+11_000+index),9000];
    await pool.query(`INSERT INTO provider_attempts(task_id,provider_id,provider_kind,platform,region,priority,route_score,status,failure_code,retryable,fallback_allowed,started_at,finished_at,duration_ms)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,values);
    if(index===0)await pool.query(`INSERT INTO provider_attempts(task_id,provider_id,provider_kind,platform,region,priority,route_score,status,failure_code,retryable,fallback_allowed,started_at,finished_at,duration_ms)
      VALUES($1,$2,$3,$4,$5,$6,$7,'failed','provider_timeout',TRUE,TRUE,$8,$9,1000)`,[taskId,providerId,"site-adapter","x",region,900,900000,new Date(dayStart.getTime()+500),new Date(dayStart.getTime()+1500)]);
  }
  await evidence.recordDeliveryOutcome({outcomeId:randomUUID(),providerId,platform:"x",region,observationClass:"public",mode:"redirect",stage:"redirect_validation",result:"passed",durationMs:25,occurredAt:new Date(dayStart.getTime()+20_000).toISOString(),ingestedAt:new Date(dayStart.getTime()+20_100).toISOString(),expiresAt:new Date(dayStart.getTime()+35*86_400_000).toISOString(),deliveryPolicyVersion:1,taxonomyVersion:1});
  const first=await evidence.rebuildUtcDay(day,now),second=await evidence.rebuildUtcDay(day,now);
  const summary=second.find((item)=>item.providerId===providerId&&item.observationClass==="public");
  assert.equal(summary?.distinctResolutionTasks,2);assert.equal(summary?.resolutionObservationCount,2);assert.equal(summary?.aggregateRevision,2);
  await pilot.lockPolicy({reviewerId:"evidence.verification",policy:{id:policyId,version:1,providerId,platform:"x",region,
    calibrationStartedAt:new Date(dayStart.getTime()-4*86_400_000).toISOString(),calibrationCompletedAt:new Date(dayStart.getTime()-86_400_000).toISOString(),lockedAt:new Date(dayStart.getTime()-80_000_000).toISOString(),expiresAt:new Date(now.getTime()+30*86_400_000).toISOString(),observationClass:"public",evaluationDays:1,recoveryDays:1,cooldownMs:60_000,aggregationVersion:1,taxonomyVersion:1,calibrationDayRevisions:[1,2,3],minimumSamples:2,maximumEvidenceAgeMs:172_800_000,staleAction:"reduce",rollbackAllocationBps:500,thresholds:{minimumResolutionSuccessBps:9000,maximumP95LatencyMs:8000,maximumChallengeRateBps:500,maximumTimeoutRateBps:500,maximumInvalidResultRateBps:100,minimumDeliverySuccessBps:9000,minimumCandidateCoverageBps:0,maximumFallbackDepthP95:2,maximumExpiryRateBps:1000}}});
  await rollout.applyChange({rule:{id:ruleId,providerId,platform:"x",region,enabled:true,allocationBps:2500,activatesAt:new Date(dayStart.getTime()-1000).toISOString(),expiresAt:new Date(now.getTime()+86_400_000).toISOString()},operatorId:"evidence.verification",reason:"Deterministic evidence verification grant.",expectedRevision:null});
  const result=await runEvidenceCycle({evidence,pilot,rollout,publisher:new RedisPilotGuardStore(redis),lease:new RedisEvidenceLease(redis,deployment),configuration:{deployment,ownerId:"evidence.verification",intervalMs:300_000,leaseTtlMs:360_000,snapshotTtlMs:30_000,rebuildDays:4},now});
  assert.equal(result.status,"completed");const guard=(await pilot.loadGuardSnapshot()).guards.find((item)=>item.providerId===providerId);assert.deepEqual({action:guard?.action,reason:guard?.reason,capBps:guard?.capBps},{action:"reduce",reason:"latency",capBps:500});
  const raw=JSON.stringify(summary);for(const forbidden of taskIds)assert.equal(raw.includes(forbidden),false);
  process.stdout.write("Pilot evidence replay, privacy, restrictive evaluation, and snapshot verification passed.\n");
}finally{
  await pool.query("DELETE FROM provider_evidence_export_audit WHERE provider_id=$1",[providerId]);await pool.query("DELETE FROM provider_evidence_evaluator_runs WHERE deployment=$1",[deployment]);
  await pool.query("DELETE FROM provider_pilot_guard_audit WHERE provider_id=$1",[providerId]);await pool.query("DELETE FROM provider_pilot_guards WHERE provider_id=$1",[providerId]);
  await pool.query("DELETE FROM provider_pilot_policies WHERE provider_id=$1",[providerId]);await pool.query("DELETE FROM provider_daily_evidence WHERE provider_id=$1",[providerId]);await pool.query("DELETE FROM provider_delivery_outcomes WHERE provider_id=$1",[providerId]);
  await pool.query("DELETE FROM provider_rollout_rule_audit WHERE rule_id=$1",[ruleId]);await pool.query("DELETE FROM provider_rollout_rules WHERE rule_id=$1",[ruleId]);await pool.query("DELETE FROM resolve_tasks WHERE id=ANY($1::text[])",[taskIds]);
  if(previousGuardSnapshot===null)await redis.del(pilotGuardRedisKeys.snapshotKey);else await redis.set(pilotGuardRedisKeys.snapshotKey,previousGuardSnapshot,"PX",Math.max(previousGuardTtl,5000));
  redis.disconnect();await pool.end();
}
