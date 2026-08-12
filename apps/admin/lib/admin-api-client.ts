import {
  AdminOverviewSchema,
  AdminPlatformListSchema,
  AdminProviderListSchema,
  AdminRouteDetailSchema,
  AdminRouteListSchema,
  AdminCsrfTokenSchema,
  AdminMutationReceiptSchema,
  AdminContentManagementViewSchema,
  AdminContentPublicationViewSchema,
  AdminSeoTechnicalViewSchema,
  AdminPlatformManagementViewSchema,
  AdminRoutePolicyViewSchema,
  AdminRuntimeSchema,
  AdminSeoOverviewSchema,
  assertAdminSafeValue,
  type AdminRouteSummary
} from "@tikdd/admin-contracts";
import { AdminConsoleSnapshotSchema, type AdminConsoleSnapshot } from "./console-contract";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { z } from "zod";

interface HeaderReader {
  get(name: string): string | null;
}

export interface AdminRouteSelection {
  providerId: string;
  platform: string;
  region: string;
}

export interface AdminApiConnection {
  internalOrigin: string;
  adminOrigin: string;
  originProof: string | null;
  timeoutMs: number;
  refreshIntervalMs: number;
}

export interface AdminTransportResponse {
  ok: boolean;
  body: unknown;
}

export type AdminTransport = (input: {
  url: URL;
  headers: Readonly<Record<string, string>>;
  timeoutMs: number;
  method?: "GET" | "POST";
  body?: string;
}) => Promise<AdminTransportResponse>;

const maximumResponseBytes = 2 * 1_024 * 1_024;

const nodeTransport: AdminTransport = ({ url, headers, timeoutMs, method = "GET", body }) => new Promise((resolve, reject) => {
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const request = transport(url, { method, headers, timeout: timeoutMs }, (response) => {
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maximumResponseBytes) {
        request.destroy(new Error("Admin response exceeded its limit."));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => {
      if (response.statusCode === undefined || response.statusCode < 200 || response.statusCode >= 300) {
        resolve({ ok: false, body: null });
        return;
      }
      try {
        resolve({ ok: true, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown });
      } catch (error) {
        reject(error);
      }
    });
  });
  request.once("timeout", () => request.destroy(new Error("Admin read timed out.")));
  request.once("error", reject);
  request.end(body);
});

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error("Admin console timing configuration is invalid.");
  }
  return parsed;
}

