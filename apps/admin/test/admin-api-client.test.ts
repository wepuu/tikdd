import { ADMIN_OVERVIEW_FIXTURES } from "@tikdd/admin-contracts/fixtures";
import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { loadAdminApiConnection, loadAdminConsoleSnapshot, sendAdminRouteCommand, type AdminApiConnection, type AdminTransport } from "../lib/admin-api-client";
import { platforms, providers, routeDetail, routeList, runtime, seo } from "./fixture";

const csrf={schemaVersion:"1",csrfToken:`v1.${"a".repeat(40)}.${"b".repeat(43)}`,expiresInSeconds:300};
const routePolicy={schemaVersion:"1",platform:"x",region:"nl",headRevision:null,baselineProviderIds:["twittersaver"],effectiveProviderIds:["twittersaver"],technicalProviderIds:[],excludedProviders:[],published:null,draft:null,propagation:{state:"propagated",durableRevision:null,projectedRevision:null}};

const production: AdminApiConnection = {
  internalOrigin: "http://127.0.0.1:4100",
  adminOrigin: "https://admin.tikdd.example",
  originProof: "origin-proof-with-at-least-32-characters",
  timeoutMs: 2_000,
  refreshIntervalMs: 30_000
};

const payloads = new Map<string, unknown>([
  ["/admin/v1/overview", ADMIN_OVERVIEW_FIXTURES.healthy],
  ["/admin/v1/routes", routeList],
  ["/admin/v1/providers", providers],
  ["/admin/v1/platforms", platforms],
  ["/admin/v1/runtime", runtime],
  ["/admin/v1/seo?channel=published", seo],
  ["/admin/v1/routes/twittersaver/x/nl", routeDetail],
  ["/admin/v1/csrf",csrf],
  ["/admin/v1/route-policies/x/nl",routePolicy]
]);

