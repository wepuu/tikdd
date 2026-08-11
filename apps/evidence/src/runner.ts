import type { PilotControlRepository, PilotEvidenceRepository, RolloutRuleRepository } from "@tikdd/persistence";
import {
  buildPilotEvidence,evaluatePilotGuard,resolveOperatorTupleAuthorization,
  type PilotEvidence,type PilotGuard,type PilotGuardSampleSummary,type PilotGuardSnapshot,type PilotPolicy
} from "@tikdd/rollout-control";
import type { EvidenceConfiguration } from "./configuration";

export interface EvidenceLeaseSource { acquire(ttlMs:number):Promise<{release():Promise<void>}|null>; }
export interface GuardPublisher { putSnapshot(snapshot:PilotGuardSnapshot,ttlMs:number):Promise<boolean>; }
export interface EvidenceRunResult { status:"completed"|"partial"|"failed"|"lease_unavailable"; tupleCount:number; changedGuardCount:number; rebuiltDayCount:number; }

function utcDay(date: Date): string { return date.toISOString().slice(0,10); }
function dayAt(now: Date,offset: number): string { return utcDay(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+offset))); }
function missingEvidence(policy:PilotPolicy,now:Date):PilotEvidence {
  const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const start=new Date(end.getTime()-policy.evaluationDays*86_400_000);
  return {providerId:policy.providerId,platform:policy.platform,region:policy.region,observationClass:policy.observationClass,
    aggregationVersion:policy.aggregationVersion,taxonomyVersion:policy.taxonomyVersion,
    dayRevisions:Array.from({length:policy.evaluationDays},()=>1),completeDays:policy.evaluationDays,sealedDays:0,
    windowStartedAt:start.toISOString(),windowEndedAt:end.toISOString(),collectedAt:new Date(0).toISOString(),
    distinctSamples:0,resolutionSuccessBps:0,p95LatencyMs:0,challengeRateBps:0,timeoutRateBps:0,
    invalidResultRateBps:0,deliverySuccessBps:0,candidateCoverageBps:0,fallbackDepthP95:0,expiryRateBps:0,absoluteStop:false};
}
function summary(evidence:PilotEvidence):PilotGuardSampleSummary {
  return {distinctSamples:evidence.distinctSamples,resolutionSuccessBps:evidence.resolutionSuccessBps,
    p95LatencyMs:evidence.p95LatencyMs,challengeRateBps:evidence.challengeRateBps,timeoutRateBps:evidence.timeoutRateBps,
    invalidResultRateBps:evidence.invalidResultRateBps,deliverySuccessBps:evidence.deliverySuccessBps,
    candidateCoverageBps:evidence.candidateCoverageBps,fallbackDepthP95:evidence.fallbackDepthP95,
    expiryRateBps:evidence.expiryRateBps,observationClass:evidence.observationClass,
    aggregationVersion:evidence.aggregationVersion,taxonomyVersion:evidence.taxonomyVersion,dayRevisions:evidence.dayRevisions};
}
function materiallyChanged(previous:PilotGuard|null,next:PilotGuard):boolean {
  return !previous||previous.action!==next.action||previous.reason!==next.reason||previous.capBps!==next.capBps||
    previous.evidenceWindowEndedAt!==next.evidenceWindowEndedAt||previous.expiresAt<=next.updatedAt;
}

export async function runEvidenceCycle(input:{evidence:PilotEvidenceRepository;pilot:PilotControlRepository;
  rollout:RolloutRuleRepository;publisher:GuardPublisher;lease:EvidenceLeaseSource;configuration:EvidenceConfiguration;now?:Date}):Promise<EvidenceRunResult> {
  const startedAt=input.now??new Date();
  const lease=await input.lease.acquire(input.configuration.leaseTtlMs);
  if (!lease) {
    await input.evidence.recordEvaluatorRun({deployment:input.configuration.deployment,ownerId:input.configuration.ownerId,
      status:"lease_unavailable",tupleCount:0,changedGuardCount:0,startedAt,finishedAt:new Date(),errorCode:null});
    return {status:"lease_unavailable",tupleCount:0,changedGuardCount:0,rebuiltDayCount:0};
  }
  let tupleCount=0,changedGuardCount=0,rebuiltDayCount=0;
  try {
    for (let offset=-(input.configuration.rebuildDays-1);offset<=0;offset+=1) {
      await input.evidence.rebuildUtcDay(dayAt(startedAt,offset),startedAt); rebuiltDayCount+=1;
    }
    const [policies,rolloutSnapshot,currentSnapshot]=await Promise.all([
      input.pilot.listActivePolicies(startedAt),input.rollout.loadSnapshot(),input.pilot.loadGuardSnapshot()]);
    const seen=new Set<string>();
    for (const policy of policies) {
      const key=`${policy.providerId}\0${policy.platform}\0${policy.region}`;
      if (seen.has(key)) throw new Error("Multiple active pilot policies exist for one tuple.");
      seen.add(key);tupleCount+=1;
      const authorization=resolveOperatorTupleAuthorization({snapshot:rolloutSnapshot,providerId:policy.providerId,
        platform:policy.platform,region:policy.region,now:startedAt});
      if (!authorization.allowed) continue;
      const toDay=dayAt(startedAt,-1);const fromDay=dayAt(startedAt,-policy.evaluationDays);
      const days=await input.evidence.listDailyEvidence({providerId:policy.providerId,platform:policy.platform,
        region:policy.region,observationClass:policy.observationClass,fromDay,toDay});
      const evidence=days.length===policy.evaluationDays ? buildPilotEvidence(days,startedAt) : missingEvidence(policy,startedAt);
      const current=currentSnapshot.guards.find((guard)=>guard.providerId===policy.providerId&&guard.platform===policy.platform&&guard.region===policy.region)??null;
      const next=evaluatePilotGuard({policy,evidence,operatorAllocationBps:authorization.allocationBps,currentGuard:current,now:startedAt});
      if (!materiallyChanged(current,next)) continue;
      await input.pilot.applyGuard({guard:next,expectedRevision:current?.revision??null,actorId:input.configuration.ownerId,
        sampleSummary:summary(evidence),expectedRolloutRevision:authorization.snapshotRevision,verifyEvidenceRevisions:days.length===policy.evaluationDays});
      changedGuardCount+=1;
    }
    const snapshot=await input.pilot.loadGuardSnapshot();
    await input.publisher.putSnapshot(snapshot,input.configuration.snapshotTtlMs);
    const finishedAt=new Date();
    await input.evidence.recordEvaluatorRun({deployment:input.configuration.deployment,ownerId:input.configuration.ownerId,
      status:"completed",tupleCount,changedGuardCount,startedAt,finishedAt,errorCode:null});
    return {status:"completed",tupleCount,changedGuardCount,rebuiltDayCount};
  } catch {
    await input.evidence.recordEvaluatorRun({deployment:input.configuration.deployment,ownerId:input.configuration.ownerId,
      status:"failed",tupleCount,changedGuardCount,startedAt,finishedAt:new Date(),errorCode:"evaluation_failed"}).catch(()=>undefined);
    return {status:"failed",tupleCount,changedGuardCount,rebuiltDayCount};
  } finally { await lease.release().catch(()=>undefined); }
}
