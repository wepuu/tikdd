import type { Platform, ProviderFailureCode } from "@tikdd/contracts";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import {
  createRedirectResolution,
  requestText,
  reviewedThumbnailUrl,
  type ParsedFormat,
  type ProviderFetch
} from "./shared";

const LANDING_ORIGIN = "https://9xbuddy.com";
const LANDING_HOST = "9xbuddy.com";
const API_ORIGIN = "https://ab.9xbud.com";
const API_HOSTS = new Set([LANDING_HOST, "ab.9xbud.com"]);
const MEDIA_HOST = "ab.9xbud.com";
const MEDIA_POLICY_ID = "9xbuddy-xhamster-artifact-v1";
const MAXIMUM_CANDIDATE_LIFETIME_MS = 5 * 60 * 1_000;
const MAXIMUM_RESPONSE_BYTES = 512 * 1024;
const PROVIDER_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_PROGRESS_POLLS = 15;
const SUPPORTED_PLATFORMS = ["xhamster", "dailymotion"] as const;

type NineXBuddyPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export type NineXBuddyDiagnosticPhase =
  | "bootstrap"
  | "token"
  | "extract"
  | "inspect"
  | "prepare"
  | "progress"
  | "completed";

export interface NineXBuddyDiagnosticEvent {
  event: "nine_x_buddy_resolution_diagnostic";
  taskId: string;
  platform: Platform;
  phase: NineXBuddyDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  formatCount: number;
  prepared: boolean;
  progressPolls: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

export interface NineXBuddyProviderOptions {
  enabled?: boolean;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: NineXBuddyDiagnosticEvent) => void;
  approvedPlatforms?: readonly Platform[];
  deliveryVerifiedPlatforms?: readonly Platform[];
  maxConcurrency?: number;
  minIntervalMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
}

interface Bootstrap {
  apiBase: string;
  appVersion: string;
  userAgentSeed: string;
  cssHash: string;
  cookie: string;
}

interface JsonResponse {
  payload: Record<string, unknown>;
  status: number;
  contentType: string;
}

interface DownloadDescriptor {
  uid: string;
  url: string;
}

const DELIVERY_POLICY_PLATFORMS = new Set<Platform>(["xhamster"]);

function contentTypeCategory(headers: Headers): string {
  return headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "missing";
}

function diagnosticFailureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

