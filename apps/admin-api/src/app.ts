import {
  AdminProviderIdSchema,
  AdminLoginRequestSchema,
  AdminLogoutRequestSchema,
  AdminPasswordChangeRequestSchema,
  AdminRouteListSchema,
  AdminCsrfTokenSchema,
  AdminContentManagementViewSchema,
  AdminContentPublicationViewSchema,
  AdminContentRebuildSnapshotCommandSchema,
  AdminContentInvalidateCacheCommandSchema,
  AdminSettingsRecoveryViewSchema,
  AdminSeoTechnicalViewSchema,
  AdminMutationReceiptSchema,
  AdminPlatformManagementViewSchema,
  AdminQualificationViewSchema,
  AdminRoutePolicyViewSchema,
  LocaleTagSchema,
  assertAdminSafeValue,
  type AdminLocaleList,
  type AdminOverview,
  type AdminPageList,
  type AdminPlatformList,
  type AdminProviderList,
  type AdminRouteDetail,
  type AdminRouteList,
  type AdminRuntime,
  type AdminSeoOverview
} from "@tikdd/admin-contracts";
import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AdminAuthenticationError,
  type AdminPasswordAuthService,
  type AdminIdentity,
  type AdminIdentityVerifier,
} from "./auth";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AdminCsrfProtector } from "./csrf";
import type { AdminRoutePolicyService } from "./route-policy-service";
import type { AdminPlatformManagementService } from "./platform-management-service";
import type { AdminContentManagementService } from "./content-management-service";
import type { AdminQualificationService } from "./qualification-service";
import type { AdminApiConfiguration } from "./config";

export interface AdminReadApi {
  getOverview(): Promise<AdminOverview>;
  listRoutes(): Promise<AdminRouteList>;
  getRouteDetail(providerId: string, platform: string, region: string): Promise<AdminRouteDetail | null>;
  listProviders(): Promise<AdminProviderList>;
  listPlatforms(): Promise<AdminPlatformList>;
  getRuntime(): Promise<AdminRuntime>;
  listLocales(channel: "draft" | "published"): Promise<AdminLocaleList>;
  listPages(channel: "draft" | "published", locale?: string): Promise<AdminPageList>;
  getSeoOverview(channel: "draft" | "published", locale?: string): Promise<AdminSeoOverview>;
}

export interface BuildAdminApiOptions {
  configuration: AdminApiConfiguration;
  authService?: AdminPasswordAuthService;
  identityVerifier?: AdminIdentityVerifier;
  reads: AdminReadApi;
  routePolicies?: Pick<AdminRoutePolicyService, "getView" | "saveDraft" | "publish" | "discard" | "rollback" | "safety" | "probe">;
  platformManagement?: Pick<AdminPlatformManagementService, "getView" | "saveDraft" | "publish" | "discard" | "rollback">;
  contentManagement?: Pick<AdminContentManagementService, "getView" | "saveLocale" | "discardLocale" | "savePage" | "discardPage" | "saveShared" | "getPublicationView" | "getSeoTechnicalView" | "getSettingsRecoveryView" | "publish" | "rollback" | "retryPropagation" | "rebuildSnapshot" | "invalidateContentCache">;
  qualification?: Pick<AdminQualificationService,"getView"|"review"|"lockPolicy">;
  csrfProtector?: AdminCsrfProtector;
  logger?: boolean;
}

const ChannelQuerySchema = z.strictObject({
  channel: z.enum(["draft", "published"]).default("published"),
  locale: LocaleTagSchema.optional()
});

const RouteFilterQuerySchema = z.strictObject({
  provider: AdminProviderIdSchema.optional(),
  platform: PlatformIdSchema.optional(),
  state: z.enum(["healthy", "warning", "open", "paused", "insufficient_data", "stale", "unavailable", "draft"]).optional()
});

