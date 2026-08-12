import type Redis from "ioredis";
import { describe,expect,it } from "vitest";
import { RedisRoutePolicyStore,RuntimeRoutePolicySource,RoutePolicySnapshotSchema } from "../src/index";

const snapshot=(revision:number,generatedAt="2026-08-12T00:00:00.000Z")=>RoutePolicySnapshotSchema.parse({schemaVersion:"1",revision,generatedAt,
  policies:[{platform:"x",region:"nl",policyRevision:2,orderedProviderIds:["ssstwitter","twittersaver"],concurrencyCaps:[{providerId:"ssstwitter",limit:2}]}]});

describe("route-policy runtime projection",()=>{
  it("publishes monotonically and does not let an older compiler replace a newer snapshot",async()=>{
    let value:string|null=null;const redis={async get(){return value;},async eval(_script:string,_keys:number,_key:string,revision:string,payload:string){const current=value?JSON.parse(value).revision:-1;if(current>Number(revision))return 0;value=payload;return 1;}} as unknown as Redis;
    const store=new RedisRoutePolicyStore(redis);
    expect(await store.putSnapshot(snapshot(3),60_000)).toBe(true);
    expect(await store.putSnapshot(snapshot(2),60_000)).toBe(false);
    expect((await store.getSnapshot())?.revision).toBe(3);
  });

  it("uses a fresh durable fallback and fails preference-open when every projection is stale",async()=>{
    const empty={async get(){return null;}} as unknown as Redis;
    const fresh=new RuntimeRoutePolicySource(new RedisRoutePolicyStore(empty),async()=>snapshot(4),60_000,()=>new Date("2026-08-12T00:00:20.000Z"));
    await expect(fresh.get("x","nl")).resolves.toMatchObject({orderedProviderIds:["ssstwitter","twittersaver"]});
    const stale=new RuntimeRoutePolicySource(new RedisRoutePolicyStore(empty),async()=>snapshot(4,"2026-08-11T00:00:00.000Z"),60_000,()=>new Date("2026-08-12T00:00:20.000Z"));
    await expect(stale.get("x","nl")).resolves.toBeNull();
  });
});