function parseObjectFromAssignment(body: string, marker: string): Record<string, unknown> | null {
  const markerIndex = body.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = body.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < body.length; index += 1) {
    const character = body[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(body.slice(start, index + 1)) as unknown;
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function stringValue(value: unknown, maximumLength: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength ? value : null;
}

function parseBootstrap(body: string, cookie: string): Bootstrap {
  const init = parseObjectFromAssignment(body, "window.__INIT__");
  const cssHash = body.match(/\/build\/(?:assets\/)?main\.([A-Za-z0-9_-]+?)\.css/)?.[1] ?? null;
  const apiBase = stringValue(init?.apiBase, 256);
  const appVersion = stringValue(init?.appVersion, 64);
  const userAgentSeed = stringValue(init?.ua, 512);
  if (!init || !cssHash || !apiBase || !appVersion || !userAgentSeed) {
    throw new ProviderError("9xBuddy bootstrap data changed.", "provider_schema_changed", true, true);
  }
  let apiUrl: URL;
  try {
    apiUrl = new URL(apiBase);
  } catch {
    throw new ProviderError("9xBuddy returned an invalid API origin.", "provider_schema_changed", true, true);
  }
  if (apiUrl.protocol !== "https:" || apiUrl.hostname !== "ab.9xbud.com" || apiUrl.pathname !== "/") {
    throw new ProviderError("9xBuddy returned an unreviewed API origin.", "provider_schema_changed", true, true);
  }
  return { apiBase: apiUrl.toString().replace(/\/$/, ""), appVersion, userAgentSeed, cssHash, cookie };
}

function jsSubstrCharacter(value: string, index: number): string {
  return value.substr(index, 1);
}

function encodeNineXBuddy(value: string, key: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const keyCharacter = jsSubstrCharacter(key, (index % key.length) - 1);
    if (!keyCharacter) throw new Error("9xBuddy token key is empty.");
    bytes.push(value.charCodeAt(index) + keyCharacter.charCodeAt(0));
  }
  return Buffer.from(bytes).toString("base64");
}

function decodeNineXBuddy(value: string, key: string): string {
  const bytes = Buffer.from(value, "base64");
  const output: string[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    const keyCharacter = jsSubstrCharacter(key, (index % key.length) - 1);
    if (!keyCharacter) throw new Error("9xBuddy decode key is empty.");
    output.push(String.fromCharCode(bytes[index]! - keyCharacter.charCodeAt(0)));
  }
  return output.join("");
}

export function createNineXBuddyAuthToken(bootstrap: Pick<Bootstrap, "appVersion" | "userAgentSeed" | "cssHash">): string {
  const staticValues = [90, 84, 94, 100, 81, 81, 74, 89, 100, 70, 83, 83, 84, 76, 100, 89, 84, 83, 100, 82, 78, 100, 74, 89, 70, 82, 100, 94, 87, 87, 84, 88]
    .map((value) => String.fromCharCode(value - 5))
    .join("")
    .split("")
    .reverse()
    .join("");
  const cssKey = bootstrap.cssHash.split("").reverse().join("");
  const input = `${LANDING_HOST}${cssKey}${bootstrap.userAgentSeed.split("").reverse().join("").slice(0, 10)}${staticValues}xbuddy123sudo-${bootstrap.appVersion}${bootstrap.appVersion}`;
  return encodeNineXBuddy(input, cssKey);
}

function decodeMediaDescriptor(value: unknown, responseToken: string, cssHash: string): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 32_768 || !/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) {
    return null;
  }
  try {
    const reversedBytes = Buffer.from(value, "hex").toString("latin1").split("").reverse().join("");
    const decoded = decodeNineXBuddy(
      Buffer.from(reversedBytes, "latin1").toString("base64"),
      `SORRY_MATE${LANDING_HOST.length}${cssHash}${responseToken}`
    );
    return decoded.startsWith("/download/") ? decoded : null;
  } catch {
    return null;
  }
}

function responseRecord(payload: Record<string, unknown>): Record<string, unknown> {
  const response = payload.response;
  return response && typeof response === "object" && !Array.isArray(response)
    ? response as Record<string, unknown>
    : payload;
}

function parseJsonResponse(response: { body: string; response: Response }): JsonResponse {
  let payload: unknown;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new ProviderError("9xBuddy returned an invalid JSON response.", "provider_schema_changed", true, true);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProviderError("9xBuddy returned an invalid response.", "provider_schema_changed", true, true);
  }
  return {
    payload: payload as Record<string, unknown>,
    status: response.response.status,
    contentType: contentTypeCategory(response.response.headers)
  };
}

function descriptorFromPath(value: string): DownloadDescriptor | null {
  const match = /^\/download\/([^/]+)\/(.+)$/.exec(value);
  if (!match?.[1] || !match[2]) return null;
  try {
    return { uid: decodeURIComponent(match[1]), url: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

function reviewedArtifactUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 16_384) return null;
  try {
    const url = new URL(value, API_ORIGIN);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== MEDIA_HOST || url.username || url.password || url.port) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function qualityNumber(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "").match(/\d{3,4}/)?.[0] ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectFormat(formats: readonly Record<string, unknown>[]): Record<string, unknown> | null {
  const mp4 = formats.filter((format) => String(format.ext ?? "").toLowerCase() === "mp4");
  if (mp4.length === 0) return null;
  return [...mp4].sort((left, right) => {
    const leftQuality = qualityNumber(left.quality);
    const rightQuality = qualityNumber(right.quality);
    const leftDistance = Math.abs(leftQuality - 720);
    const rightDistance = Math.abs(rightQuality - 720);
    return leftDistance - rightDistance || rightQuality - leftQuality;
  })[0] ?? null;
}

function providerFailure(message: string, code: ProviderFailureCode, retryable = true, fallbackAllowed = true): ProviderError {
  return new ProviderError(message, code, retryable, fallbackAllowed);
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    if (signal.aborted) {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("The provider request was aborted."));
      return;
    }
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("The provider request was aborted."));
    }, { once: true });
  });
}