describe("Admin console API client", () => {
  it("forwards only one validated command to a fixed Admin API path",async()=>{
    const transport=vi.fn(async(input:Parameters<AdminTransport>[0])=>({ok:true,body:{schemaVersion:"1",commandId:`cmd_${"a".repeat(32)}`,aggregate:"route_policy",targetId:"x/nl",expectedRevision:null,acceptedRevision:1,currentRevision:1,propagatedRevision:null,state:"propagated",acceptedAt:"2026-08-12T00:00:00.000Z",completedAt:"2026-08-12T00:00:01.000Z"}})) as AdminTransport;
    await sendAdminRouteCommand({requestHeaders:new Headers({cookie:"tikdd_admin_session_dev=signed-owner"}),path:"draft",csrfToken:"csrf-value-with-enough-length",command:{platform:"x"},configuration:production,transport});
    const call=vi.mocked(transport).mock.calls[0]?.[0];expect(call?.url.pathname).toBe("/admin/v1/route-policies/draft");expect(call?.method).toBe("POST");expect(call?.headers.cookie).toBeUndefined();expect(call?.headers["x-tikdd-csrf"]).toBe("csrf-value-with-enough-length");
  });
  it("fails production configuration closed and restricts the internal origin to loopback", () => {
    expect(() => loadAdminApiConnection({ NODE_ENV: "production", ADMIN_ORIGIN: "https://admin.tikdd.example", ADMIN_API_INTERNAL_ORIGIN: "http://127.0.0.1:4100" })).toThrow(/ORIGIN_PROOF/);
    expect(() => loadAdminApiConnection({ NODE_ENV: "development", ADMIN_ORIGIN: "http://localhost:3001", ADMIN_API_INTERNAL_ORIGIN: "https://api.example" })).toThrow(/loopback/);
  });

  it("uses only fixed Admin reads and forwards the assertion plus server origin proof", async () => {
    const calls: Array<{ path: string; headers: Readonly<Record<string, string>> }> = [];
    const transport = vi.fn(async ({ url, headers }: Parameters<AdminTransport>[0]) => {
      calls.push({ path: `${url.pathname}${url.search}`, headers });
      const payload = payloads.get(`${url.pathname}${url.search}`);
      return payload ? { ok: true, body: payload } : { ok: false, body: null };
    }) as AdminTransport;
    const snapshot = await loadAdminConsoleSnapshot({
      requestHeaders: new Headers({ cookie: "tikdd_admin_session_dev=signed-owner" }),
      selection: { providerId: "attacker", platform: "unknown", region: "elsewhere" },
      configuration: production,
      transport
    });
    expect(snapshot.routes.status).toBe("ready");
    expect(snapshot.selectedRoute.status).toBe("ready");
    expect(snapshot.selectedRoute.status === "ready" ? snapshot.selectedRoute.data?.summary.tuple.platform : null).toBe("x");
    expect(calls.map(({ path }) => path)).toContain("/admin/v1/routes/twittersaver/x/nl");
    expect(calls.every(({ path }) => path.startsWith("/admin/v1/"))).toBe(true);
    for (const call of calls) {
      expect(call.headers["x-tikdd-admin-session"]).toBe("signed-owner");
      expect(call.headers["x-tikdd-origin-proof"]).toBe(production.originProof);
      expect(call.headers.cookie).toBeUndefined();
      expect(call.headers.origin).toBe(production.adminOrigin);
    }
  });

  it("loads a platform policy even when that platform has no current operational route", async () => {
    const calls: string[] = [];
    const youtubePolicy={...routePolicy,platform:"youtube",baselineProviderIds:[],effectiveProviderIds:[],technicalProviderIds:["dlpanda"],excludedProviders:[{providerId:"dlpanda",reasons:["resolution_only"]}]};
    const transport = vi.fn(async ({ url }: Parameters<AdminTransport>[0]) => {
      const path=`${url.pathname}${url.search}`;calls.push(path);
      if(path==="/admin/v1/route-policies/youtube/nl")return {ok:true,body:youtubePolicy};
      const payload=payloads.get(path);return payload?{ok:true,body:payload}:{ok:false,body:null};
    }) as AdminTransport;
    const snapshot=await loadAdminConsoleSnapshot({requestHeaders:new Headers(),policyPlatform:"youtube",configuration:production,transport});
    expect(calls).toContain("/admin/v1/route-policies/youtube/nl");
    expect(snapshot.controls.status==="ready"?snapshot.controls.data.routePolicy?.platform:null).toBe("youtube");
  });

  it("keeps one failed source explicitly unavailable without discarding healthy resources", async () => {
    const transport = vi.fn(async ({ url }: Parameters<AdminTransport>[0]) => {
      if (url.pathname === "/admin/v1/platforms") return { ok: false, body: null };
      const payload = payloads.get(`${url.pathname}${url.search}`);
      return payload ? { ok: true, body: payload } : { ok: false, body: null };
    }) as AdminTransport;
    const snapshot = await loadAdminConsoleSnapshot({ requestHeaders: new Headers(), configuration: production, transport });
    expect(snapshot.platforms).toEqual({ status: "unavailable", data: null });
    expect(snapshot.overview.status).toBe("ready");
    expect(snapshot.routes.status).toBe("ready");
  });

  it("uses the bounded loopback transport to preserve the reviewed Admin Host", async () => {
    const observedHosts: string[] = [];
    const server = createServer((request, response) => {
      observedHosts.push(request.headers.host ?? "");
      const payload = payloads.get(request.url ?? "");
      if (request.headers.host !== "admin.tikdd.example" || !payload) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(payload));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing loopback listener.");
      const snapshot = await loadAdminConsoleSnapshot({
        requestHeaders: new Headers({ cookie: "tikdd_admin_session_dev=signed-owner" }),
        configuration: { ...production, internalOrigin: `http://127.0.0.1:${address.port}` }
      });
      expect(snapshot.overview.status).toBe("ready");
      expect(snapshot.routes.status).toBe("ready");
      expect(observedHosts.length).toBe(13);
      expect(new Set(observedHosts)).toEqual(new Set(["admin.tikdd.example"]));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
