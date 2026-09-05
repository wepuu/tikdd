import { describe, expect, it } from "vitest";
import {
  AdminLocaleRevisionSchema,
  AdminContentPublishCommandSchema,
  AdminContentRebuildSnapshotCommandSchema,
  AdminContentInvalidateCacheCommandSchema,
  AdminSettingsRecoveryViewSchema,
  AdminContentManagementViewSchema,
  AdminLocaleDraftCommandSchema,
  AdminPageDraftCommandSchema,
  AdminOverviewSchema,
  AdminOperationalTruthSchema,
  AdminPageRevisionSchema,
  AdminPlatformDraftCommandSchema,
  AdminPlatformManagementViewSchema,
  AdminRoutePolicyRevisionSchema,
  AdminRoutePolicyDraftCommandSchema,
  AdminRouteSummarySchema,
  AdminSeoFieldsSchema,
  PublishedContentSnapshotSchema,
  SafeMarkdownSchema,
  assertAdminSafeValue,
  validateLocaleRegistry,
  validateRoutePolicyEligibility
  ,deriveSeoTechnicalView
} from "../src/index";
import {
  ADMIN_HOMEPAGE_FIXTURE,
  ADMIN_LOCALE_FIXTURES,
  ADMIN_OVERVIEW_FIXTURES,
  ADMIN_PUBLISHED_SNAPSHOT_FIXTURE,
  ADMIN_ROUTE_FIXTURES,
  ADMIN_ROUTE_POLICY_FIXTURE
} from "../src/fixtures";

const manifests = [
  {
    id: "twittersaver",
    displayName: "TwitterSaver",
    kind: "site-adapter" as const,
    enabled: true,
    regions: ["nl"],
    timeoutMs: 12_000,
    costWeight: 10,
    platforms: [{ platform: "x", priority: 900, deliveryModes: ["redirect" as const], verificationStatus: "delivery_verified" as const }]
  },
  {
    id: "ssstwitter",
    displayName: "SSSTwitter",
    kind: "site-adapter" as const,
    enabled: true,
    regions: ["*" as const],
    timeoutMs: 12_000,
    costWeight: 15,
    platforms: [{ platform: "x", priority: 800, deliveryModes: ["redirect" as const], verificationStatus: "delivery_verified" as const }]
  }
];