export function parseNineXBuddyResponse(
  body: string,
  cssHash: string
): { title: string | null; thumbnailUrl: string | null; descriptor: DownloadDescriptor; quality: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw providerFailure("9xBuddy returned an invalid extraction response.", "provider_schema_changed");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw providerFailure("9xBuddy returned an invalid extraction response.", "provider_schema_changed");
  }
  const root = payload as Record<string, unknown>;
  const message = String(root.message ?? root.error ?? "");
  if (/private|login|authentication/i.test(message)) {
    throw providerFailure("The xHamster media is private or requires authentication.", "content_private", false, false);
  }
  if (/invalid\s+(?:url|link)|malformed/i.test(message)) {
    throw providerFailure("9xBuddy rejected the URL.", "invalid_url", false, false);
  }
  if (/not\s*found|deleted|removed/i.test(message)) {
    throw providerFailure("The xHamster media is unavailable.", "content_not_found", false, false);
  }
  if (/unsupported/i.test(message)) {
    throw providerFailure("9xBuddy does not support this URL.", "unsupported_url", false, false);
  }
  const response = responseRecord(root);
  const responseToken = stringValue(response.token, 32_768);
  const formats = Array.isArray(response.formats)
    ? response.formats.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    : [];
  if (!responseToken || formats.length === 0) {
    throw providerFailure("9xBuddy returned no downloadable formats.", "unsupported_url", false, true);
  }
  const selected = selectFormat(formats);
  const descriptorPath = selected ? decodeMediaDescriptor(selected.url, responseToken, cssHash) : null;
  const descriptor = descriptorPath ? descriptorFromPath(descriptorPath) : null;
  if (!descriptor) {
    throw providerFailure("9xBuddy returned no prepared MP4 descriptor.", "unsupported_url", false, true);
  }
  return {
    title: stringValue(response.title, 1_000),
    thumbnailUrl: reviewedThumbnailUrl(response.thumbnail, new Set([LANDING_HOST, MEDIA_HOST])),
    descriptor,
    quality: stringValue(selected?.quality, 80) ?? "720"
  };
}

