import { createHash } from "node:crypto";
import { ProviderError } from "./errors";
import type { ResolveInput } from "./index";
import type {
  ProviderHttpBodyObservation,
  ProviderHttpObserver,
  ProviderHttpRequestObservation,
  ProviderHttpResponseObservation
} from "./adapters/shared";

export const SSSTWITTER_DIAGNOSTIC_TRACE_EVENT = "ssstwitter_diagnostic_trace";

export type SSSTwitterDiagnosticStage =
  | "resolve_start"
  | "landing_request_start"
  | "landing_response_complete"
  | "form_parse_start"
  | "form_parse_success"
  | "post_request_start"
  | "result_response_complete"
  | "result_parse_start"
  | "result_parse_success"
  | "resolution_create_start"
  | "resolution_create_success"
  | "resolve_success"
  | "resolve_failure";

export interface SSSTwitterDiagnosticTraceConfiguration {
  enabled: boolean;
  canonicalSha256: string;
  authorizationId: string;
  maximumInvocations: number;
  region: string;
}

export interface SSSTwitterDiagnosticTraceEvent {
  schemaVersion: "1";
  event: typeof SSSTWITTER_DIAGNOSTIC_TRACE_EVENT;
  kind: "stage" | "http_request" | "http_response" | "body_summary";
  authorizationId: string;
  providerId: "ssstwitter";
  platform: "x";
  region: "nl";
  taskId: string;
  invocationOrdinal: number;
  routeAttemptOrdinal: null;
  processPid: number;
  processUptimeSeconds: number;
  memoryRssMiB: number;
  activeProviderConcurrency: number;
  signalAborted: boolean;
  observedAt: string;
  [key: string]: unknown;
}

export type SSSTwitterDiagnosticTraceSink = (
  event: SSSTwitterDiagnosticTraceEvent
) => void;

const DISABLED_CONFIGURATION: SSSTwitterDiagnosticTraceConfiguration = {
  enabled: false,
  canonicalSha256: "",
  authorizationId: "",
  maximumInvocations: 0,
  region: ""
};
const AUTHORIZATION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,95}$/;

function strictBoolean(name: string, value: string | undefined): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`${name} must be true or false.`);
}

export function loadSSSTwitterDiagnosticTraceConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
  runtime: { production: boolean; region: string }
): SSSTwitterDiagnosticTraceConfiguration {
  const enabled = strictBoolean(
    "SSSTWITTER_DIAGNOSTIC_TRACE_ENABLED",
    environment.SSSTWITTER_DIAGNOSTIC_TRACE_ENABLED
  );
  if (!enabled) return { ...DISABLED_CONFIGURATION };

  if (!runtime.production || runtime.region !== "nl") {
    throw new Error("SSSTwitter diagnostic tracing is permitted only in the NL production Worker.");
  }
  const canonicalSha256 = environment.SSSTWITTER_DIAGNOSTIC_CANONICAL_SHA256 ?? "";
  if (!/^[a-f0-9]{64}$/.test(canonicalSha256)) {
    throw new Error("SSSTWITTER_DIAGNOSTIC_CANONICAL_SHA256 must be a lowercase SHA-256 digest.");
  }
  const authorizationId = environment.SSSTWITTER_DIAGNOSTIC_AUTHORIZATION_ID ?? "";
  if (!AUTHORIZATION_ID_PATTERN.test(authorizationId)) {
    throw new Error("SSSTWITTER_DIAGNOSTIC_AUTHORIZATION_ID is invalid.");
  }
  const maximumRaw = environment.SSSTWITTER_DIAGNOSTIC_MAX_INVOCATIONS ?? "2";
  const maximumInvocations = Number.parseInt(maximumRaw, 10);
  if (!/^[12]$/.test(maximumRaw) || maximumInvocations > 2) {
    throw new Error("SSSTWITTER_DIAGNOSTIC_MAX_INVOCATIONS must be 1 or 2.");
  }
  return {
    enabled: true,
    canonicalSha256,
    authorizationId,
    maximumInvocations,
    region: runtime.region
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortedNames(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function queryNames(value: URL): string[] {
  return sortedNames(value.searchParams.keys());
}

function headerValue(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value && value.length > 0 ? value : null;
}

function safeUrl(value: string | null, base?: string): { hostname: string | null; pathname: string | null } {
  if (!value) return { hostname: null, pathname: null };
  try {
    const parsed = base ? new URL(value, base) : new URL(value);
    return { hostname: parsed.hostname.toLowerCase(), pathname: parsed.pathname };
  } catch {
    return { hostname: null, pathname: null };
  }
}

function cookieNames(value: string | null): string[] {
  if (!value) return [];
  return sortedNames(
    value
      .split(";")
      .map((part) => part.trim().match(/^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=/)?.[1])
      .filter((name): name is string => Boolean(name))
  );
}

function setCookieNames(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const values = extended.getSetCookie?.() ?? [headers.get("set-cookie")].filter(
    (value): value is string => Boolean(value)
  );
  const names: string[] = [];
  for (const value of values) {
    for (const match of value.matchAll(/(?:^|,)\s*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=/g)) {
      if (match[1]) names.push(match[1]);
    }
  }
  return sortedNames(names);
}

function sanitizedProviderMessage(error: unknown): string {
  if (!(error instanceof ProviderError)) return "Unexpected provider failure.";
  return error.message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(tt|ts|cookie|token|authorization|secret)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 200);
}

function tokenSummaries(body: string | null): Record<string, { present: boolean; length: number; sha256: string | null }> {
  const parsed = body === null ? null : new URLSearchParams(body);
  return Object.fromEntries(
    ["tt", "ts", "source"].map((name) => {
      const value = parsed?.get(name) ?? null;
      return [
        name,
        { present: value !== null, length: value?.length ?? 0, sha256: value === null ? null : sha256(value) }
      ];
    })
  );
}

export class SSSTwitterDiagnosticTraceInvocation {
  private requestOrdinal = 0;
  private finished = false;
  readonly httpObserver: ProviderHttpObserver;

  constructor(
    private readonly configuration: SSSTwitterDiagnosticTraceConfiguration,
    private readonly sink: SSSTwitterDiagnosticTraceSink,
    private readonly input: ResolveInput,
    private readonly invocationOrdinal: number,
    private readonly activeProviderConcurrency: number
  ) {
    this.httpObserver = {
      onRequest: (observation) => this.onRequest(observation),
      onResponse: (observation) => this.onResponse(observation),
      onBody: (observation) => this.onBody(observation)
    };
  }

  private emit(kind: SSSTwitterDiagnosticTraceEvent["kind"], fields: Record<string, unknown>): void {
    try {
      const event: SSSTwitterDiagnosticTraceEvent = {
        schemaVersion: "1",
        event: SSSTWITTER_DIAGNOSTIC_TRACE_EVENT,
        kind,
        authorizationId: this.configuration.authorizationId,
        providerId: "ssstwitter",
        platform: "x",
        region: "nl",
        taskId: this.input.taskId,
        invocationOrdinal: this.invocationOrdinal,
        routeAttemptOrdinal: null,
        processPid: process.pid,
        processUptimeSeconds: Math.round(process.uptime()),
        memoryRssMiB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        activeProviderConcurrency: this.activeProviderConcurrency,
        signalAborted: this.input.signal?.aborted ?? false,
        observedAt: new Date().toISOString(),
        ...fields
      };
      this.sink(event);
    } catch {
      // Diagnostics are observation-only and must never affect Provider behavior.
    }
  }

  stage(stage: SSSTwitterDiagnosticStage, fields: Record<string, unknown> = {}): void {
    this.emit("stage", { stage, ...fields });
  }

  failure(failedAtStage: SSSTwitterDiagnosticStage, error: unknown): void {
    const providerError = error instanceof ProviderError ? error : null;
    this.emit("stage", {
      stage: "resolve_failure",
      failedAtStage,
      failureCode: providerError?.failureCode ?? "internal_error",
      retryable: providerError?.retryable ?? true,
      fallbackAllowed: providerError?.fallbackAllowed ?? true,
      message: sanitizedProviderMessage(error)
    });
  }

  finish(): void {
    this.finished = true;
  }

  private onRequest(observation: ProviderHttpRequestObservation): void {
    if (this.finished) return;
    this.requestOrdinal += 1;
    const headers = observation.headers;
    const requestUrl = new URL(observation.url);
    const origin = safeUrl(headerValue(headers, "origin"));
    const referer = safeUrl(headerValue(headers, "referer"));
    const cookie = headerValue(headers, "cookie");
    const body = typeof observation.body === "string"
      ? observation.body
      : observation.body instanceof URLSearchParams
        ? observation.body.toString()
        : null;
    const bodyFields = body === null ? [] : sortedNames(new URLSearchParams(body).keys());
    this.emit("http_request", {
      requestOrdinal: this.requestOrdinal,
      method: observation.method,
      hostname: requestUrl.hostname.toLowerCase(),
      pathname: requestUrl.pathname,
      queryParameterNames: queryNames(requestUrl),
      userAgentPresent: headerValue(headers, "user-agent") !== null,
      accept: headerValue(headers, "accept"),
      contentType: headerValue(headers, "content-type"),
      hxRequest: headerValue(headers, "hx-request"),
      hxTarget: headerValue(headers, "hx-target"),
      originHostname: origin.hostname,
      refererHostname: referer.hostname,
      refererPathname: referer.pathname,
      cookiePresent: cookie !== null,
      cookieNames: cookieNames(cookie),
      cookieCount: cookieNames(cookie).length,
      cookieHeaderLength: cookie?.length ?? 0,
      bodyFieldNames: bodyFields,
      tokenFields: tokenSummaries(body)
    });
  }

  private onResponse(observation: ProviderHttpResponseObservation): void {
    if (this.finished) return;
    const responseUrl = new URL(observation.responseUrl ?? observation.requestUrl);
    const location = safeUrl(observation.headers.get("location"), observation.requestUrl);
    const cookies = setCookieNames(observation.headers);
    this.emit("http_response", {
      requestOrdinal: this.requestOrdinal,
      status: observation.status,
      hostname: responseUrl.hostname.toLowerCase(),
      pathname: responseUrl.pathname,
      queryParameterNames: queryNames(responseUrl),
      contentType: observation.headers.get("content-type"),
      declaredContentLength: observation.headers.get("content-length"),
      locationPresent: observation.headers.has("location"),
      locationHostname: location.hostname,
      locationPathname: location.pathname,
      setCookieNames: cookies,
      setCookieCount: cookies.length
    });
  }

  private onBody(observation: ProviderHttpBodyObservation): void {
    if (this.finished) return;
    const body = observation.body;
    this.emit("body_summary", {
      requestOrdinal: this.requestOrdinal,
      actualUtf8ByteLength: Buffer.byteLength(body, "utf8"),
      bodySha256: sha256(body),
      hasForm: /<form\b/i.test(body),
      hasIncludeVals: /(?:data-)?include-vals\s*=/i.test(body),
      hasResultId: /\bid=(?:"result"|'result'|result)(?:\s|>)/i.test(body),
      resultIdCount: [...body.matchAll(/\bid=(?:"result"|'result'|result)(?:\s|>)/gi)].length,
      hasResultNormalReference: /result_normal/i.test(body),
      hasSsscdnMarker: /\bssscdn\.io\b/i.test(body),
      hasChallengeMarker: /attention required|cf-turnstile|challenge-platform/i.test(body),
      hasBlockedMarker: /sorry, you have been blocked|access denied/i.test(body)
    });
  }
}

export class SSSTwitterDiagnosticTrace {
  private emittedInvocations = 0;

  constructor(
    private readonly configuration: SSSTwitterDiagnosticTraceConfiguration,
    private readonly sink: SSSTwitterDiagnosticTraceSink
  ) {}

  tryStart(input: {
    providerId: string;
    region: string;
    resolveInput: ResolveInput;
    activeProviderConcurrency: number;
  }): SSSTwitterDiagnosticTraceInvocation | null {
    if (
      !this.configuration.enabled ||
      input.providerId !== "ssstwitter" ||
      input.region !== "nl" ||
      input.resolveInput.platform !== "x" ||
      this.configuration.region !== "nl" ||
      sha256(input.resolveInput.canonicalUrl) !== this.configuration.canonicalSha256 ||
      !AUTHORIZATION_ID_PATTERN.test(this.configuration.authorizationId) ||
      this.emittedInvocations >= Math.min(this.configuration.maximumInvocations, 2)
    ) {
      return null;
    }
    this.emittedInvocations += 1;
    return new SSSTwitterDiagnosticTraceInvocation(
      this.configuration,
      this.sink,
      input.resolveInput,
      this.emittedInvocations,
      input.activeProviderConcurrency
    );
  }
}

export function createSSSTwitterDiagnosticTraceFromEnvironment(options: {
  environment?: NodeJS.ProcessEnv;
  production: boolean;
  region: string;
  sink: SSSTwitterDiagnosticTraceSink;
}): SSSTwitterDiagnosticTrace {
  return new SSSTwitterDiagnosticTrace(
    loadSSSTwitterDiagnosticTraceConfiguration(options.environment ?? process.env, {
      production: options.production,
      region: options.region
    }),
    options.sink
  );
}
