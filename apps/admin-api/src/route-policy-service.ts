import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  AdminMutationReceiptSchema,
  AdminRoutePolicyDraftCommandSchema,
  AdminRoutePolicyPublishCommandSchema,
  AdminRoutePolicyDiscardCommandSchema,
  AdminRoutePolicyRollbackCommandSchema,
  AdminRoutePolicyViewSchema,
  AdminRouteSafetyCommandSchema,
  AdminRouteProbeCommandSchema,
  validateRoutePolicyEligibility,
  type AdminMutationReceipt,
  type AdminRoutePolicyView
} from "@tikdd/admin-contracts";
import type { ProviderManifest } from "@tikdd/contracts";
import {
  AdminControlPlaneReadRepository,
  AdminRoutePolicyRepository,
  type RolloutRuleRepository
} from "@tikdd/persistence";
import { RedisRoutePolicyStore } from "@tikdd/route-policy";
import { RedisRolloutStore } from "@tikdd/rollout-control";

export interface RoutePolicyServiceOptions {
  deployment: string;
  region: string;
  manifests: readonly ProviderManifest[];
  catalogPlatforms: readonly string[];
  maximumConcurrencyByProvider: Readonly<Record<string, number>>;
  maximumConcurrencyForRoute?: (providerId:string,platform:string,region:string)=>number|undefined;
  commandSecret: string;
  projectionTtlMs: number;
  reads: AdminControlPlaneReadRepository;
  writes: AdminRoutePolicyRepository;
  routeStore: RedisRoutePolicyStore;
  rolloutStore: RedisRolloutStore;
  rolloutRepository: RolloutRuleRepository;
  probeRunner?: { run(input:{providerId:string;platform:string;region:string}):Promise<boolean> };
  now?: () => Date;
}

export class AdminRoutePolicyService {
  private readonly now: () => Date;
  constructor(private readonly options: RoutePolicyServiceOptions) {
    if (options.commandSecret.length < 32) throw new Error("Admin command secret is invalid.");
    if (!Number.isInteger(options.projectionTtlMs) || options.projectionTtlMs < 5_000 || options.projectionTtlMs > 300_000) {
      throw new Error("Route-policy projection TTL is invalid.");
    }
    this.now = options.now ?? (() => new Date());
  }

  private baseline(platform: string): string[] {
    return this.options.manifests
      .filter((manifest) => manifest.enabled && manifest.kind !== "mock" &&
        (manifest.regions.includes("*") || manifest.regions.includes(this.options.region)) &&
        manifest.platforms.some((capability) => capability.platform === platform && capability.deliveryModes.length > 0))
      .sort((left,right) =>
        (right.platforms.find(({platform: id})=>id===platform)?.priority ?? 0)-
        (left.platforms.find(({platform: id})=>id===platform)?.priority ?? 0) || left.id.localeCompare(right.id))
      .map(({id})=>id);
  }

