import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PilotDailyEvidenceSchema, PilotPolicySchema } from "@tikdd/rollout-control";
import { AdminQualificationRepository, createDatabasePool, type QualificationCommandIdentity } from "./index";

const pool=createDatabasePool();const repository=new AdminQualificationRepository(pool);
const providerId=`wi18-${randomBytes(4).toString("hex")}`;const platform="x";const region="wi18-local";
const proposalId=randomUUID();const commandIds:string[]=[];
function identity(label:string):QualificationCommandIdentity{const commandId=`cmd_${randomBytes(16).toString("hex")}`;commandIds.push(commandId);return{commandId,
  idempotencyDigest:createHash("sha256").update(`wi18-idempotency:${label}:${providerId}`).digest(),commandDigest:createHash("sha256").update(`wi18-command:${label}:${providerId}`).digest(),
  actorSubject:"owner.wi18",expiresAt:new Date(Date.now()+86_400_000)};}
const reviewIdentity=identity("review");const lockIdentity=identity("lock");

try{
  const initial=await repository.getState(providerId,platform,region);if(initial.qualification!==null||initial.rollout.allocationBps!==0)throw new Error("Qualification verification tuple was not empty.");
  const reviewCommand={providerId,platform,region,expectedRevision:null,decision:"hold" as const,targetStage:"candidate" as const,approvalReference:null,
    reason:"Create a restrictive verification baseline.",confirmation:`${providerId}/${platform}/${region}`,idempotencyKey:"wi18reviewverify1"};
  const first=await repository.review(reviewCommand,reviewIdentity);const replay=await repository.review(reviewCommand,reviewIdentity);
  if(first.commandId!==replay.commandId||first.acceptedRevision!==1)throw new Error("Qualification review idempotency failed.");
  const policy=PilotPolicySchema.parse({id:`pilot_${providerId}_x`,version:1,providerId,platform,region,calibrationStartedAt:"2026-08-10T00:00:00.000Z",
    calibrationCompletedAt:"2026-08-13T00:00:00.000Z",lockedAt:"2026-08-14T00:00:00.000Z",expiresAt:"2027-08-14T00:00:00.000Z",observationClass:"internal",
    evaluationDays:1,recoveryDays:1,cooldownMs:60_000,aggregationVersion:1,taxonomyVersion:1,calibrationDayRevisions:[1,2,3],minimumSamples:1,maximumEvidenceAgeMs:86_400_000,
    staleAction:"deny",rollbackAllocationBps:0,thresholds:{minimumResolutionSuccessBps:9000,maximumP95LatencyMs:10000,maximumChallengeRateBps:1000,maximumTimeoutRateBps:1000,
      maximumInvalidResultRateBps:1000,minimumDeliverySuccessBps:9000,minimumCandidateCoverageBps:9000,maximumFallbackDepthP95:1,maximumExpiryRateBps:1000}});
  for(let offset=0;offset<3;offset+=1){const day=10+offset;const next=11+offset;const summary=PilotDailyEvidenceSchema.parse({providerId,platform,region,observationClass:"internal",
    utcDay:`2026-08-${day}`,windowStartedAt:`2026-08-${day}T00:00:00.000Z`,windowEndedAt:`2026-08-${next}T00:00:00.000Z`,completeness:"sealed",aggregationVersion:1,
    taxonomyVersion:1,sourceWatermark:`2026-08-${next}T00:00:00.000Z`,aggregateRevision:offset+1,generatedAt:"2026-08-20T00:00:00.000Z",expiresAt:"2027-09-30T00:00:00.000Z",
    distinctResolutionTasks:1,resolutionObservationCount:1,resolutionSuccessCount:1,resolutionFailureCounts:{},latencyHistogram:{"1000":1},latencyP50Ms:500,latencyP95Ms:500,
    fallbackDepthHistogram:{"0":1},fallbackDepthP95:0,resultFormatCount:1,candidateCount:1,deliveryCounts:{"redirect_validation:passed":1},absoluteStopCount:0,lateAfterSealCount:0});
    await pool.query(`INSERT INTO provider_daily_evidence (provider_id,platform,region,observation_class,utc_day,aggregation_version,taxonomy_version,completeness,
      source_watermark,aggregate_revision,summary,generated_at,expires_at) VALUES($1,$2,$3,'internal',$4,1,1,'sealed',$5,$6,$7::jsonb,$8,$9)`,
      [providerId,platform,region,summary.utcDay,summary.sourceWatermark,summary.aggregateRevision,JSON.stringify(summary),summary.generatedAt,summary.expiresAt]);}
  await pool.query(`INSERT INTO provider_calibration_proposals (proposal_id,provider_id,platform,region,observation_class,aggregation_version,taxonomy_version,day_revisions,
    proposed_policy,status,evidence_owner_id,revision,expires_at) VALUES($1,$2,$3,$4,'internal',1,1,'[1,2,3]'::jsonb,$5::jsonb,'proposed','owner.wi18',1,'2028-08-14T00:00:00.000Z')`,
    [proposalId,providerId,platform,region,JSON.stringify(policy)]);
  const lockCommand={providerId,platform,region,expectedRevision:1,proposalId,expectedProposalRevision:1,reason:"Lock the exact verification proposal.",
    confirmation:`${providerId}/${platform}/${region}`,idempotencyKey:"wi18lockverify12"};
  const locked=await repository.lockPolicy(lockCommand,lockIdentity);const lockedReplay=await repository.lockPolicy(lockCommand,lockIdentity);
  const final=await repository.getState(providerId,platform,region);const rollout=await pool.query(`SELECT count(*)::int AS count FROM provider_rollout_rules WHERE provider_id=$1`,[providerId]);
  if(locked.commandId!==lockedReplay.commandId||final.qualification?.revision!==2||final.lockedPolicy?.id!==policy.id||final.proposal?.status!=="locked"||rollout.rows[0]?.count!==0)
    throw new Error("Qualification policy lock verification failed.");
  console.log("qualification_admin_verification=PASS");console.log(`tuple=${providerId}/${platform}/${region}`);console.log("rollout_grants_created=0");
}finally{
  await pool.query("DELETE FROM admin_command_receipts WHERE command_id=ANY($1::text[])",[commandIds]);
  await pool.query("DELETE FROM provider_evidence_reviews WHERE provider_id=$1 AND platform=$2 AND region=$3",[providerId,platform,region]);
  await pool.query("DELETE FROM provider_qualification_review_audit WHERE provider_id=$1 AND platform=$2 AND region=$3",[providerId,platform,region]);
  await pool.query("DELETE FROM provider_qualification_reviews WHERE provider_id=$1 AND platform=$2 AND region=$3",[providerId,platform,region]);
  await pool.query("DELETE FROM provider_calibration_proposals WHERE provider_id=$1 AND platform=$2 AND region=$3",[providerId,platform,region]);
  await pool.query("DELETE FROM provider_daily_evidence WHERE provider_id=$1 AND platform=$2 AND region=$3",[providerId,platform,region]);
  await pool.query("DELETE FROM provider_pilot_policies WHERE provider_id=$1 AND platform=$2 AND region=$3",[providerId,platform,region]);
  await pool.end();
}
