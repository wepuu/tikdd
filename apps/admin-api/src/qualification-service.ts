import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  AdminMutationReceiptSchema,
  AdminQualificationLockCommandSchema,
  AdminQualificationReviewCommandSchema,
  AdminQualificationViewSchema,
  type AdminMutationReceipt,
  type AdminQualificationStage,
  type AdminQualificationView
} from "@tikdd/admin-contracts";
import type { ProviderManifest } from "@tikdd/contracts";
import type { AdminQualificationRepository, QualificationCommandIdentity, QualificationAdminState } from "@tikdd/persistence";

const stages: readonly AdminQualificationStage[] = ["candidate","fixture-ready","canary-ready","internal","limited","stable"];
const bps=(numerator:number,denominator:number)=>denominator===0?0:Math.min(10_000,Math.round(numerator*10_000/denominator));

export interface QualificationServiceOptions {
  region: string;
  manifests: readonly ProviderManifest[];
  repository: Pick<AdminQualificationRepository,"getState"|"review"|"lockPolicy">;
  commandSecret: string;
  freshnessMs: number;
  now?: () => Date;
}

export class AdminQualificationReadinessError extends Error {
  constructor(message: string) { super(message); this.name="AdminQualificationReadinessError"; }
}

export class AdminQualificationService {
  private readonly now:()=>Date;
  constructor(private readonly options:QualificationServiceOptions){
    if(options.commandSecret.length<32)throw new Error("Admin qualification command secret is invalid.");
    this.now=options.now??(()=>new Date());
  }

  private identity(idempotencyKey:string,command:unknown,actorSubject:string):QualificationCommandIdentity{
    const acceptedAt=this.now();
    return {commandId:`cmd_${randomBytes(16).toString("hex")}`,
      idempotencyDigest:createHmac("sha256",this.options.commandSecret).update(`qualification\0${idempotencyKey}`).digest(),
      commandDigest:createHash("sha256").update(JSON.stringify(command)).digest(),actorSubject,
      expiresAt:new Date(acceptedAt.getTime()+24*60*60_000)};
  }

  private async project(providerId:string,platform:string,region:string,state?:QualificationAdminState):Promise<AdminQualificationView>{
    if(region!==this.options.region)throw new AdminQualificationReadinessError("The qualification region is outside this Admin instance.");
    const source=state??await this.options.repository.getState(providerId,platform,region);
    const manifest=this.options.manifests.find(item=>item.id===providerId);
    const capability=manifest?.platforms.find(item=>item.platform===platform);
    const manifestDeclared=Boolean(manifest&&capability);
    const manifestEnabled=Boolean(manifest?.enabled&&manifest.kind!=="mock");
    const regionSupported=Boolean(manifest&&(manifest.regions.includes("*")||manifest.regions.includes(region)));
    const fixtureVerified=Boolean(capability&&capability.verificationStatus!=="unverified");
    const deliverySupported=Boolean(capability&&capability.deliveryModes.length>0);
    const canaryReady=Boolean(source.canary?.succeeded&&this.now().getTime()-new Date(source.canary.observedAt).getTime()<=this.options.freshnessMs);
    const days=source.evidenceDays;
    const consecutive=days.length===3&&days.every((day,index)=>day.completeness==="sealed"&&(index===0||
      new Date(`${day.utcDay}T00:00:00Z`).getTime()-new Date(`${days[index-1]!.utcDay}T00:00:00Z`).getTime()===86_400_000));
    const proposalMatches=Boolean(source.proposal&&days.length===3&&source.proposal.dayRevisions.join(",")===days.map(day=>day.aggregateRevision).join(","));
    const sampleComplete=Boolean(source.proposal&&days.every(day=>day.distinctResolutionTasks>=source.proposal!.policy.minimumSamples));
    const calibrationComplete=consecutive&&proposalMatches&&sampleComplete;
    const policyLocked=Boolean(source.lockedPolicy&&new Date(source.lockedPolicy.expiresAt)>this.now());
    const prerequisites=[
      {code:"manifest_declared" as const,satisfied:manifestDeclared,detail:manifestDeclared?"Provider manifest declares this platform.":"Provider manifest does not declare this platform."},
      {code:"manifest_enabled" as const,satisfied:manifestEnabled,detail:manifestEnabled?"Real Provider runtime is enabled.":"Real Provider runtime is disabled or development-only."},
      {code:"region_supported" as const,satisfied:regionSupported,detail:regionSupported?"Manifest permits this region.":"Manifest does not permit this region."},
      {code:"fixture_verified" as const,satisfied:fixtureVerified,detail:fixtureVerified?"Normalized fixtures and capability verification are recorded.":"Fixture-level capability verification is missing."},
      {code:"delivery_supported" as const,satisfied:deliverySupported,detail:deliverySupported?"A controlled delivery mode is declared.":"No controlled delivery mode is declared."},
      {code:"canary_ready" as const,satisfied:canaryReady,detail:canaryReady?"The latest scheduled Canary result is fresh and successful.":"No fresh successful scheduled Canary result exists."},
      {code:"calibration_complete" as const,satisfied:calibrationComplete,detail:calibrationComplete?"The proposal cites three consecutive sealed internal days.":"Three consecutive sealed internal days and matching proposal provenance are required."},
      {code:"policy_locked" as const,satisfied:policyLocked,detail:policyLocked?"A reviewed policy is locked and current.":"No current reviewed policy is locked."}
    ];
    const blockers=prerequisites.filter(item=>!item.satisfied).map(item=>item.detail);
    if(source.guard&&source.guard.action!=="eligible_for_review")blockers.push(`Restrictive guard is ${source.guard.action}: ${source.guard.reason}.`);
    const guardCap=source.guard?.capBps??10_000;
    const effectiveAllocationCapBps=Math.min(source.rollout.allocationBps,guardCap);
    return AdminQualificationViewSchema.parse({schemaVersion:"1",generatedAt:source.databaseNow,tuple:{providerId,platform,region},
      state:source.qualification?{...source.qualification,reviewer:source.qualification.reviewer}:{stage:"candidate",paused:true,pauseReason:"No owner qualification review has been recorded.",approvalReference:null,policyId:null,policyVersion:null,reviewer:null,revision:null,reviewedAt:null},
      prerequisites,calibration:{requiredDays:3,complete:calibrationComplete,
        windowStartedAt:days[0]?.windowStartedAt??null,windowEndedAt:days.at(-1)?.windowEndedAt??null,
        days:days.map(day=>{const deliveryTotal=Object.entries(day.deliveryCounts).filter(([key])=>key.startsWith("redirect_validation:")).reduce((sum,[,count])=>sum+count,0);
          return{utcDay:day.utcDay,completeness:day.completeness,revision:day.aggregateRevision,distinctSamples:day.distinctResolutionTasks,
            resolutionSuccessBps:bps(day.resolutionSuccessCount,day.resolutionObservationCount),deliverySuccessBps:bps(day.deliveryCounts["redirect_validation:passed"]??0,deliveryTotal),p95LatencyMs:day.latencyP95Ms};})},
      proposal:source.proposal,lockedPolicy:source.lockedPolicy,guard:source.guard,rollout:source.rollout,
      eligibility:{decisions:["approve","hold","deny"],promotionEligible:blockers.length===0,blockers,effectiveAllocationCapBps}});
  }

