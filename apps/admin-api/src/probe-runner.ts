import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { OperationalDiagnosticsRepository } from "@tikdd/persistence";
import { detectPlatform } from "@tikdd/platform";
import { ProviderCanaryConfigSchema,selectProviderCanaries,type ResolverProvider } from "@tikdd/providers";
import type Redis from "ioredis";

const releaseScript=`if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) end return 0`;

export class AdminBoundedProbeRunner {
  constructor(private readonly options:{redis:Redis;providers:readonly ResolverProvider[];operations:OperationalDiagnosticsRepository;
    region:string;authorized:boolean;timeoutMs?:number;leaseTtlMs?:number;now?:()=>Date}){}

  async run(input:{providerId:string;platform:string;region:string}):Promise<boolean>{
    if(!this.options.authorized||input.region!==this.options.region)return false;
    const provider=this.options.providers.find(({manifest})=>manifest.id===input.providerId&&manifest.enabled&&manifest.platforms.some(({platform})=>platform===input.platform));
    if(!provider)return false;
    const config=ProviderCanaryConfigSchema.parse(JSON.parse(await readFile(new URL("../../../config/provider-canaries.json",import.meta.url),"utf8")));
    const definition=selectProviderCanaries(config,{provider:input.providerId}).find(({platform})=>platform===input.platform);
    if(!definition)return false;
    const detected=detectPlatform(definition.url);if(detected.platform!==input.platform)return false;
    const timeoutMs=this.options.timeoutMs??25_000;const leaseTtlMs=this.options.leaseTtlMs??30_000;
    const leaseKey=`tikdd:admin-probe:v1:${input.providerId}:${input.platform}:${input.region}`;const owner=randomUUID();
    if(await this.options.redis.set(leaseKey,owner,"PX",leaseTtlMs,"NX")!=="OK")return false;
    const now=this.options.now??(()=>new Date());const started=now();let status:"succeeded"|"failed"="failed";let failureCode:"internal_error"|null="internal_error";let formatCount:number|null=null;let linkLifetimeMs:number|null=null;
    try{const resolution=await provider.resolve({taskId:`tsk_${randomUUID().replaceAll("-","")}`,sourceUrl:definition.url,canonicalUrl:detected.canonicalUrl,platform:detected.platform,signal:AbortSignal.timeout(timeoutMs)});
      status="succeeded";failureCode=null;formatCount=resolution.result.formats.length;const lifetimes=resolution.candidates.map(({expiresAt})=>Math.max(0,new Date(expiresAt).getTime()-now().getTime()));linkLifetimeMs=lifetimes.length?Math.min(...lifetimes):null;
    }catch{status="failed";failureCode="internal_error";}
    finally{await this.options.redis.eval(releaseScript,1,leaseKey,owner).catch(()=>undefined);}
    const recordedAt=now();await this.options.operations.recordCanaryMeasurement({runId:randomUUID(),canaryId:definition.id,providerId:provider.manifest.id,
      platform:detected.platform,region:input.region,status,failureCode,durationMs:Math.max(0,recordedAt.getTime()-started.getTime()),formatCount,linkLifetimeMs,attemptCount:1,recordedAt,expiresAt:new Date(recordedAt.getTime()+35*86_400_000)});
    return status==="succeeded";
  }
}
