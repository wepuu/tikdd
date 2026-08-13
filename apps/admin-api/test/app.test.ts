import {
  ADMIN_HOMEPAGE_FIXTURE,
  ADMIN_LOCALE_FIXTURES,
  ADMIN_OVERVIEW_FIXTURES,
  ADMIN_ROUTE_FIXTURES
} from "@tikdd/admin-contracts/fixtures";
import { AdminAuthenticationError, DevelopmentAdminIdentityVerifier } from "../src/auth";
import { AdminCsrfProtector } from "../src/csrf";
import { buildAdminApi, type AdminReadApi } from "../src/app";
import type { AdminApiConfiguration } from "../src/config";
import { describe, expect, it } from "vitest";

const development: AdminApiConfiguration = {
  port: 4100,
  host: "127.0.0.1",
  deployment: "local",
  region: "nl",
  adminOrigin: "http://localhost:3001",
  expectedHost: "localhost:3001",
  readTimeoutMs: 2_000,
  freshnessMs: 300_000,
  csrfSecret: "development-only-admin-csrf-secret",
  commandSecret: "development-only-command-secret-value",
  routePolicyProjectionTtlMs: 60_000,
  guardRequired: false,
  guardMaximumStaleMs: 15_000,
  buildId: "test-development",
  startedAt: "2026-08-11T12:00:00.000Z",
  webContent: { origin: null, revalidationSecret: null, timeoutMs: 4_000 },
  edge: { cloudflareConfigured: false, nginxConfigured: false },
  auth: { mode: "password", originProof: null }
};

const production: AdminApiConfiguration = {
  ...development,
  deployment: "tikdd",
  adminOrigin: "https://admin.tikdd.example",
  expectedHost: "admin.tikdd.example",
  csrfSecret: "csrf-secret-with-at-least-32-characters",
  auth: { mode: "password", originProof: "origin-proof-with-at-least-32-characters" }
};

function reads(): AdminReadApi {
  return {
    async getOverview() { return ADMIN_OVERVIEW_FIXTURES.partial; },
    async listRoutes() {
      return { schemaVersion: "1", generatedAt: "2026-08-11T12:00:00.000Z", degradedSources: [], routes: Object.values(ADMIN_ROUTE_FIXTURES) };
    },
    async getRouteDetail(providerId, platform, region) {
      const summary = Object.values(ADMIN_ROUTE_FIXTURES).find((route) =>
        route.tuple.providerId === providerId && route.tuple.platform === platform && route.tuple.region === region);
      return summary ? {
        schemaVersion: "1",
        summary,
        windowStartedAt: "2026-08-10T12:00:00.000Z",
        windowEndedAt: "2026-08-11T12:00:00.000Z",
        series: [],
        failures: [],
        canary: { state: "not_configured", observedAt: null }
      } : null;
    },
    async listProviders() { return { schemaVersion: "1", generatedAt: "2026-08-11T12:00:00.000Z", providers: [] }; },
    async listPlatforms() { return { schemaVersion: "1", generatedAt: "2026-08-11T12:00:00.000Z", degradedSources: [], platforms: [] }; },
    async getRuntime() {
      return {
        schemaVersion: "1",
        deployment: "local",
        region: "nl",
        authMode: "password",
        generatedAt: "2026-08-11T12:00:00.000Z",
        state: "degraded",
        dependencies: [{ id: "content_snapshot", state: "stale", observedAt: null }],
        scheduler: { state: "stale", observedAt: null },
        activeSnapshotRevision: null
      };
    },
    async listLocales(channel) { return { schemaVersion: "1", generatedAt: "2026-08-11T12:00:00.000Z", channel, locales: [...ADMIN_LOCALE_FIXTURES] }; },
    async listPages(channel, locale) {
      return {
        schemaVersion: "1",
        generatedAt: "2026-08-11T12:00:00.000Z",
        channel,
        pages: locale === undefined || locale === ADMIN_HOMEPAGE_FIXTURE.locale ? [ADMIN_HOMEPAGE_FIXTURE] : []
      };
    },
    async getSeoOverview(channel) {
      return {
        schemaVersion: "1",
        generatedAt: "2026-08-11T12:00:00.000Z",
        channel,
        indexablePageCount: 1,
        sitemapPageCount: 1,
        blockerCount: 0,
        pages: [{
          pageId: "page_home",
          locale: "en",
          pageType: "homepage",
          state: "published",
          localPath: "/",
          indexable: true,
          includeInSitemap: true,
          blockerCount: 0
        }]
      };
    }
  };
}