function header(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

interface ReplyBoundary {
  code(statusCode: number): ReplyBoundary;
  send(value: unknown): unknown;
}

function safeSend(reply: ReplyBoundary, value: unknown): unknown {
  assertAdminSafeValue(value);
  return reply.send(value);
}

function error(reply: ReplyBoundary, statusCode: number, code: string, message: string): unknown {
  return reply.code(statusCode).send({ error: { code, message } });
}

export function buildAdminApi(options: BuildAdminApiOptions): FastifyInstance {
  const identities = new WeakMap<object, AdminIdentity>();
  const app = Fastify({
    logger: options.logger
      ? {
          serializers: {
            req() {
              return { service: "admin-api" };
            },
            res(reply) {
              return { statusCode: (reply as { statusCode?: number }).statusCode ?? 0 };
            }
          }
        }
      : false,
    trustProxy: false,
    bodyLimit: 64 * 1_024
  });

  app.addHook("onRequest", async (request, reply) => {
    const isHealthRequest = request.url.startsWith("/health/");
    const requestHost = header(request.headers.host)?.toLowerCase();
    const loopbackHost = `${options.configuration.host === "::1" ? "[::1]" : options.configuration.host}:${options.configuration.port}`;
    const trustedHost = requestHost === options.configuration.expectedHost || requestHost === loopbackHost;
    if (!isHealthRequest && !trustedHost) {
      return error(reply, 403, "ORIGIN_BOUNDARY_REJECTED", "The Admin origin boundary could not be verified.");
    }
    const requestOrigin = header(request.headers.origin);
    if (!isHealthRequest && requestOrigin !== undefined && requestOrigin !== options.configuration.adminOrigin) {
      return error(reply, 403, "ORIGIN_BOUNDARY_REJECTED", "The Admin origin boundary could not be verified.");
    }
    if (request.url.startsWith("/auth/v1/") && request.method === "POST") {
      if (requestOrigin !== options.configuration.adminOrigin) {
        return error(reply, 403, "ORIGIN_BOUNDARY_REJECTED", "The Admin origin boundary could not be verified.");
      }
      if (!header(request.headers["content-type"])?.toLowerCase().startsWith("application/json")) {
        return error(reply, 415, "CONTENT_TYPE_REJECTED", "Administrator authentication accepts JSON only.");
      }
    }
    const fetchSite = header(request.headers["sec-fetch-site"]);
    if (!isHealthRequest && fetchSite !== undefined && fetchSite !== "same-origin" && fetchSite !== "none") {
      return error(reply, 403, "ORIGIN_BOUNDARY_REJECTED", "The Admin origin boundary could not be verified.");
    }
    const proof=options.configuration.auth.originProof;
    if (proof && (request.url.startsWith("/auth/v1/") || request.url.startsWith("/admin/v1/"))) {
      const expected=createHash("sha256").update(proof).digest();const provided=createHash("sha256").update(header(request.headers["x-tikdd-origin-proof"])??"").digest();
      if(!timingSafeEqual(expected,provided))
      return error(reply, 403, "DIRECT_ORIGIN_REJECTED", "Direct Admin origin access is not allowed.");
    }
    if (request.url.startsWith("/admin/v1/")) {
      try {
        const verifier=options.authService??options.identityVerifier;if(!verifier)throw new AdminAuthenticationError();
        const identity = await verifier.verify(header(request.headers["x-tikdd-admin-session"]));
        identities.set(request, identity);
      } catch (authenticationError) {
        if (authenticationError instanceof AdminAuthenticationError) {
          return error(reply, 401, "UNAUTHORIZED", "Owner authentication is required.");
        }
        return error(reply, 401, "UNAUTHORIZED", "Owner authentication is required.");
      }
    }
    if (request.url.startsWith("/admin/v1/") && request.method !== "GET") {
      const allowed = new Set([
        "/admin/v1/route-policies/draft", "/admin/v1/route-policies/publish",
        "/admin/v1/route-policies/discard", "/admin/v1/route-policies/rollback",
        "/admin/v1/route-policies/safety", "/admin/v1/route-policies/probe",
        "/admin/v1/platform-presentations/draft", "/admin/v1/platform-presentations/publish",
        "/admin/v1/platform-presentations/discard", "/admin/v1/platform-presentations/rollback"
        ,"/admin/v1/content/locales/draft", "/admin/v1/content/locales/discard"
        ,"/admin/v1/content/pages/draft", "/admin/v1/content/pages/discard"
        ,"/admin/v1/content/shared/draft"
        ,"/admin/v1/content/publish", "/admin/v1/content/rollback", "/admin/v1/content/retry-propagation"
        ,"/admin/v1/settings/recovery/rebuild-snapshot", "/admin/v1/settings/recovery/invalidate-content-cache"
        ,"/admin/v1/qualification/review", "/admin/v1/qualification/lock-policy"
      ]);
      if (request.method !== "POST" || !allowed.has(request.url.split("?")[0] ?? "")) {
        return error(reply, 405, "METHOD_NOT_ALLOWED", "This Admin API command is not available.");
      }
      const identity=identities.get(request);
      if(!identity||!options.csrfProtector?.verify({token:header(request.headers["x-tikdd-csrf"]),subject:identity.subject,
        origin:header(request.headers.origin),expectedOrigin:options.configuration.adminOrigin,
        contentType:header(request.headers["content-type"]),fetchSite:header(request.headers["sec-fetch-site"])})){
        return error(reply,403,"CSRF_REJECTED","The Admin command boundary could not be verified.");
      }
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Pragma", "no-cache");
    reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    return payload;
  });

  app.setErrorHandler(async (_requestError, request, reply) => {
    request.log.error("admin request failed");
    return error(reply, 503, "ADMIN_READ_UNAVAILABLE", "The requested Admin data is temporarily unavailable.");
  });

  app.get("/health/live", async (_request, reply) =>
    safeSend(reply, { status: "ok", service: "admin-api", buildId:options.configuration.buildId, startedAt:options.configuration.startedAt }));

  app.post("/auth/v1/login",async(request,reply)=>{if(!options.authService)return error(reply,503,"AUTH_UNAVAILABLE","Administrator authentication is unavailable.");const parsed=AdminLoginRequestSchema.safeParse(request.body);if(!parsed.success)return error(reply,400,"INVALID_REQUEST","Provide valid administrator credentials.");try{return reply.send(await options.authService.login(parsed.data.username,parsed.data.password));}catch(cause){if(cause instanceof AdminAuthenticationError){if(cause.retryAfterSeconds)reply.header("Retry-After",String(cause.retryAfterSeconds));return error(reply,cause.code==="RATE_LIMITED"?429:cause.code==="AUTH_UNAVAILABLE"?503:401,cause.code,cause.code==="RATE_LIMITED"?"Too many login attempts. Try again later.":cause.code==="AUTH_UNAVAILABLE"?"Administrator authentication is temporarily unavailable.":"The username or password is incorrect.");}throw cause;}});
  app.get("/auth/v1/session",async(request,reply)=>{if(!options.authService)return error(reply,503,"AUTH_UNAVAILABLE","Administrator authentication is unavailable.");try{return safeSend(reply,await options.authService.session(header(request.headers["x-tikdd-admin-session"])??""));}catch{return error(reply,401,"UNAUTHORIZED","Administrator authentication is required.");}});
  app.post("/auth/v1/logout",async(request,reply)=>{if(!options.authService)return error(reply,503,"AUTH_UNAVAILABLE","Administrator authentication is unavailable.");const parsed=AdminLogoutRequestSchema.safeParse(request.body??{});if(!parsed.success)return error(reply,400,"INVALID_REQUEST","Provide a valid logout request.");try{await options.authService.logout(header(request.headers["x-tikdd-admin-session"]),parsed.data.allDevices);return reply.send({ok:true});}catch{return error(reply,401,"UNAUTHORIZED","Administrator authentication is required.");}});
  app.post("/auth/v1/password",async(request,reply)=>{if(!options.authService)return error(reply,503,"AUTH_UNAVAILABLE","Administrator authentication is unavailable.");const parsed=AdminPasswordChangeRequestSchema.safeParse(request.body);if(!parsed.success)return error(reply,400,"INVALID_REQUEST","Provide valid password fields.");try{await options.authService.changePassword(header(request.headers["x-tikdd-admin-session"])??"",parsed.data.currentPassword,parsed.data.newPassword);return reply.send({ok:true});}catch(cause){if(cause instanceof AdminAuthenticationError)return error(reply,401,"INVALID_CREDENTIALS","The current password is incorrect.");throw cause;}});

  app.get("/health/ready", async (_request, reply) => {
    const runtime = await options.reads.getRuntime();
    if (runtime.state === "unavailable") reply.code(503);
    return safeSend(reply, { status: runtime.state === "unavailable" ? "not-ready" : "ready", service: "admin-api", state: runtime.state });
  });

  app.get("/admin/v1/overview", async (_request, reply) =>
    safeSend(reply, await options.reads.getOverview()));

  app.get<{ Querystring: Record<string, unknown> }>("/admin/v1/routes", async (request, reply) => {
    const query = RouteFilterQuerySchema.safeParse(request.query);
    if (!query.success) return error(reply, 400, "INVALID_FILTER", "Provide bounded route filters.");
    const result = await options.reads.listRoutes();
    const routes = result.routes.filter((route) =>
      (query.data.provider === undefined || route.tuple.providerId === query.data.provider) &&
      (query.data.platform === undefined || route.tuple.platform === query.data.platform) &&
      (query.data.state === undefined || route.state === query.data.state));
    return safeSend(reply, AdminRouteListSchema.parse({ ...result, routes }));
  });

  app.get<{ Params: { providerId: string; platform: string; region: string } }>(
    "/admin/v1/routes/:providerId/:platform/:region",
    async (request, reply) => {
      const provider = AdminProviderIdSchema.safeParse(request.params.providerId);
      const platform = PlatformIdSchema.safeParse(request.params.platform);
      const region = RegionIdSchema.safeParse(request.params.region);
      if (!provider.success || !platform.success || !region.success) {
        return error(reply, 400, "INVALID_ROUTE", "Provide one exact Provider, platform, and region tuple.");
      }
      const detail = await options.reads.getRouteDetail(provider.data, platform.data, region.data);
      if (!detail) return error(reply, 404, "ROUTE_NOT_FOUND", "The exact route does not exist.");
      return safeSend(reply, detail);
    }
  );

  app.get("/admin/v1/providers", async (_request, reply) =>
    safeSend(reply, await options.reads.listProviders()));
  app.get("/admin/v1/platforms", async (_request, reply) =>
    safeSend(reply, await options.reads.listPlatforms()));

  app.get<{Params:{platform:string;region:string}}>("/admin/v1/platform-presentations/:platform/:region",async(request,reply)=>{
    const platform=PlatformIdSchema.safeParse(request.params.platform);const region=RegionIdSchema.safeParse(request.params.region);
    if(!platform.success||!region.success)return error(reply,400,"INVALID_PLATFORM","Provide one exact platform and region.");
    if(!options.platformManagement)return error(reply,503,"CONTROL_UNAVAILABLE","Platform controls are unavailable.");
    return safeSend(reply,AdminPlatformManagementViewSchema.parse(await options.platformManagement.getView(platform.data,region.data)));
  });
  app.get("/admin/v1/runtime", async (_request, reply) =>
    safeSend(reply, await options.reads.getRuntime()));

  app.get("/admin/v1/csrf", async (request, reply) => {
    const identity=identities.get(request);
    if(!identity||!options.csrfProtector)return error(reply,503,"CONTROL_UNAVAILABLE","Route controls are unavailable.");
    return safeSend(reply,AdminCsrfTokenSchema.parse({schemaVersion:"1",
      csrfToken:options.csrfProtector.issue(identity.subject,options.configuration.adminOrigin),expiresInSeconds:300}));
  });

  app.get<{Params:{platform:string;region:string}}>("/admin/v1/route-policies/:platform/:region",async(request,reply)=>{
    const platform=PlatformIdSchema.safeParse(request.params.platform);const region=RegionIdSchema.safeParse(request.params.region);
    if(!platform.success||!region.success)return error(reply,400,"INVALID_ROUTE","Provide one exact platform and region.");
    if(!options.routePolicies)return error(reply,503,"CONTROL_UNAVAILABLE","Route controls are unavailable.");
    return safeSend(reply,AdminRoutePolicyViewSchema.parse(await options.routePolicies.getView(platform.data,region.data)));
  });

  const commandError=(reply:ReplyBoundary,cause:unknown):unknown=>{
    const name=cause instanceof Error?cause.name:"";
    if(name==="AdminRoutePolicyConflictError")return error(reply,409,"REVISION_CONFLICT","The route policy changed; reload before retrying.");
    if(name==="AdminIdempotencyConflictError")return error(reply,409,"IDEMPOTENCY_CONFLICT","The command key was already used for different input.");
    if(name==="AdminPlatformReadinessError")return error(reply,422,"READINESS_BLOCKED","The platform does not satisfy the current publication readiness gate.");
    if(name==="AdminContentBoundaryError")return error(reply,422,"CONTENT_BOUNDARY_REJECTED","The content change violates the locale or template boundary.");
    if(name==="AdminQualificationConflictError"||name==="AdminQualificationIdempotencyConflictError")return error(reply,409,"QUALIFICATION_CONFLICT","The qualification state changed; reload before retrying.");
    if(name==="AdminQualificationReadinessError")return error(reply,422,"QUALIFICATION_BLOCKED","The qualification prerequisites are not satisfied.");
    if(name==="ZodError")return error(reply,400,"INVALID_COMMAND","Provide a bounded command for one exact route scope.");
    return error(reply,503,"CONTROL_UNAVAILABLE","The route-policy command could not be completed.");
  };
  const actor=(request:object)=>identities.get(request)?.subject;
  app.post("/admin/v1/route-policies/draft",async(request,reply)=>{try{const subject=actor(request);if(!subject)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.routePolicies?.saveDraft(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/route-policies/publish",async(request,reply)=>{try{const subject=actor(request);if(!subject)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.routePolicies?.publish(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/route-policies/discard",async(request,reply)=>{try{const subject=actor(request);if(!subject)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.routePolicies?.discard(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/route-policies/rollback",async(request,reply)=>{try{const subject=actor(request);if(!subject)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.routePolicies?.rollback(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/route-policies/safety",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.routePolicies)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.routePolicies.safety(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/route-policies/probe",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.routePolicies)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.routePolicies.probe(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.get<{Params:{providerId:string;platform:string;region:string}}>("/admin/v1/qualification/:providerId/:platform/:region",async(request,reply)=>{
    const provider=AdminProviderIdSchema.safeParse(request.params.providerId);const platform=PlatformIdSchema.safeParse(request.params.platform);const region=RegionIdSchema.safeParse(request.params.region);
    if(!provider.success||!platform.success||!region.success)return error(reply,400,"INVALID_ROUTE","Provide one exact Provider, platform, and region tuple.");
    if(!options.qualification)return error(reply,503,"CONTROL_UNAVAILABLE","Qualification controls are unavailable.");
    try{return safeSend(reply,AdminQualificationViewSchema.parse(await options.qualification.getView(provider.data,platform.data,region.data)));}
    catch(cause){return commandError(reply,cause);}
  });
  app.post("/admin/v1/qualification/review",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.qualification)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.qualification.review(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/qualification/lock-policy",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.qualification)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.qualification.lockPolicy(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/platform-presentations/draft",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.platformManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.platformManagement.saveDraft(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/platform-presentations/publish",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.platformManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.platformManagement.publish(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/platform-presentations/discard",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.platformManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.platformManagement.discard(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/platform-presentations/rollback",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.platformManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.platformManagement.rollback(request.body,subject)));}catch(cause){return commandError(reply,cause);}});

  app.get("/admin/v1/content",async(_request,reply)=>{if(!options.contentManagement)return error(reply,503,"CONTROL_UNAVAILABLE","Content controls are unavailable.");return safeSend(reply,AdminContentManagementViewSchema.parse(await options.contentManagement.getView()));});
  app.get("/admin/v1/content/publication",async(_request,reply)=>{if(!options.contentManagement)return error(reply,503,"CONTROL_UNAVAILABLE","Content publication is unavailable.");return safeSend(reply,AdminContentPublicationViewSchema.parse(await options.contentManagement.getPublicationView()));});
  app.get("/admin/v1/content/seo",async(_request,reply)=>{if(!options.contentManagement)return error(reply,503,"CONTROL_UNAVAILABLE","SEO publication rules are unavailable.");return safeSend(reply,AdminSeoTechnicalViewSchema.parse(await options.contentManagement.getSeoTechnicalView()));});
  app.get("/admin/v1/settings",async(_request,reply)=>{if(!options.contentManagement)return error(reply,503,"CONTROL_UNAVAILABLE","Settings and recovery readiness are unavailable.");return safeSend(reply,AdminSettingsRecoveryViewSchema.parse(await options.contentManagement.getSettingsRecoveryView()));});
  app.post("/admin/v1/content/locales/draft",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.saveLocale(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/locales/discard",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.discardLocale(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/pages/draft",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.savePage(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/pages/discard",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.discardPage(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/shared/draft",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.saveShared(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/publish",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.publish(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/rollback",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.rollback(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/content/retry-propagation",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.retryPropagation(request.body,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/settings/recovery/rebuild-snapshot",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();const command=AdminContentRebuildSnapshotCommandSchema.parse(request.body);return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.rebuildSnapshot(command,subject)));}catch(cause){return commandError(reply,cause);}});
  app.post("/admin/v1/settings/recovery/invalidate-content-cache",async(request,reply)=>{try{const subject=actor(request);if(!subject||!options.contentManagement)throw new Error();const command=AdminContentInvalidateCacheCommandSchema.parse(request.body);return safeSend(reply,AdminMutationReceiptSchema.parse(await options.contentManagement.invalidateContentCache(command,subject)));}catch(cause){return commandError(reply,cause);}});

  app.get<{ Querystring: Record<string, unknown> }>("/admin/v1/locales", async (request, reply) => {
    const query = ChannelQuerySchema.safeParse(request.query);
    if (!query.success || query.data.locale !== undefined) {
      return error(reply, 400, "INVALID_FILTER", "Provide a valid revision channel.");
    }
    return safeSend(reply, await options.reads.listLocales(query.data.channel));
  });

  app.get<{ Querystring: Record<string, unknown> }>("/admin/v1/pages", async (request, reply) => {
    const query = ChannelQuerySchema.safeParse(request.query);
    if (!query.success) return error(reply, 400, "INVALID_FILTER", "Provide a valid page filter.");
    return safeSend(reply, await options.reads.listPages(query.data.channel, query.data.locale));
  });

  app.get<{ Querystring: Record<string, unknown> }>("/admin/v1/seo", async (request, reply) => {
    const query = ChannelQuerySchema.safeParse(request.query);
    if (!query.success) return error(reply, 400, "INVALID_FILTER", "Provide a valid SEO filter.");
    return safeSend(reply, await options.reads.getSeoOverview(query.data.channel, query.data.locale));
  });

  return app;
}
