import { describe,expect,it,vi } from "vitest";
import { AdminPlatformManagementService, type PlatformManagementServiceOptions } from "../src/platform-management-service";

const now="2026-08-12T12:00:00.000Z";
const platform={id:"x",displayName:"X",status:"experimental" as const,source:"yt-dlp" as const,
  hosts:[{hostname:"x.com",allowSubdomains:true}],extractorKeys:["twitter"]};
const manifest={id:"twittersaver",displayName:"TwitterSaver",kind:"site-adapter" as const,enabled:true,regions:["nl"],timeoutMs:12_000,costWeight:10,platforms:[{platform:"x",priority:900,deliveryModes:["redirect" as const]}]};
const receipt={schemaVersion:"1" as const,commandId:`cmd_${"a".repeat(32)}`,aggregate:"platform_presentation" as const,targetId:"x/nl",expectedRevision:null,acceptedRevision:1,currentRevision:1,propagatedRevision:1,state:"propagated" as const,acceptedAt:now,completedAt:now};
const draft={schemaVersion:"1" as const,platform:"x",region:"nl",revision:1,revisionKind:"draft" as const,previousRevision:null,
  publicDisplayName:"X",supportLabel:"Preview",publicAvailability:"preview" as const,pageId:null,reason:"Prepare preview.",actorSubject:"owner_tikdd",createdAt:now};

function setup(overrides:Partial<PlatformManagementServiceOptions>={}){
  const reads={listRoutes:vi.fn(async()=>({schemaVersion:"1" as const,generatedAt:now,degradedSources:[],routes:[]})),
    listLocales:vi.fn(async()=>({schemaVersion:"1" as const,generatedAt:now,channel:"published" as const,locales:[]})),
    listPages:vi.fn(async(channel:"draft"|"published")=>({schemaVersion:"1" as const,generatedAt:now,channel,pages:[]}))};
  const writes={getState:vi.fn(async()=>({headRevision:1,draft,published:null})),getRevision:vi.fn(),saveDraft:vi.fn(async()=>receipt),publish:vi.fn(async()=>receipt),discard:vi.fn(async()=>receipt),rollback:vi.fn(async()=>receipt)};
  const options={region:"nl",commandSecret:"command-secret-with-at-least-32-characters",platforms:[platform],manifests:[manifest],reads,writes,now:()=>new Date(now),...overrides} as unknown as PlatformManagementServiceOptions;
  return {instance:new AdminPlatformManagementService(options),reads,writes};
}

describe("Admin platform management",()=>{
  it("projects code-owned hosts and extractor keys as read-only readiness facts",async()=>{
    const {instance}=setup();const view=await instance.getView("x","nl");
    expect(view.catalog).toMatchObject({status:"experimental",recognizedHosts:[{hostname:"x.com"}],extractorKeys:["twitter"]});
    expect(view.readiness.blockers).toContain("catalog_not_stable");
    expect(view.readiness.indexableEligible).toBe(false);
  });
  it("saves a preview draft but rejects arbitrary page associations",async()=>{
    const {instance,writes}=setup();
    const base={platform:"x",region:"nl",expectedRevision:1,reason:"Prepare reviewed preview presentation.",confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop",publicDisplayName:"X",supportLabel:"Preview",publicAvailability:"preview" as const};
    await expect(instance.saveDraft({...base,pageId:null},"owner_tikdd")).resolves.toMatchObject({state:"propagated"});
    await expect(instance.saveDraft({...base,idempotencyKey:"abcdefghijklmnopq",pageId:"page_unknown"},"owner_tikdd")).rejects.toThrow(/page association/i);
    expect(writes.saveDraft).toHaveBeenCalledTimes(1);
  });
  it("revalidates readiness and blocks an experimental platform from public listing",async()=>{
    const listed={...draft,publicAvailability:"listed" as const};const {instance,writes}=setup();writes.getState.mockResolvedValue({headRevision:1,draft:listed,published:null});
    await expect(instance.publish({platform:"x",region:"nl",expectedRevision:1,draftRevision:1,reason:"Attempt public listing.",confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop"},"owner_tikdd")).rejects.toThrow(/not ready/i);
    expect(writes.publish).not.toHaveBeenCalled();
  });
});