function exactOrigin(value: string, name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute origin.`);
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`${name} must contain only one HTTP(S) origin.`);
  }
  return parsed;
}

export function loadAdminApiConnection(
  environment: NodeJS.ProcessEnv = process.env
): AdminApiConnection {
  const production = environment.NODE_ENV === "production";
  const internalRaw = environment.ADMIN_API_INTERNAL_ORIGIN ?? (production ? "" : "http://127.0.0.1:4100");
  const adminRaw = environment.ADMIN_ORIGIN ?? (production ? "" : "http://localhost:3001");
  if (!internalRaw || !adminRaw) throw new Error("Admin API and browser origins are required.");
  const internalOrigin = exactOrigin(internalRaw, "ADMIN_API_INTERNAL_ORIGIN");
  const adminOrigin = exactOrigin(adminRaw, "ADMIN_ORIGIN");
  if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(internalOrigin.hostname)) {
    throw new Error("ADMIN_API_INTERNAL_ORIGIN must be loopback-only.");
  }
  if (production && adminOrigin.protocol !== "https:") {
    throw new Error("Production ADMIN_ORIGIN must use HTTPS.");
  }
  const originProof = environment.ADMIN_ORIGIN_PROOF?.trim() || null;
  if (production && (!originProof || originProof.length < 32)) {
    throw new Error("Production ADMIN_ORIGIN_PROOF is required.");
  }
  return {
    internalOrigin: internalOrigin.origin,
    adminOrigin: adminOrigin.origin,
    originProof,
    timeoutMs: boundedInteger(environment.ADMIN_API_FETCH_TIMEOUT_MS, 5_000, 500, 10_000),
    refreshIntervalMs: boundedInteger(environment.ADMIN_REFRESH_INTERVAL_MS, 30_000, 15_000, 300_000)
  };
}

function unavailable() {
  return { status: "unavailable" as const, data: null };
}

function sessionToken(headers:HeaderReader):string|null{const raw=headers.get("cookie");if(!raw)return null;const name=process.env.NODE_ENV==="production"?"__Host-tikdd_admin_session":"tikdd_admin_session_dev";for(const part of raw.split(";")){const [key,...value]=part.trim().split("=");if(key===name)return decodeURIComponent(value.join("="));}return null;}

async function read<T extends z.ZodType>(input: {
  schema: T;
  path: string;
  headers: HeaderReader;
  configuration: AdminApiConnection;
  transport: AdminTransport;
}): Promise<{ status: "ready"; data: z.infer<T> } | { status: "unavailable"; data: null }> {
  const assertion = sessionToken(input.headers);
  const outgoing: Record<string, string> = {
    accept: "application/json",
    host: new URL(input.configuration.adminOrigin).host,
    origin: input.configuration.adminOrigin,
    "sec-fetch-site": "same-origin"
  };
  if (assertion) outgoing["x-tikdd-admin-session"] = assertion;
  if (input.configuration.originProof) outgoing["x-tikdd-origin-proof"] = input.configuration.originProof;
  try {
    const response = await input.transport({
      url: new URL(input.path, input.configuration.internalOrigin),
      headers: outgoing,
      timeoutMs: input.configuration.timeoutMs
    });
    if (!response.ok) return unavailable();
    return { status: "ready", data: input.schema.parse(response.body) };
  } catch {
    return unavailable();
  }
}

function routeRank(route: AdminRouteSummary): number {
  return ({ unavailable: 0, open: 1, warning: 2, stale: 3, paused: 4, insufficient_data: 5, healthy: 6, draft: 7 })[route.state];
}

function chooseRoute(routes: readonly AdminRouteSummary[], selection?: AdminRouteSelection): AdminRouteSummary | null {
  const requested = selection
    ? routes.find(({ tuple }) =>
        tuple.providerId === selection.providerId &&
        tuple.platform === selection.platform &&
        tuple.region === selection.region)
    : undefined;
  const platformCounts = new Map<string, number>();
  for (const route of routes) platformCounts.set(route.tuple.platform, (platformCounts.get(route.tuple.platform) ?? 0) + 1);
  return requested ?? [...routes].sort((left, right) =>
    Number(right.productionEligible) - Number(left.productionEligible) ||
    routeRank(left) - routeRank(right) ||
    (platformCounts.get(right.tuple.platform) ?? 0) - (platformCounts.get(left.tuple.platform) ?? 0) ||
    (left.preferencePosition ?? 1_000) - (right.preferencePosition ?? 1_000) ||
    right.basePriority - left.basePriority ||
    left.tuple.platform.localeCompare(right.tuple.platform) ||
    left.tuple.providerId.localeCompare(right.tuple.providerId))[0] ?? null;
}

export async function loadAdminConsoleSnapshot(input: {
  requestHeaders: HeaderReader;
  selection?: AdminRouteSelection;
  policyPlatform?: string;
  managedPlatform?: string;
  configuration?: AdminApiConnection;
  transport?: AdminTransport;
}): Promise<AdminConsoleSnapshot> {
  const configuration = input.configuration ?? loadAdminApiConnection();
  const transport = input.transport ?? nodeTransport;
  const shared = { headers: input.requestHeaders, configuration, transport };
  const [overview, routes, providers, platforms, runtime, seo] = await Promise.all([
    read({ ...shared, schema: AdminOverviewSchema, path: "/admin/v1/overview" }),
    read({ ...shared, schema: AdminRouteListSchema, path: "/admin/v1/routes" }),
    read({ ...shared, schema: AdminProviderListSchema, path: "/admin/v1/providers" }),
    read({ ...shared, schema: AdminPlatformListSchema, path: "/admin/v1/platforms" }),
    read({ ...shared, schema: AdminRuntimeSchema, path: "/admin/v1/runtime" }),
    read({ ...shared, schema: AdminSeoOverviewSchema, path: "/admin/v1/seo?channel=published" })
  ]);
  const selected = routes.status === "ready" ? chooseRoute(routes.data.routes, input.selection) : null;
  const selectedRoute = selected
    ? await read({
        ...shared,
        schema: AdminRouteDetailSchema.nullable(),
        path: `/admin/v1/routes/${encodeURIComponent(selected.tuple.providerId)}/${encodeURIComponent(selected.tuple.platform)}/${encodeURIComponent(selected.tuple.region)}`
      })
    : routes.status === "ready"
      ? { status: "ready" as const, data: null }
      : unavailable();
  const managedPlatform = input.managedPlatform ?? selected?.tuple.platform ?? (platforms.status === "ready" ? platforms.data.platforms[0]?.id : undefined);
  const platformRegion = runtime.status === "ready" ? runtime.data.region : selected?.tuple.region;
  const policyPlatform = input.policyPlatform ?? selected?.tuple.platform;
  const controls = routes.status === "ready"
    ? await Promise.all([
        read({ ...shared, schema: AdminCsrfTokenSchema, path: "/admin/v1/csrf" }),
        policyPlatform && platformRegion ? read({ ...shared, schema: AdminRoutePolicyViewSchema, path: `/admin/v1/route-policies/${encodeURIComponent(policyPlatform)}/${encodeURIComponent(platformRegion)}` }) : Promise.resolve({status:"ready" as const,data:null}),
        managedPlatform && platformRegion ? read({ ...shared, schema: AdminPlatformManagementViewSchema, path: `/admin/v1/platform-presentations/${encodeURIComponent(managedPlatform)}/${encodeURIComponent(platformRegion)}` }) : Promise.resolve({status:"ready" as const,data:null}),
        read({ ...shared, schema: AdminContentManagementViewSchema, path: "/admin/v1/content" }),
        read({ ...shared, schema: AdminContentPublicationViewSchema, path: "/admin/v1/content/publication" }),
        read({ ...shared, schema: AdminSeoTechnicalViewSchema, path: "/admin/v1/content/seo" })
      ]).then(([csrf,routePolicy,platformPresentation,contentManagement,contentPublication,seoTechnical])=>csrf.status==="ready"&&routePolicy.status==="ready"
        ? {status:"ready" as const,data:{csrf:csrf.data,routePolicy:routePolicy.data,platformPresentation:platformPresentation.status==="ready"?platformPresentation.data:null,contentManagement:contentManagement.status==="ready"?contentManagement.data:null,contentPublication:contentPublication.status==="ready"?contentPublication.data:null,seoTechnical:seoTechnical.status==="ready"?seoTechnical.data:null}}
        : unavailable())
    : unavailable();
  const snapshot = AdminConsoleSnapshotSchema.parse({
    schemaVersion: "1",
    generatedAt: new Date().toISOString(),
    refreshIntervalMs: configuration.refreshIntervalMs,
    overview,
    routes,
    selectedRoute,
    providers,
    platforms,
    runtime,
    seo,
    controls
  });
  assertAdminSafeValue(snapshot);
  return snapshot;
}

export async function sendAdminRouteCommand(input:{requestHeaders:HeaderReader;path:"draft"|"publish"|"discard"|"rollback"|"safety"|"probe";csrfToken:string;command:unknown;configuration?:AdminApiConnection;transport?:AdminTransport}){
  const configuration=input.configuration??loadAdminApiConnection();const transport=input.transport??nodeTransport;
  const assertion=sessionToken(input.requestHeaders);const body=JSON.stringify(input.command);
  const outgoing:Record<string,string>={accept:"application/json","content-type":"application/json",
    "content-length":String(Buffer.byteLength(body)),host:new URL(configuration.adminOrigin).host,
    origin:configuration.adminOrigin,"sec-fetch-site":"same-origin","x-tikdd-csrf":input.csrfToken};
  if(assertion)outgoing["x-tikdd-admin-session"]=assertion;
  if(configuration.originProof)outgoing["x-tikdd-origin-proof"]=configuration.originProof;
  const response=await transport({url:new URL(`/admin/v1/route-policies/${input.path}`,configuration.internalOrigin),headers:outgoing,
    timeoutMs:configuration.timeoutMs,method:"POST",body});
  if(!response.ok)throw new Error("Admin route command was rejected.");
  const receipt=AdminMutationReceiptSchema.parse(response.body);assertAdminSafeValue(receipt);return receipt;
}

export async function sendAdminPlatformCommand(input:{requestHeaders:HeaderReader;path:"draft"|"publish"|"discard"|"rollback";csrfToken:string;command:unknown;configuration?:AdminApiConnection;transport?:AdminTransport}){
  const configuration=input.configuration??loadAdminApiConnection();const transport=input.transport??nodeTransport;
  const assertion=sessionToken(input.requestHeaders);const body=JSON.stringify(input.command);
  const outgoing:Record<string,string>={accept:"application/json","content-type":"application/json",
    "content-length":String(Buffer.byteLength(body)),host:new URL(configuration.adminOrigin).host,
    origin:configuration.adminOrigin,"sec-fetch-site":"same-origin","x-tikdd-csrf":input.csrfToken};
  if(assertion)outgoing["x-tikdd-admin-session"]=assertion;
  if(configuration.originProof)outgoing["x-tikdd-origin-proof"]=configuration.originProof;
  const response=await transport({url:new URL(`/admin/v1/platform-presentations/${input.path}`,configuration.internalOrigin),headers:outgoing,
    timeoutMs:configuration.timeoutMs,method:"POST",body});
  if(!response.ok)throw new Error("Admin platform command was rejected.");
  const receipt=AdminMutationReceiptSchema.parse(response.body);assertAdminSafeValue(receipt);return receipt;
}

export async function sendAdminContentCommand(input:{requestHeaders:HeaderReader;path:"locales/draft"|"locales/discard"|"pages/draft"|"pages/discard"|"shared/draft"|"publish"|"rollback"|"retry-propagation";csrfToken:string;command:unknown;configuration?:AdminApiConnection;transport?:AdminTransport}){
  const configuration=input.configuration??loadAdminApiConnection();const transport=input.transport??nodeTransport;
  const assertion=sessionToken(input.requestHeaders);const body=JSON.stringify(input.command);
  const outgoing:Record<string,string>={accept:"application/json","content-type":"application/json","content-length":String(Buffer.byteLength(body)),host:new URL(configuration.adminOrigin).host,origin:configuration.adminOrigin,"sec-fetch-site":"same-origin","x-tikdd-csrf":input.csrfToken};
  if(assertion)outgoing["x-tikdd-admin-session"]=assertion;if(configuration.originProof)outgoing["x-tikdd-origin-proof"]=configuration.originProof;
  const response=await transport({url:new URL(`/admin/v1/content/${input.path}`,configuration.internalOrigin),headers:outgoing,timeoutMs:configuration.timeoutMs,method:"POST",body});
  if(!response.ok)throw new Error("Admin content command was rejected.");const receipt=AdminMutationReceiptSchema.parse(response.body);assertAdminSafeValue(receipt);return receipt;
}