  async getView(platform: string, region: string): Promise<AdminRoutePolicyView> {
    if(region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    const state=await this.options.reads.getRoutePolicyState(platform,region,this.options.deployment);
    const baseline=this.baseline(platform);
    const preference=state.draft?.orderedProviderIds ?? state.published?.orderedProviderIds ?? [];
    const effective=[...preference,...baseline.filter((id)=>!preference.includes(id))];
    const declared=this.options.manifests.filter((manifest)=>manifest.platforms.some((capability)=>capability.platform===platform));
    const technicalProviderIds=declared.filter((manifest)=>manifest.enabled&&manifest.kind!=="mock"&&
      (manifest.regions.includes("*")||manifest.regions.includes(region))&&
      manifest.platforms.find((capability)=>capability.platform===platform)?.deliveryModes.length===0).map(({id})=>id);
    const excludedProviders=declared.flatMap((manifest)=>{
      const reasons:Array<"disabled"|"mock"|"region_mismatch"|"resolution_only">=[];
      if(!manifest.enabled)reasons.push("disabled");
      if(manifest.kind==="mock")reasons.push("mock");
      if(!manifest.regions.includes("*")&&!manifest.regions.includes(region))reasons.push("region_mismatch");
      if(manifest.platforms.find((capability)=>capability.platform===platform)?.deliveryModes.length===0)reasons.push("resolution_only");
      return reasons.length>0?[{providerId:manifest.id,reasons}]:[];
    });
    return AdminRoutePolicyViewSchema.parse({schemaVersion:"1",platform,region,headRevision:state.headRevision,
      baselineProviderIds:baseline,effectiveProviderIds:effective,technicalProviderIds,excludedProviders,published:state.published,draft:state.draft,
      propagation:{state:state.propagationState ?? "propagated",durableRevision:state.durableRevision,projectedRevision:state.projectedRevision}});
  }

  private identity(idempotencyKey:string, command:unknown, actorSubject:string){
    const commandJson=JSON.stringify(command);const acceptedAt=this.now();
    return {commandId:`cmd_${randomBytes(16).toString("hex")}`,
      idempotencyDigest:createHmac("sha256",this.options.commandSecret).update(`idem\0${idempotencyKey}`).digest(),
      commandDigest:createHash("sha256").update(commandJson).digest(),actorSubject,
      expiresAt:new Date(acceptedAt.getTime()+24*60*60_000)};
  }

  private validatePolicy(input:{platform:string;region:string;orderedProviderIds:string[];stagedAllocations:Array<{providerId:string;allocationBps:number}>;trafficShares:Array<{providerId:string;shareBps:number}>;concurrencyCaps:Array<{providerId:string;limit:number}>}){
    if(input.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    return validateRoutePolicyEligibility({schemaVersion:"1",policyId:`rtp_${input.platform}_${input.region}`,
      platform:input.platform,region:input.region,revision:1,revisionKind:"draft",previousRevision:null,
      orderedProviderIds:input.orderedProviderIds,
      rolloutRuleIds:input.stagedAllocations.map(({providerId})=>`admin-${providerId}-${input.platform}-${input.region}`),
      stagedAllocations:input.stagedAllocations,trafficShares:input.trafficShares??[],concurrencyCaps:input.concurrencyCaps,
      reason:"Validate an Admin route policy command.",actorSubject:"validation_actor",createdAt:this.now().toISOString()},
      {catalogPlatforms:this.options.catalogPlatforms,manifests:this.options.manifests,
        maximumConcurrencyByProvider:this.options.maximumConcurrencyByProvider,
        ...(this.options.maximumConcurrencyForRoute?{maximumConcurrencyForRoute:this.options.maximumConcurrencyForRoute}:{})});
  }

  private validateDeclaredCapability(input:{providerId:string;platform:string;region:string;requireEnabled:boolean}){
    if(input.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    if(!this.options.catalogPlatforms.includes(input.platform))throw new Error(`Unknown platform catalog slug: ${input.platform}`);
    const manifest=this.options.manifests.find(({id})=>id===input.providerId);
    if(!manifest)throw new Error(`Unknown Provider: ${input.providerId}`);
    if(!manifest.platforms.some(({platform})=>platform===input.platform))throw new Error(`Provider does not declare platform ${input.platform}: ${input.providerId}`);
    if(!manifest.regions.includes("*")&&!manifest.regions.includes(input.region))throw new Error(`Provider is not eligible in region ${input.region}: ${input.providerId}`);
    if(input.requireEnabled&&(!manifest.enabled||manifest.kind==="mock"))throw new Error(`Provider is not enabled for a technical probe: ${input.providerId}`);
  }

  async saveDraft(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminRoutePolicyDraftCommandSchema.parse(raw);this.validatePolicy(command);
    return AdminMutationReceiptSchema.parse(await this.options.writes.saveDraft(command,this.identity(command.idempotencyKey,command,actorSubject)));
  }

  async publish(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminRoutePolicyPublishCommandSchema.parse(raw);
    if(command.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    const state=await this.options.reads.getRoutePolicyState(command.platform,command.region,this.options.deployment);
    if(!state.draft||state.draft.revision!==command.draftRevision) throw new Error("The named route-policy draft is unavailable.");
    validateRoutePolicyEligibility(state.draft,{catalogPlatforms:this.options.catalogPlatforms,manifests:this.options.manifests,
      maximumConcurrencyByProvider:this.options.maximumConcurrencyByProvider,
      ...(this.options.maximumConcurrencyForRoute?{maximumConcurrencyForRoute:this.options.maximumConcurrencyForRoute}:{})});
    const accepted=await this.options.writes.publish(command,this.identity(command.idempotencyKey,command,actorSubject));
    if(accepted.receipt.state!=="propagating")return accepted.receipt;
    let success=false;
    try{
      const [routeSnapshot,rolloutSnapshot]=await Promise.all([
        this.options.writes.loadRuntimeSnapshot(this.options.deployment,command.region),
        this.options.rolloutRepository.loadSnapshot()
      ]);
      const [routeWritten,rolloutWritten]=await Promise.all([
        this.options.routeStore.putSnapshot(routeSnapshot,this.options.projectionTtlMs),
        this.options.rolloutStore.putSnapshot(rolloutSnapshot,this.options.projectionTtlMs)
      ]);
      const projected=await this.options.routeStore.getSnapshot();
      success=routeWritten&&rolloutWritten&&projected?.revision===accepted.projectionRevision;
    }catch{success=false;}
    return this.options.writes.finishPropagation({deployment:this.options.deployment,region:command.region,
      commandId:accepted.receipt.commandId,projectionRevision:accepted.projectionRevision,success});
  }

  async discard(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminRoutePolicyDiscardCommandSchema.parse(raw);
    if(command.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    return this.options.writes.discard(command,this.identity(command.idempotencyKey,command,actorSubject));
  }

  async rollback(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminRoutePolicyRollbackCommandSchema.parse(raw);
    if(command.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    const target=await this.options.reads.getRoutePolicyRevision(command.platform,command.region,command.targetRevision);
    if(!target||target.revisionKind==="draft")throw new Error("The rollback target is unavailable.");
    validateRoutePolicyEligibility(target,{catalogPlatforms:this.options.catalogPlatforms,manifests:this.options.manifests,
      maximumConcurrencyByProvider:this.options.maximumConcurrencyByProvider,
      ...(this.options.maximumConcurrencyForRoute?{maximumConcurrencyForRoute:this.options.maximumConcurrencyForRoute}:{})});
    const accepted=await this.options.writes.rollback(command,this.identity(command.idempotencyKey,command,actorSubject));
    if(accepted.receipt.state!=="propagating")return accepted.receipt;
    let success=false;try{
      const [routeSnapshot,rolloutSnapshot]=await Promise.all([this.options.writes.loadRuntimeSnapshot(this.options.deployment,command.region),this.options.rolloutRepository.loadSnapshot()]);
      const [routeWritten,rolloutWritten]=await Promise.all([this.options.routeStore.putSnapshot(routeSnapshot,this.options.projectionTtlMs),this.options.rolloutStore.putSnapshot(rolloutSnapshot,this.options.projectionTtlMs)]);
      success=routeWritten&&rolloutWritten&&(await this.options.routeStore.getSnapshot())?.revision===accepted.projectionRevision;
    }catch{success=false;}
    return this.options.writes.finishPropagation({deployment:this.options.deployment,region:command.region,commandId:accepted.receipt.commandId,projectionRevision:accepted.projectionRevision,success});
  }

  async safety(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminRouteSafetyCommandSchema.parse(raw);if(command.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    this.validateDeclaredCapability({providerId:command.providerId,platform:command.platform,region:command.region,requireEnabled:false});
    const accepted=await this.options.writes.applySafetyControl(command,this.identity(command.idempotencyKey,command,actorSubject));
    if(accepted.receipt.state!=="propagating")return accepted.receipt;
    let success=false;try{const snapshot=await this.options.rolloutRepository.loadSnapshot();const written=await this.options.rolloutStore.putSnapshot(snapshot,this.options.projectionTtlMs);success=written&&(await this.options.rolloutStore.getSnapshot())?.revision===accepted.rolloutSnapshotRevision;}catch{success=false;}
    return this.options.writes.finishRuntimeCommand(accepted.receipt.commandId,accepted.rolloutSnapshotRevision,success);
  }

  async probe(raw:unknown,actorSubject:string):Promise<AdminMutationReceipt>{
    const command=AdminRouteProbeCommandSchema.parse(raw);if(command.region!==this.options.region)throw new Error("The route-policy region is outside this Admin instance.");
    this.validateDeclaredCapability({providerId:command.providerId,platform:command.platform,region:command.region,requireEnabled:true});
    const accepted=await this.options.writes.acceptProbe(command,this.identity(command.idempotencyKey,command,actorSubject));
    if(accepted.receipt.state!=="propagating")return accepted.receipt;
    let success=false;try{success=await this.options.probeRunner?.run({providerId:command.providerId,platform:command.platform,region:command.region})??false;}catch{success=false;}
    return this.options.writes.finishRuntimeCommand(accepted.receipt.commandId,accepted.rolloutSnapshotRevision,success);
  }
}