  getView(providerId:string,platform:string,region:string){return this.project(providerId,platform,region);}

  async review(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminQualificationReviewCommandSchema.parse(raw);const view=await this.project(command.providerId,command.platform,command.region);
    const current=view.state.stage;const currentIndex=stages.indexOf(current);const targetIndex=stages.indexOf(command.targetStage);
    if(command.expectedRevision!==view.state.revision)throw new AdminQualificationReadinessError("Reload the current qualification revision.");
    if(command.decision!=="approve"&&command.targetStage!==current)throw new AdminQualificationReadinessError("Hold and deny must preserve the current qualification stage.");
    if(command.decision==="approve"){
      if(targetIndex!==currentIndex+1)throw new AdminQualificationReadinessError("Approval may advance exactly one qualification stage.");
      const requiredCount=targetIndex<=1?4:targetIndex<=3?6:8;
      const missing=view.prerequisites.slice(0,requiredCount).filter(item=>!item.satisfied);
      if(missing.length>0)throw new AdminQualificationReadinessError(missing[0]!.detail);
      if(targetIndex>=4&&view.guard?.action!=="eligible_for_review")throw new AdminQualificationReadinessError("A restrictive or missing guard blocks promotion.");
    }
    return AdminMutationReceiptSchema.parse(await this.options.repository.review(command,this.identity(command.idempotencyKey,command,actorSubject)));
  }

  async lockPolicy(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminQualificationLockCommandSchema.parse(raw);const view=await this.project(command.providerId,command.platform,command.region);
    if(command.expectedRevision!==view.state.revision)throw new AdminQualificationReadinessError("Reload the current qualification revision.");
    if(!view.calibration.complete||!view.proposal||view.proposal.status!=="proposed"||view.proposal.proposalId!==command.proposalId||view.proposal.revision!==command.expectedProposalRevision)
      throw new AdminQualificationReadinessError("The exact current calibration proposal is not lockable.");
    return AdminMutationReceiptSchema.parse(await this.options.repository.lockPolicy(command,this.identity(command.idempotencyKey,command,actorSubject)));
  }
}
