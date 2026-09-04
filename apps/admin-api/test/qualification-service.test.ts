import { describe,expect,it,vi } from "vitest";
import { AdminQualificationService } from "../src/qualification-service";
import type { QualificationAdminState } from "@tikdd/persistence";

const manifest={id:"ssstwitter",displayName:"SSSTwitter",kind:"site-adapter" as const,enabled:true,regions:["nl"],timeoutMs:12_000,costWeight:10,
  platforms:[{platform:"x",priority:900,deliveryModes:["redirect" as const],verificationStatus:"delivery_verified" as const}]};
const policy={id:"pilot_ssstwitter_x_nl",version:1,providerId:"ssstwitter",platform:"x",region:"nl",calibrationStartedAt:"2026-08-10T00:00:00.000Z",
  calibrationCompletedAt:"2026-08-13T00:00:00.000Z",lockedAt:"2026-08-13T00:00:01.000Z",expiresAt:"2026-08-20T00:00:00.000Z",observationClass:"internal" as const,
  evaluationDays:1,recoveryDays:1,cooldownMs:60_000,aggregationVersion:1,taxonomyVersion:1,calibrationDayRevisions:[1,2,3],minimumSamples:1,
  maximumEvidenceAgeMs:86_400_000,staleAction:"deny" as const,rollbackAllocationBps:0,thresholds:{minimumResolutionSuccessBps:9000,maximumP95LatencyMs:10000,
    maximumChallengeRateBps:1000,maximumTimeoutRateBps:1000,maximumInvalidResultRateBps:1000,minimumDeliverySuccessBps:9000,minimumCandidateCoverageBps:9000,
    maximumFallbackDepthP95:1,maximumExpiryRateBps:1000}};
const days=[0,1,2].map((offset)=>({providerId:"ssstwitter",platform:"x",region:"nl",observationClass:"internal" as const,utcDay:`2026-08-${10+offset}`,
  windowStartedAt:`2026-08-${10+offset}T00:00:00.000Z`,windowEndedAt:`2026-08-${11+offset}T00:00:00.000Z`,completeness:"sealed" as const,aggregationVersion:1,
  taxonomyVersion:1,sourceWatermark:`2026-08-${11+offset}T00:00:00.000Z`,aggregateRevision:offset+1,generatedAt:`2026-08-${12+offset}T00:00:00.000Z`,
  expiresAt:"2027-08-20T00:00:00.000Z",distinctResolutionTasks:10,resolutionObservationCount:10,resolutionSuccessCount:10,resolutionFailureCounts:{},
  latencyHistogram:{"1000":10},latencyP50Ms:500,latencyP95Ms:900,fallbackDepthHistogram:{"0":10},fallbackDepthP95:0,resultFormatCount:20,candidateCount:20,
  deliveryCounts:{"redirect_validation:passed":10},absoluteStopCount:0,lateAfterSealCount:0}));
const receipt={schemaVersion:"1" as const,commandId:`cmd_${"a".repeat(32)}`,aggregate:"qualification" as const,targetId:"ssstwitter/x/nl",expectedRevision:4,
  acceptedRevision:5,currentRevision:5,propagatedRevision:5,state:"propagated" as const,acceptedAt:"2026-08-14T00:00:00.000Z",completedAt:"2026-08-14T00:00:00.000Z"};

function state(overrides:Partial<QualificationAdminState>={}):QualificationAdminState{return {qualification:{stage:"internal",paused:true,pauseReason:"Awaiting review.",approvalReference:null,
  policyId:null,policyVersion:null,reviewer:"owner_tikdd",revision:4,reviewedAt:"2026-08-13T00:00:00.000Z"},evidenceDays:days,proposal:{proposalId:"11111111-1111-4111-8111-111111111111",
  status:"proposed",revision:1,evidenceOwner:"owner_tikdd",dayRevisions:[1,2,3],policy,createdAt:"2026-08-13T00:00:00.000Z",updatedAt:"2026-08-13T00:00:00.000Z"},
  lockedPolicy:null,guard:null,rollout:{allocationBps:0,revision:null},canary:{succeeded:true,observedAt:"2026-08-13T23:59:00.000Z"},databaseNow:"2026-08-14T00:00:00.000Z",...overrides};}
function setup(source=state()) { const repository={getState:vi.fn(async()=>source),review:vi.fn(async()=>receipt),lockPolicy:vi.fn(async()=>receipt)};
  return {repository,service:new AdminQualificationService({region:"nl",manifests:[manifest],repository:repository as never,commandSecret:"qualification-command-secret-at-least-32",freshnessMs:300_000,now:()=>new Date("2026-08-14T00:00:00.000Z")})}; }

describe("Admin qualification workflow",()=>{
  it("projects exact sealed provenance and keeps missing policy and guard as promotion blockers",async()=>{const {service}=setup();const view=await service.getView("ssstwitter","x","nl");
    expect(view.calibration).toMatchObject({complete:true,requiredDays:3});expect(view.eligibility.promotionEligible).toBe(false);expect(view.eligibility.effectiveAllocationCapBps).toBe(0);
    expect(view.eligibility.blockers).toContain("No current reviewed policy is locked.");});
  it("locks only the exact current proposal without granting rollout traffic",async()=>{const {service,repository}=setup();await service.lockPolicy({providerId:"ssstwitter",platform:"x",region:"nl",
    expectedRevision:4,proposalId:"11111111-1111-4111-8111-111111111111",expectedProposalRevision:1,reason:"Lock the reviewed three-day proposal.",confirmation:"ssstwitter/x/nl",
    idempotencyKey:"abcdefghijklmnop"},"owner_tikdd");expect(repository.lockPolicy).toHaveBeenCalledOnce();expect(repository.review).not.toHaveBeenCalled();});
  it("allows restrictive decisions but blocks skipped promotion stages",async()=>{const {service,repository}=setup();await service.review({providerId:"ssstwitter",platform:"x",region:"nl",expectedRevision:4,
    decision:"hold",targetStage:"internal",approvalReference:null,reason:"Keep the route paused.",confirmation:"ssstwitter/x/nl",idempotencyKey:"abcdefghijklmnop"},"owner_tikdd");
    expect(repository.review).toHaveBeenCalledOnce();await expect(service.review({providerId:"ssstwitter",platform:"x",region:"nl",expectedRevision:4,decision:"approve",targetStage:"stable",
      approvalReference:"owner-review-1",reason:"Skip directly to stable.",confirmation:"ssstwitter/x/nl",idempotencyKey:"qrstuvwxyzABCDEF"},"owner_tikdd")).rejects.toThrow("exactly one");});
});