describe("Admin API browser boundary", () => {
  it("requires a subject-bound CSRF token and preserves mutation receipts", async () => {
    const csrfProtector=new AdminCsrfProtector(development.csrfSecret);
    const receipt={schemaVersion:"1" as const,commandId:`cmd_${"a".repeat(32)}`,aggregate:"route_policy" as const,
      targetId:"x/nl",expectedRevision:null,acceptedRevision:1,currentRevision:1,propagatedRevision:null,
      state:"propagated" as const,acceptedAt:"2026-08-11T12:00:00.000Z",completedAt:"2026-08-11T12:00:00.000Z"};
    const routePolicies={async getView(){return {schemaVersion:"1" as const,platform:"x",region:"nl",headRevision:null,
      baselineProviderIds:["twittersaver"],effectiveProviderIds:["twittersaver"],technicalProviderIds:[],excludedProviders:[],published:null,draft:null,
      propagation:{state:"propagated" as const,durableRevision:null,projectedRevision:null}};},
      async saveDraft(){return receipt;},async publish(){return receipt;},async discard(){return receipt;},async rollback(){return receipt;}};
    const app=buildAdminApi({configuration:development,identityVerifier:new DevelopmentAdminIdentityVerifier("development_owner"),reads:reads(),routePolicies,csrfProtector});
    const body={platform:"x",region:"nl",expectedRevision:null,reason:"Prefer the reviewed route.",confirmation:"x/nl",
      idempotencyKey:"abcdefghijklmnop",orderedProviderIds:["twittersaver"],stagedAllocations:[{providerId:"twittersaver",allocationBps:10000}],concurrencyCaps:[]};
    try{
      const base={host:"localhost:3001",origin:"http://localhost:3001","content-type":"application/json","sec-fetch-site":"same-origin"};
      expect((await app.inject({method:"POST",url:"/admin/v1/route-policies/draft",headers:base,payload:body})).statusCode).toBe(403);
      const csrf=csrfProtector.issue("development_owner",development.adminOrigin);
      const response=await app.inject({method:"POST",url:"/admin/v1/route-policies/draft",headers:{...base,"x-tikdd-csrf":csrf},payload:body});
      expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({commandId:receipt.commandId,state:"propagated"});
    }finally{await app.close();}
  });
  it("serves authenticated development reads with private security headers", async () => {
    const app = buildAdminApi({
      configuration: development,
      identityVerifier: new DevelopmentAdminIdentityVerifier("development_owner"),
      reads: reads()
    });
    try {
      const response = await app.inject({ method: "GET", url: "/admin/v1/overview", headers: { host: "localhost:3001" } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ state: "warning", deployment: "tikdd" });
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
      expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
      expect(response.headers["x-frame-options"]).toBe("DENY");
    } finally {
      await app.close();
    }
  });

  it("rejects the wrong Host, cross-origin requests, mutations, and internal route proxying", async () => {
    const app = buildAdminApi({
      configuration: development,
      identityVerifier: new DevelopmentAdminIdentityVerifier("development_owner"),
      reads: reads()
    });
    try {
      expect((await app.inject({ method: "GET", url: "/admin/v1/overview", headers: { host: "attacker.example" } })).statusCode).toBe(403);
      expect((await app.inject({ method: "GET", url: "/admin/v1/overview", headers: { host: "localhost:3001", origin: "https://attacker.example" } })).statusCode).toBe(403);
      expect((await app.inject({ method: "POST", url: "/admin/v1/overview", headers: { host: "localhost:3001", origin: "http://localhost:3001" } })).statusCode).toBe(405);
      expect((await app.inject({ method: "GET", url: "/internal/v1/provider-health", headers: { host: "localhost:3001" } })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("requires both the trusted origin proof and owner session in production", async () => {
    const app = buildAdminApi({
      configuration: production,
      identityVerifier: {
        async verify(sessionToken) {
          if (sessionToken !== "valid-owner-session") throw new AdminAuthenticationError();
          return { subject: "owner_tikdd", username: "owner", mode: "password" };
        }
      },
      reads: reads()
    });
    const host = "admin.tikdd.example";
    try {
      expect((await app.inject({ method: "GET", url: "/admin/v1/runtime", headers: { host, "x-tikdd-admin-session": "valid-owner-session" } })).statusCode).toBe(403);
      expect((await app.inject({ method: "GET", url: "/admin/v1/runtime", headers: { host, "x-tikdd-origin-proof": production.auth.originProof ?? "", "x-tikdd-admin-session": "forged" } })).statusCode).toBe(401);
      expect((await app.inject({ method: "GET", url: "/admin/v1/runtime", headers: { host, "x-tikdd-origin-proof": production.auth.originProof ?? "", "x-tikdd-admin-session": "valid-owner-session" } })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/admin/v1/runtime", headers: { host: "127.0.0.1:4100", origin: production.adminOrigin, "x-tikdd-origin-proof": production.auth.originProof ?? "", "x-tikdd-admin-session": "valid-owner-session" } })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("keeps settings recovery authenticated, CSRF bound, and fixed-path only",async()=>{const csrfProtector=new AdminCsrfProtector(development.csrfSecret);const receipt={schemaVersion:"1" as const,commandId:`cmd_${"c".repeat(32)}`,aggregate:"snapshot" as const,targetId:"local",expectedRevision:1,acceptedRevision:2,currentRevision:2,propagatedRevision:2,state:"propagated" as const,acceptedAt:"2026-08-13T00:00:00.000Z",completedAt:"2026-08-13T00:00:01.000Z"};const content={getSettingsRecoveryView:async()=>{throw new Error("unused")},rebuildSnapshot:async()=>receipt,invalidateContentCache:async()=>receipt} as never;const app=buildAdminApi({configuration:development,identityVerifier:new DevelopmentAdminIdentityVerifier("development_owner"),reads:reads(),contentManagement:content,csrfProtector});try{const body={deployment:"local",expectedRevision:1,snapshotId:`snap_${"a".repeat(32)}`,reason:"Revalidate persisted affected paths.",confirmation:"local",idempotencyKey:"abcdefghijklmnop"};const base={host:"localhost:3001",origin:"http://localhost:3001","content-type":"application/json","sec-fetch-site":"same-origin"};expect((await app.inject({method:"POST",url:"/admin/v1/settings/recovery/invalidate-content-cache",headers:base,payload:body})).statusCode).toBe(403);const csrf=csrfProtector.issue("development_owner",development.adminOrigin);expect((await app.inject({method:"POST",url:"/admin/v1/settings/recovery/invalidate-content-cache",headers:{...base,"x-tikdd-csrf":csrf},payload:body})).statusCode).toBe(200);expect((await app.inject({method:"POST",url:"/admin/v1/settings/recovery/purge-all",headers:{...base,"x-tikdd-csrf":csrf},payload:body})).statusCode).toBe(405);}finally{await app.close();}});

  it("validates filters and refuses to leak an unsafe read payload", async () => {
    const safeReads = reads();
    const app = buildAdminApi({
      configuration: development,
      identityVerifier: new DevelopmentAdminIdentityVerifier("development_owner"),
      reads: safeReads
    });
    try {
      expect((await app.inject({ method: "GET", url: "/admin/v1/routes?platform=X", headers: { host: "localhost:3001" } })).statusCode).toBe(400);
      expect((await app.inject({ method: "GET", url: "/admin/v1/locales?locale=en", headers: { host: "localhost:3001" } })).statusCode).toBe(400);
    } finally {
      await app.close();
    }

    const unsafe = reads();
    unsafe.getOverview = async () => ({ ...ADMIN_OVERVIEW_FIXTURES.healthy, sourceUrl: "https://x.com/example/status/1" }) as never;
    const unsafeApp = buildAdminApi({
      configuration: development,
      identityVerifier: new DevelopmentAdminIdentityVerifier("development_owner"),
      reads: unsafe
    });
    try {
      const response = await unsafeApp.inject({ method: "GET", url: "/admin/v1/overview", headers: { host: "localhost:3001" } });
      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain("x.com");
      expect(response.body).not.toContain("sourceUrl");
    } finally {
      await unsafeApp.close();
    }
  });
});