describe("Admin internal contracts", () => {
  it("validates healthy, empty, stale, partial, high-volume, route, long-label, and publication fixtures", () => {
    for (const fixture of Object.values(ADMIN_OVERVIEW_FIXTURES)) {
      expect(AdminOverviewSchema.parse(fixture)).toEqual(fixture);
      expect(() => assertAdminSafeValue(fixture)).not.toThrow();
    }
    for (const fixture of Object.values(ADMIN_ROUTE_FIXTURES)) {
      expect(AdminRouteSummarySchema.parse(fixture)).toEqual(fixture);
      expect(() => assertAdminSafeValue(fixture)).not.toThrow();
    }
    for (const fixture of ADMIN_LOCALE_FIXTURES) {
      expect(AdminLocaleRevisionSchema.parse(fixture)).toEqual(fixture);
      expect(() => assertAdminSafeValue(fixture)).not.toThrow();
    }
    expect(AdminPageRevisionSchema.parse(ADMIN_HOMEPAGE_FIXTURE)).toEqual(ADMIN_HOMEPAGE_FIXTURE);
    expect(PublishedContentSnapshotSchema.parse(ADMIN_PUBLISHED_SNAPSHOT_FIXTURE)).toEqual(ADMIN_PUBLISHED_SNAPSHOT_FIXTURE);
    expect(() => assertAdminSafeValue(ADMIN_PUBLISHED_SNAPSHOT_FIXTURE)).not.toThrow();
  });

  it("rejects unknown and forbidden fields instead of stripping them", () => {
    expect(() => AdminOverviewSchema.parse({ ...ADMIN_OVERVIEW_FIXTURES.healthy, taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })).toThrow();
    expect(() => AdminPageRevisionSchema.parse({ ...ADMIN_HOMEPAGE_FIXTURE, sourceUrl: "https://x.com/example/status/1" })).toThrow();
    for (const unsafe of [
      { taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      { nested: { canonicalUrl: "https://x.com/example/status/1" } },
      { nested: { safeLooking: "fmt_private" } },
      { headers: { authorization: "secret" } }
    ]) {
      expect(() => assertAdminSafeValue(unsafe)).toThrow();
    }
  });

  it("requires one complete seven-stage operational truth ladder", () => {
    const truth = {
      schemaVersion: "1",
      deployment: "tikdd",
      region: "nl",
      generatedAt: "2026-08-11T12:00:00.000Z",
      degradedSources: [],
      services: (["canary", "evidence", "cleanup"] as const).map((service) => ({ service, state: "missing", freshness: "missing", ready: false, observedAt: null, nextExpectedAt: null, consecutiveFailures: 0 })),
      platforms: [{
        platform: "x", displayName: "X", region: "nl", catalogStatus: "experimental", publicAvailability: "preview",
        contentCoverageBps: 0, currentAvailability: "unavailable", indexEligibility: "ineligible",
        ladder: (["catalog", "resolution", "delivery", "canary", "runtime", "lifecycle", "seo"] as const).map((id) => ({ id, state: id === "catalog" ? "pass" : "block", observedAt: null })),
        reasons: [{ code: "provider_disabled", providerId: "ssstwitter" }], providers: []
      }]
    };
    expect(AdminOperationalTruthSchema.parse(truth)).toEqual(truth);
    expect(() => AdminOperationalTruthSchema.parse({ ...truth, platforms: [{ ...truth.platforms[0], sourceUrl: "https://x.com/a/status/1" }] })).toThrow();
    expect(() => AdminOperationalTruthSchema.parse({ ...truth, platforms: [{ ...truth.platforms[0], ladder: truth.platforms[0]!.ladder.slice(0, 6) }] })).toThrow();
  });

  it("accepts canonical BCP 47 locale tags and rejects invalid registry relationships", () => {
    expect(validateLocaleRegistry(ADMIN_LOCALE_FIXTURES)).toHaveLength(3);
    expect(() => AdminLocaleRevisionSchema.parse({ ...ADMIN_LOCALE_FIXTURES[1], locale: "zh-cn" })).toThrow();
    expect(() => validateLocaleRegistry(ADMIN_LOCALE_FIXTURES.map((locale) => ({ ...locale, isDefault: false })))).toThrow("Exactly one locale");
    expect(() => validateLocaleRegistry([
      ADMIN_LOCALE_FIXTURES[0],
      { ...ADMIN_LOCALE_FIXTURES[1], fallbackLocale: "ar" },
      { ...ADMIN_LOCALE_FIXTURES[2], fallbackLocale: "zh-CN" }
    ])).toThrow("fallback cycle");
  });

  it("rejects unsafe Markdown while allowing draft SEO intent for preflight", () => {
    expect(() => SafeMarkdownSchema.parse("<script>alert(1)</script>")).toThrow();
    expect(() => SafeMarkdownSchema.parse("![remote](https://example.com/image.png)")).toThrow();
    expect(() => SafeMarkdownSchema.parse("[remote](https://example.com/help)")).toThrow();
    expect(() => SafeMarkdownSchema.parse("[unsafe](javascript:alert(1))")).toThrow();
    expect(() => AdminSeoFieldsSchema.parse({ ...ADMIN_HOMEPAGE_FIXTURE.seo, indexable: false, includeInSitemap: true })).toThrow();
    expect(AdminPageRevisionSchema.parse({ ...ADMIN_HOMEPAGE_FIXTURE, state: "draft" }).seo.indexable).toBe(true);
  });

  it("validates route preference only against production-eligible manifest capabilities", () => {
    expect(validateRoutePolicyEligibility(ADMIN_ROUTE_POLICY_FIXTURE, {
      catalogPlatforms: ["x"],
      manifests,
      maximumConcurrencyByProvider: { twittersaver: 8 }
    })).toEqual(ADMIN_ROUTE_POLICY_FIXTURE);

    expect(() => validateRoutePolicyEligibility(
      { ...ADMIN_ROUTE_POLICY_FIXTURE, orderedProviderIds: ["unknown-provider"] },
      { catalogPlatforms: ["x"], manifests }
    )).toThrow("Unknown Provider");
    expect(() => validateRoutePolicyEligibility(
      { ...ADMIN_ROUTE_POLICY_FIXTURE, platform: "youtube" },
      { catalogPlatforms: ["x"], manifests }
    )).toThrow("Unknown platform");
    expect(() => validateRoutePolicyEligibility(ADMIN_ROUTE_POLICY_FIXTURE, {
      catalogPlatforms: ["x"],
      manifests: [{ ...manifests[0]!, enabled: false }, manifests[1]!],
      maximumConcurrencyByProvider: { twittersaver: 8 }
    })).toThrow("not production eligible");
    expect(() => validateRoutePolicyEligibility(ADMIN_ROUTE_POLICY_FIXTURE, {
      catalogPlatforms: ["x"],
      manifests,
      maximumConcurrencyByProvider: { twittersaver: 2 }
    })).toThrow("exceeds");
    expect(() => validateRoutePolicyEligibility(ADMIN_ROUTE_POLICY_FIXTURE, {
      catalogPlatforms: ["x"],
      manifests: [{ ...manifests[0]!, platforms: [{ platform: "x", priority: 900, deliveryModes: [], verificationStatus: "unverified" }] }, manifests[1]!],
      maximumConcurrencyByProvider: { twittersaver: 8 }
    })).toThrow("resolution-only");
  });

  it("rejects duplicate policy entries and published path or redirect collisions", () => {
    expect(() => AdminRoutePolicyRevisionSchema.parse({
      ...ADMIN_ROUTE_POLICY_FIXTURE,
      orderedProviderIds: ["twittersaver", "twittersaver"]
    })).toThrow();
    expect(() => PublishedContentSnapshotSchema.parse({
      ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE,
      pages: [
        ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages,
        { ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0] }
      ]
    })).toThrow();
  });

  it("binds route commands to one exact confirmed scope",()=>{
    const command={platform:"x",region:"nl",expectedRevision:2,reason:"Adjust the reviewed sequential preference.",
      confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop",orderedProviderIds:["twittersaver","ssstwitter"],
      stagedAllocations:[{providerId:"twittersaver",allocationBps:10000}],concurrencyCaps:[]};
    expect(AdminRoutePolicyDraftCommandSchema.parse(command)).toEqual({...command,trafficShares:[]});
    expect(()=>AdminRoutePolicyDraftCommandSchema.parse({...command,confirmation:"x/global"})).toThrow(/confirmation/i);
    expect(()=>AdminRoutePolicyDraftCommandSchema.parse({...command,stagedAllocations:[command.stagedAllocations[0],command.stagedAllocations[0]]})).toThrow(/unique/i);
    expect(()=>validateRoutePolicyEligibility({...ADMIN_ROUTE_POLICY_FIXTURE,stagedAllocations:[{providerId:"unknown-provider",allocationBps:0}]},{catalogPlatforms:["x"],manifests})).toThrow("Unknown Provider");
  });

  it("keeps platform presentation commands bounded to catalog-owned slugs",()=>{
    const command={platform:"x",region:"nl",expectedRevision:null,reason:"Prepare the reviewed platform presentation.",
      confirmation:"x/nl",idempotencyKey:"abcdefghijklmnop",publicDisplayName:"X",supportLabel:"Preview",
      publicAvailability:"preview" as const,pageId:null};
    expect(AdminPlatformDraftCommandSchema.parse(command)).toEqual(command);
    expect(()=>AdminPlatformDraftCommandSchema.parse({...command,confirmation:"youtube/nl"})).toThrow(/confirmation/i);
    expect(()=>AdminPlatformDraftCommandSchema.parse({...command,recognizedHosts:["evil.example"]})).toThrow();
    expect(()=>AdminPlatformManagementViewSchema.parse({schemaVersion:"1",platform:"x",region:"nl",headRevision:null,
      catalog:{displayName:"X",status:"experimental",source:"yt-dlp",recognizedHosts:[{hostname:"x.com",allowSubdomains:true}],extractorKeys:["twitter"]},
      adapterCapabilities:[],readiness:{monitoredEligibleRouteCount:0,healthyRouteCount:0,publishedLocaleCount:0,publishedPageLocaleCount:0,seoReady:false,indexableEligible:false,blockers:["catalog_not_stable"]},
      baseline:{publicDisplayName:"X",supportLabel:"Preview",publicAvailability:"preview",pageId:null},published:null,draft:null,
      effective:{publicDisplayName:"X",supportLabel:"Preview",publicAvailability:"preview",pageId:null},hostRuleEditor:true})).toThrow();
  });

  it("keeps locale registration open while binding drafts to exact structured templates",()=>{
    const locale={locale:"ar",displayName:"العربية",direction:"rtl" as const,fallbackLocale:"en",enabled:true,isDefault:false,state:"draft" as const,expectedRevision:null,reason:"Prepare a reviewed Arabic locale.",confirmation:"ar",idempotencyKey:"abcdefghijklmnop"};
    expect(AdminLocaleDraftCommandSchema.parse(locale).locale).toBe("ar");
    expect(()=>AdminLocaleDraftCommandSchema.parse({...locale,locale:"ar-eg"})).toThrow(/BCP 47/i);
    const page={pageId:"page_home",locale:"ar",pageType:"homepage" as const,platform:null,state:"draft" as const,expectedRevision:null,reason:"Draft the localized homepage.",confirmation:"page_home/ar",idempotencyKey:"abcdefghijklmnop",content:ADMIN_HOMEPAGE_FIXTURE.content,seo:{...ADMIN_HOMEPAGE_FIXTURE.seo,indexable:false,includeInSitemap:false}};
    expect(AdminPageDraftCommandSchema.parse(page).content.template).toBe("homepage");
    expect(()=>AdminPageDraftCommandSchema.parse({...page,content:{template:"guide",title:"Wrong",introduction:"Wrong template",sections:[{id:"x",heading:"X",bodyMarkdown:"Safe text"}]}})).toThrow(/template/i);
    expect(()=>AdminContentManagementViewSchema.parse({schemaVersion:"1",generatedAt:"2026-08-12T00:00:00.000Z",locales:[],definitions:[],pages:[],sharedContent:[],coverage:[],readiness:{enabledLocaleCount:0,requiredPageCount:0,readyCellCount:0,missingCellCount:0,fallbackCellCount:0}})).toThrow();
  });

  it("requires exact deployment confirmation for publication commands",()=>{
    const command={deployment:"tikdd",expectedRevision:null,reason:"Publish the complete reviewed snapshot.",confirmation:"tikdd",idempotencyKey:"abcdefghijklmnop"};
    expect(AdminContentPublishCommandSchema.parse(command)).toEqual(command);
    expect(()=>AdminContentPublishCommandSchema.parse({...command,confirmation:"production"})).toThrow(/confirmation/i);
  });

  it("keeps recovery scoped to one known snapshot and renders secret presence only",()=>{
    const base={deployment:"tikdd",expectedRevision:4,reason:"Recover the reviewed active snapshot.",confirmation:"tikdd",idempotencyKey:"abcdefghijklmnop"};
    expect(AdminContentRebuildSnapshotCommandSchema.parse({...base,sourceSnapshotId:`snap_${"a".repeat(32)}`})).toMatchObject({expectedRevision:4});
    expect(AdminContentInvalidateCacheCommandSchema.parse({...base,snapshotId:`snap_${"b".repeat(32)}`})).toMatchObject({expectedRevision:4});
    expect(()=>AdminContentInvalidateCacheCommandSchema.parse({...base,snapshotId:"all"})).toThrow();
    const view=AdminSettingsRecoveryViewSchema.parse({schemaVersion:"1",generatedAt:"2026-08-13T00:00:00.000Z",siteIdentity:[],locales:[{locale:"en",revision:1,displayName:"English",direction:"ltr",fallbackLocale:null,enabled:true,isDefault:true,state:"published"}],publicationDefaults:{defaultLocale:"en",fallbackMaySatisfyPublication:false,requiredPagePolicy:"complete_code_owned_set"},infrastructure:{deployment:"tikdd",region:"nl",ownerAccess:{mode:"password",state:"configured"},edge:{cloudflare:"configured",nginx:"configured"},state:"ready",dependencies:[],scheduler:{state:"healthy",observedAt:null},snapshot:{state:"ready",activeSnapshotId:`snap_${"a".repeat(32)}`,activeRevision:4,latestRevision:4,propagationState:"propagated",affectedPathCount:2}},secretPresence:[{id:"origin_proof",state:"configured"},{id:"csrf_signing",state:"configured"},{id:"command_signing",state:"configured"},{id:"web_revalidation",state:"configured"}],recovery:{retryPublication:{available:false,snapshotId:null},rebuildSnapshot:{available:true,sourceSnapshotId:`snap_${"a".repeat(32)}`},invalidateContentCache:{available:true,snapshotId:`snap_${"a".repeat(32)}`,affectedPathCount:2},rollbackCandidates:[]}});
    expect(view.secretPresence.every(item=>Object.keys(item).sort().join(",")==="id,state")).toBe(true);
    expect(()=>assertAdminSafeValue({secretValue:"hidden"})).toThrow(/Forbidden Admin field/);
  });

  it("derives canonical, hreflang, sitemap, and code-owned structured data from one snapshot",()=>{
    const snapshot={...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE,pages:[ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0]!,{...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0]!,locale:"zh-CN",seo:{...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0]!.seo,localPath:"/",redirectFrom:[]}}]};
    const view=deriveSeoTechnicalView({snapshot,eligiblePlatforms:[],generatedAt:"2026-08-12T00:00:00.000Z"});
    expect(view.passports[0]).toMatchObject({canonicalPath:"/en",sitemapEligible:true,structuredDataTemplate:"WebSite"});
    expect(view.passports[0]?.hreflang.map(item=>item.locale)).toEqual(["en","zh-CN"]);
    expect(view.sitemapPaths).toEqual(["/en","/zh-CN"]);
  });

  it("blocks private paths, collisions, unsafe redirect graphs, and unreviewed slug changes",()=>{
    const page=ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0]!;const prior={...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE,pages:[page]};
    const snapshot={...prior,revision:2,pages:[{...page,seo:{...page.seo,localPath:"/tasks/private",redirectFrom:["/legacy"]}},{...page,pageId:"page_faq",pageType:"faq" as const,content:{template:"faq" as const,title:"Frequently asked questions",introduction:"Answers for public TikDD media resolution workflows.",items:[{question:"How?",answerMarkdown:"Use a public page link."}]},seo:{...page.seo,localPath:"/tasks/private",redirectFrom:["/legacy"]}}]};
    const view=deriveSeoTechnicalView({snapshot,activeSnapshot:prior,eligiblePlatforms:[],generatedAt:"2026-08-12T00:00:00.000Z"});
    expect(view.blockerCount).toBeGreaterThan(0);expect(view.passports.flatMap(item=>item.blockers)).toEqual(expect.arrayContaining(["reserved_private_path","path_collision","redirect_collision","slug_migration_missing"]));
  });
});
