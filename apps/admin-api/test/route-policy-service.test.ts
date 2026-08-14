import { ADMIN_ROUTE_POLICY_FIXTURE } from "@tikdd/admin-contracts/fixtures";
import { describe,expect,it,vi } from "vitest";
import { AdminRoutePolicyService, type RoutePolicyServiceOptions } from "../src/route-policy-service";

const manifest={id:"twittersaver",displayName:"TwitterSaver",kind:"site-adapter" as const,enabled:true,regions:["nl"],timeoutMs:12_000,costWeight:10,platforms:[{platform:"x",priority:900,deliveryModes:["redirect" as const],verificationStatus:"delivery_verified" as const}]};
const receipt=(state:"propagating"|"propagated"|"propagation_failed"="propagating")=>({schemaVersion:"1" as const,commandId:`cmd_${"a".repeat(32)}`,aggregate:"route_policy" as const,targetId:"x/nl",expectedRevision:2,acceptedRevision:3,currentRevision:3,propagatedRevision:state==="propagated"?7:null,state,acceptedAt:"2026-08-12T00:00:00.000Z",completedAt:state==="propagating"?null:"2026-08-12T00:00:01.000Z"});

function service(overrides:Partial<RoutePolicyServiceOptions>={}){
  const reads={getRoutePolicyState:vi.fn(async()=>({headRevision:2,draft:{...ADMIN_ROUTE_POLICY_FIXTURE,orderedProviderIds:["twittersaver"],stagedAllocations:[{providerId:"twittersaver",allocationBps:10000}],concurrencyCaps:[]},published:null,durableRevision:null,projectedRevision:null,propagationState:null}))};
  const writes={saveDraft:vi.fn(async()=>receipt("propagated")),publish:vi.fn(async()=>({receipt:receipt(),projectionRevision:7})),rollback:vi.fn(),discard:vi.fn(),
    loadRuntimeSnapshot:vi.fn(async()=>({schemaVersion:"1",revision:7,generatedAt:"2026-08-12T00:00:00.000Z",policies:[]})),
    finishPropagation:vi.fn(async(input:{success:boolean})=>receipt(input.success?"propagated":"propagation_failed")),applySafetyControl:vi.fn(),acceptProbe:vi.fn(),finishRuntimeCommand:vi.fn()};
  const routeStore={putSnapshot:vi.fn(async()=>true),getSnapshot:vi.fn(async()=>({schemaVersion:"1",revision:7,generatedAt:"2026-08-12T00:00:00.000Z",policies:[]}))};
  const rolloutStore={putSnapshot:vi.fn(async()=>true),getSnapshot:vi.fn(async()=>({schemaVersion:"1",revision:9,generatedAt:"2026-08-12T00:00:00.000Z",rules:[]}))};
  const rolloutRepository={loadSnapshot:vi.fn(async()=>({schemaVersion:"1",revision:9,generatedAt:"2026-08-12T00:00:00.000Z",rules:[]}))};
  const options={deployment:"tikdd",region:"nl",manifests:[manifest],catalogPlatforms:["x"],maximumConcurrencyByProvider:{twittersaver:4},
    commandSecret:"command-secret-with-at-least-32-characters",projectionTtlMs:60_000,reads,writes,routeStore,rolloutStore,rolloutRepository,...overrides} as unknown as RoutePolicyServiceOptions;
  return {instance:new AdminRoutePolicyService(options),writes,routeStore};
}

describe("Admin route-policy commands",()=>{
  it("rejects an unsupported Provider before creating a draft",async()=>{
    const {instance,writes}=service();
    await expect(instance.saveDraft({platform:"x",region:"nl",expectedRevision:2,reason:"Invalid capability test.",confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop",orderedProviderIds:["unknown"],stagedAllocations:[],concurrencyCaps:[]},"owner_tikdd")).rejects.toThrow("Unknown Provider");
    expect(writes.saveDraft).not.toHaveBeenCalled();
  });

  it("reports publication complete only after both runtime projections verify",async()=>{
    const {instance,writes}=service();
    const result=await instance.publish({platform:"x",region:"nl",expectedRevision:2,draftRevision:2,reason:"Publish reviewed route order.",confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop"},"owner_tikdd");
    expect(result.state).toBe("propagated");expect(writes.finishPropagation).toHaveBeenCalledWith(expect.objectContaining({projectionRevision:7,success:true}));
  });

  it("keeps propagation failure explicit when Redis verification is unavailable",async()=>{
    const {instance}=service({routeStore:{putSnapshot:vi.fn(async()=>{throw new Error("redis unavailable");}),getSnapshot:vi.fn()} as never});
    const result=await instance.publish({platform:"x",region:"nl",expectedRevision:2,draftRevision:2,reason:"Publish reviewed route order.",confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop"},"owner_tikdd");
    expect(result.state).toBe("propagation_failed");
  });
  it("keeps resolution-only routes out of production policy while allowing a technical probe",async()=>{
    const resolutionOnly={...manifest,id:"dlpanda",displayName:"DLPanda",platforms:[{platform:"x",priority:700,deliveryModes:[],verificationStatus:"canary_verified" as const}]};
    const probeRunner={run:vi.fn(async()=>true)};
    const {instance,writes}=service({manifests:[manifest,resolutionOnly],probeRunner} as never);
    const view=await instance.getView("x","nl");
    expect(view.baselineProviderIds).toEqual(["twittersaver"]);
    expect(view.technicalProviderIds).toEqual(["dlpanda"]);
    expect(view.excludedProviders).toContainEqual({providerId:"dlpanda",reasons:["resolution_only"]});
    await expect(instance.saveDraft({platform:"x",region:"nl",expectedRevision:2,reason:"Reject a resolution-only production route.",confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop",orderedProviderIds:["dlpanda"],stagedAllocations:[],concurrencyCaps:[]},"owner_tikdd")).rejects.toThrow("resolution-only");
    writes.acceptProbe.mockResolvedValue({receipt:receipt(),rolloutSnapshotRevision:9});
    writes.finishRuntimeCommand.mockResolvedValue(receipt("propagated"));
    await expect(instance.probe({providerId:"dlpanda",platform:"x",region:"nl",expectedRolloutRevision:9,reason:"Run a bounded technical probe.",confirmation:"dlpanda/x/nl",idempotencyKey:"abcdefghijklmnop"},"owner_tikdd")).resolves.toMatchObject({state:"propagated"});
    expect(probeRunner.run).toHaveBeenCalledWith({providerId:"dlpanda",platform:"x",region:"nl"});
  });
});