export class NineXBuddyProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly fetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: NineXBuddyDiagnosticEvent) => void) | null;
  private readonly approvedPlatforms: ReadonlySet<Platform>;
  private readonly deliveryVerifiedPlatforms: ReadonlySet<Platform>;
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly pollIntervalMs: number;
  private activeRequests = 0;
  private lastRequestAt = 0;

  constructor(options: NineXBuddyProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.approvedPlatforms = new Set(options.approvedPlatforms ?? ["xhamster"]);
    this.deliveryVerifiedPlatforms = new Set(options.deliveryVerifiedPlatforms ?? ["xhamster"]);
    this.maxConcurrency = Math.max(1, Math.min(4, Math.floor(options.maxConcurrency ?? 1)));
    this.minIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.minIntervalMs ?? 2_000)));
    this.now = options.now ?? Date.now;
    this.pollIntervalMs = Math.max(0, Math.min(60_000, Math.floor(options.pollIntervalMs ?? POLL_INTERVAL_MS)));
    const unsupported = [...new Set([...this.approvedPlatforms, ...this.deliveryVerifiedPlatforms])]
      .find((platform) => !SUPPORTED_PLATFORMS.includes(platform as NineXBuddyPlatform));
    if (unsupported) throw new Error(`9xBuddy does not support the configured platform: ${unsupported}.`);
    if ([...this.deliveryVerifiedPlatforms].some((platform) => !DELIVERY_POLICY_PLATFORMS.has(platform))) {
      throw new Error("9xBuddy has no reviewed Delivery policy for the configured platform.");
    }
    if ([...this.deliveryVerifiedPlatforms].some((platform) => !this.approvedPlatforms.has(platform))) {
      throw new Error("9xBuddy delivery-verified platforms must be a subset of approved platforms.");
    }
    const capability = (platform: NineXBuddyPlatform) => ({
      platform,
      priority: platform === "xhamster" ? 700 : 300,
      deliveryModes: (this.deliveryVerifiedPlatforms.has(platform) ? ["redirect"] : []) as ("redirect" | "proxy" | "temporary-object")[],
      verificationStatus: this.deliveryVerifiedPlatforms.has(platform) ? "delivery_verified" as const : "fixture_verified" as const
    });
    this.manifest = {
      id: "9xbuddy",
      displayName: "9xBuddy",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: PROVIDER_TIMEOUT_MS,
      costWeight: 70,
      platforms: [capability("xhamster"), capability("dailymotion")]
    };
  }

  async resolve(input: ResolveInput) {
    if (!SUPPORTED_PLATFORMS.includes(input.platform as NineXBuddyPlatform) || !this.approvedPlatforms.has(input.platform)) {
      throw providerFailure("9xBuddy is not approved for this platform.", "unsupported_url", false, true);
    }
    if (!this.deliveryVerifiedPlatforms.has(input.platform)) {
      throw providerFailure("9xBuddy has no reviewed Delivery policy for this platform.", "unsupported_url", false, true);
    }
    const now = this.now();
    if (this.activeRequests >= this.maxConcurrency || (this.lastRequestAt > 0 && now < this.lastRequestAt + this.minIntervalMs)) {
      throw providerFailure("9xBuddy is temporarily rate limited.", "provider_rate_limited", true, true);
    }
    this.activeRequests += 1;
    this.lastRequestAt = now;
    const startedAt = Date.now();
    let phase: NineXBuddyDiagnosticPhase = "bootstrap";
    let httpStatus: number | null = null;
    let formatCount = 0;
    let prepared = false;
    let progressPolls = 0;
    const emit = (outcome: NineXBuddyDiagnosticEvent["outcome"], failureCode: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "nine_x_buddy_resolution_diagnostic",
          taskId: input.taskId,
          platform: input.platform,
          phase,
          outcome,
          httpStatus,
          formatCount,
          prepared,
          progressPolls,
          failureCode,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      } catch {
        // Diagnostics must never affect Provider behavior.
      }
    };
    try {
      const landingUrl = new URL("/", LANDING_ORIGIN);
      const landing = await requestText(this.fetchImpl, landingUrl, {
        method: "GET",
        redirect: "manual",
        ...(input.signal ? { signal: input.signal } : {}),
        headers: { accept: "text/html,application/xhtml+xml" }
      }, new Set([LANDING_HOST]), { maximumBytes: MAXIMUM_RESPONSE_BYTES });
      const bootstrap = parseBootstrap(landing.body, landing.cookie);
      const authToken = createNineXBuddyAuthToken(bootstrap);
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json; charset=UTF-8",
        origin: LANDING_ORIGIN,
        referer: landingUrl.toString(),
        "x-requested-with": "xmlhttprequest",
        "x-auth-token": authToken,
        "x-requested-domain": LANDING_HOST,
        ...(bootstrap.cookie ? { cookie: bootstrap.cookie } : {})
      };
      const apiRequest = async (path: string, body: Record<string, unknown>, requestPhase: NineXBuddyDiagnosticPhase): Promise<JsonResponse> => {
        phase = requestPhase;
        const result = await requestText(this.fetchImpl, new URL(path, `${bootstrap.apiBase}/`), {
          method: "POST",
          redirect: "manual",
          ...(input.signal ? { signal: input.signal } : {}),
          headers,
          body: JSON.stringify(body)
        }, API_HOSTS, {
          maximumBytes: MAXIMUM_RESPONSE_BYTES,
          expectedContentTypes: ["application/json"],
          maximumRedirects: 0,
          allowNonOk: true,
          observer: { onResponse: (observation) => { httpStatus = observation.status; } }
        });
        return parseJsonResponse(result);
      };
      const tokenResponse = await apiRequest("/token", {}, "token");
      const accessToken = stringValue(tokenResponse.payload.access_token, 64);
      if (!("status" in tokenResponse.payload) || !accessToken) {
        throw providerFailure("9xBuddy did not grant an access token.", "provider_challenge", true, true);
      }
      headers["x-access-token"] = accessToken;
      const encodedUrl = encodeURIComponent(input.canonicalUrl);
      const signature = encodeNineXBuddy(encodedUrl, `${authToken}jv7g2_DAMNN_DUDE`);
      const extractResponse = await apiRequest("/extract", { url: encodedUrl, _sig: signature }, "extract");
      const parsed = parseNineXBuddyResponse(JSON.stringify(extractResponse.payload), bootstrap.cssHash);
      const responseRecordValue = responseRecord(extractResponse.payload);
      formatCount = Array.isArray(responseRecordValue.formats) ? responseRecordValue.formats.length : 0;
      const inspect = await apiRequest("/download", { uid: parsed.descriptor.uid, url: parsed.descriptor.url, mode: "inspect" }, "inspect");
      let activeUid = stringValue(inspect.payload.uid, 256) ?? parsed.descriptor.uid;
      let preparedResponse = inspect.payload;
      if (inspect.payload.state === "choice_required") {
        preparedResponse = (await apiRequest("/download", {
          uid: parsed.descriptor.uid,
          url: parsed.descriptor.url,
          mode: "prepare"
        }, "prepare")).payload;
        activeUid = stringValue(preparedResponse.uid, 256) ?? activeUid;
      }
      let finalUrl = reviewedArtifactUrl(preparedResponse.url);
      while (!finalUrl && progressPolls < MAX_PROGRESS_POLLS) {
        await delay(this.pollIntervalMs, input.signal);
        const progress = await apiRequest("/progress", { uid: activeUid }, "progress");
        progressPolls += 1;
        const progressRecord = progress.payload.progress && typeof progress.payload.progress === "object"
          ? progress.payload.progress as Record<string, unknown>
          : null;
        const response = progress.payload.response && typeof progress.payload.response === "object"
          ? progress.payload.response as Record<string, unknown>
          : null;
        finalUrl = reviewedArtifactUrl(response?.url ?? progress.payload.url);
        if (finalUrl) break;
        const message = stringValue(progress.payload.message ?? progress.payload.error, 200);
        const state = stringValue(progressRecord?.phase ?? progress.payload.state, 80);
        if (message || state === "failed" || state === "cancelled") {
          throw providerFailure("9xBuddy conversion did not complete.", "provider_unavailable", true, true);
        }
      }
      if (!finalUrl) {
        await apiRequest("/cancel", { uid: activeUid }, "progress").catch(() => undefined);
        throw providerFailure("9xBuddy conversion timed out.", "provider_timeout", true, true);
      }
      prepared = true;
      phase = "completed";
      emit("success", null);
      const formats: ParsedFormat[] = [{
        url: finalUrl,
        label: `${parsed.quality}p MP4`,
        quality: `${parsed.quality}p`,
        container: "mp4",
        hasVideo: true,
        hasAudio: true
      }];
      return createRedirectResolution(this.manifest.id, this.manifest.kind, input, {
        title: parsed.title,
        thumbnailUrl: parsed.thumbnailUrl,
        formats,
        warnings: ["9xBuddy prepares an MP4 artifact on its own service before browser delivery."]
      }, { hostPolicyId: MEDIA_POLICY_ID, maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS });
    } catch (error) {
      emit("failure", diagnosticFailureCode(error));
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw providerFailure("9xBuddy timed out.", "provider_timeout", true, true);
      }
      throw providerFailure("9xBuddy could not be reached.", "provider_unavailable", true, true);
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
    }
  }
}
