import { isIP } from "node:net";
import { z } from "zod";
import type { Platform, ProviderFailureCode } from "@tikdd/contracts";
import { ProviderResolutionSchema } from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import { createRedirectResolution, type ParsedFormat, type ProviderFetch } from "./shared";

const SUPPORTED_PLATFORMS = [
  "odnoklassniki",
  "x",
  "instagram",
  "tiktok",
  "facebook",
  "pinterest",
  "vimeo"
] as const;
type CobaltPlatform = (typeof SUPPORTED_PLATFORMS)[number];

const DELIVERY_POLICY_IDS: Record<CobaltPlatform, string> = {
  odnoklassniki: "cobalt-selfhosted-okru-media-v1",
  x: "cobalt-selfhosted-x-media-v1",
  instagram: "cobalt-selfhosted-instagram-media-v1",
  tiktok: "cobalt-selfhosted-tiktok-media-v1",
  facebook: "cobalt-selfhosted-facebook-media-v1",
  pinterest: "cobalt-selfhosted-pinterest-media-v1",
  vimeo: "cobalt-selfhosted-vimeo-media-v1"
};

const MAXIMUM_RESPONSE_BYTES = 512_000;
const MAXIMUM_MEDIA_URL_LENGTH = 8_192;
const MAXIMUM_FORMATS = 12;
const REQUEST_TIMEOUT_MS = 15_000;
const MAXIMUM_CANDIDATE_LIFETIME_MS = 2 * 60 * 1_000;
const API_KEY_MAXIMUM_LENGTH = 512;

const PickerItemSchema = z.object({
  type: z.string().max(32).nullish(),
  url: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish(),
  thumb: z.string().max(4_096).nullish(),
  filename: z.string().max(300).nullish(),
  quality: z.string().max(80).nullish()
}).passthrough();

const CobaltResponseSchema = z.object({
  status: z.enum(["tunnel", "local-processing", "redirect", "picker", "error"]),
  url: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish(),
  filename: z.string().max(300).nullish(),
  picker: z.array(PickerItemSchema).max(50).nullish(),
  tunnels: z.array(z.object({ url: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish() }).passthrough()).max(50).nullish(),
  error: z.object({
    code: z.string().max(160).nullish(),
    context: z.unknown().nullish()
  }).passthrough().nullish()
}).passthrough();

export interface CobaltProviderOptions {
  enabled?: boolean;
  apiUrl?: string;
  apiKey?: string;
  fetchImpl?: ProviderFetch;
  diagnosticSink?: (event: CobaltDiagnosticEvent) => void;
  approvedPlatforms?: readonly Platform[];
  deliveryVerifiedPlatforms?: readonly Platform[];
}

export interface CobaltPlatformConfiguration {
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedPlatforms: readonly Platform[];
}

export type CobaltDiagnosticPhase = "request" | "response" | "parse" | "completed";

export interface CobaltDiagnosticEvent {
  event: "cobalt_resolution_diagnostic";
  taskId: string;
  platform: Platform;
  phase: CobaltDiagnosticPhase;
  outcome: "success" | "failure";
  httpStatus: number | null;
  responseStatus: string | null;
  candidateCount: number | null;
  validMediaCount: number;
  rejectedCount: number;
  failureCode: ProviderFailureCode | null;
  durationMs: number;
}

export function parseCobaltPlatformConfiguration(input: {
  approvedPlatforms?: string | undefined;
  deliveryVerifiedPlatforms?: string | undefined;
}): CobaltPlatformConfiguration {
  const parse = (value: string | undefined, variableName: string): Platform[] =>
    (value ?? SUPPORTED_PLATFORMS.join(","))
      .split(",")
      .map((platform) => platform.trim())
      .filter((platform, index, platforms) => platform.length > 0 && platforms.indexOf(platform) === index)
      .map((platform) => {
        if (!SUPPORTED_PLATFORMS.includes(platform as CobaltPlatform)) {
          throw new Error(`${variableName} contains unsupported platform: ${platform}.`);
        }
        return platform as Platform;
      });
  const approvedPlatforms = parse(input.approvedPlatforms, "COBALT_APPROVED_PLATFORMS");
  const deliveryVerifiedPlatforms = input.deliveryVerifiedPlatforms === undefined
    ? []
    : parse(input.deliveryVerifiedPlatforms, "COBALT_DELIVERY_VERIFIED_PLATFORMS");
  if (deliveryVerifiedPlatforms.some((platform) => !approvedPlatforms.includes(platform))) {
    throw new Error("COBALT_DELIVERY_VERIFIED_PLATFORMS must be a subset of COBALT_APPROVED_PLATFORMS.");
  }
  return { approvedPlatforms, deliveryVerifiedPlatforms };
}

function failureCode(error: unknown): ProviderFailureCode {
  if (error instanceof ProviderError) return error.failureCode;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "provider_timeout";
  }
  return "internal_error";
}

function safeApiOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("COBALT_API_URL must be a valid URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["cobalt-api", "localhost", "127.0.0.1"].includes(url.hostname.toLowerCase())
  ) {
    throw new Error("COBALT_API_URL must point to the isolated Cobalt service.");
  }
  url.pathname = "/";
  return url;
}

function reviewedMediaUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAXIMUM_MEDIA_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "cobalt-api" || isIP(hostname) !== 0) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isAudioUrl(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return /\.(?:m4a|mp3|aac|opus|ogg|wav)$/.test(path);
}

function qualityLabel(value: string | null | undefined, url: string): string {
  const source = `${value ?? ""} ${url}`;
  return source.match(/\b(\d{3,4}p)\b/i)?.[1] ?? "Source";
}

function cleanTitle(value: string | null | undefined): string | null {
  const title = value?.replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 300) : null;
}

function mapCobaltError(code: string | null | undefined): never {
  const normalized = code?.toLowerCase() ?? "";
  if (/auth|api.key|jwt/.test(normalized)) {
    throw new ProviderError("The Cobalt service requires authentication.", "authentication_required", false, false);
  }
  if (/rate|limit|too.many/.test(normalized)) {
    throw new ProviderError("The Cobalt service is temporarily rate limited.", "provider_rate_limited", true, true);
  }
  if (/private|login|blocked|restricted/.test(normalized)) {
    throw new ProviderError("This media is private or restricted.", "content_private", false, false);
  }
  if (/invalid|unsupported|service/.test(normalized)) {
    throw new ProviderError("Cobalt does not support this URL.", "unsupported_url", false, true);
  }
  throw new ProviderError("Cobalt could not resolve this URL.", "provider_unavailable", true, true);
}

export function parseCobaltResponse(body: string, httpStatus = 200): {
  title: string | null;
  formats: ParsedFormat[];
} {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ProviderError("Cobalt returned invalid JSON.", "provider_schema_changed", true, true);
  }
  const parsed = CobaltResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProviderError("Cobalt response schema changed.", "provider_schema_changed", true, true);
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    if (httpStatus === 401) {
      throw new ProviderError("The Cobalt service requires authentication.", "authentication_required", false, false);
    }
    if (httpStatus === 429) {
      throw new ProviderError("The Cobalt service is temporarily rate limited.", "provider_rate_limited", true, true);
    }
    throw new ProviderError("The Cobalt service returned an unsuccessful response.", "provider_unavailable", true, true);
  }
  if (parsed.data.status === "error") mapCobaltError(parsed.data.error?.code);
  if (parsed.data.status === "tunnel" || parsed.data.status === "local-processing") {
    throw new ProviderError("Cobalt returned a non-portable processing result.", "unsupported_url", false, true);
  }

  const formats: ParsedFormat[] = [];
  const seen = new Set<string>();
  const candidates = parsed.data.status === "redirect"
    ? [{ url: parsed.data.url, filename: parsed.data.filename, type: "video", quality: null }]
    : (parsed.data.picker ?? []).map((item) => ({
      url: item.url,
      filename: item.filename,
      type: item.type,
      quality: item.quality
    }));
  for (const candidate of candidates) {
    const url = reviewedMediaUrl(candidate.url);
    if (!url || candidate.type?.toLowerCase() === "audio" || isAudioUrl(url) || seen.has(url)) continue;
    seen.add(url);
    formats.push({
      url,
      label: `${qualityLabel(candidate.quality ?? candidate.filename, url)} MP4`,
      quality: qualityLabel(candidate.quality ?? candidate.filename, url),
      container: "mp4",
      hasVideo: true,
      hasAudio: true
    });
    if (formats.length >= MAXIMUM_FORMATS) break;
  }
  if (formats.length === 0) {
    throw new ProviderError("Cobalt returned no portable video resource.", "invalid_result", false, true);
  }
  return {
    title: cleanTitle(parsed.data.filename),
    formats
  };
}

export class CobaltProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly apiOrigin: URL;
  private readonly apiKey: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: CobaltDiagnosticEvent) => void) | null;
  private readonly approvedPlatforms: ReadonlySet<string>;
  private readonly deliveryVerifiedPlatforms: ReadonlySet<string>;

  constructor(options: CobaltProviderOptions = {}) {
    this.apiOrigin = safeApiOrigin(options.apiUrl ?? "http://cobalt-api:9000/");
    this.apiKey = options.apiKey?.trim() ?? "";
    if (this.apiKey.length > API_KEY_MAXIMUM_LENGTH) throw new Error("COBALT_API_KEY is too long.");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    const configuration = {
      approvedPlatforms: options.approvedPlatforms ?? SUPPORTED_PLATFORMS,
      deliveryVerifiedPlatforms: options.deliveryVerifiedPlatforms ?? []
    };
    this.approvedPlatforms = new Set(configuration.approvedPlatforms);
    this.deliveryVerifiedPlatforms = new Set(configuration.deliveryVerifiedPlatforms);
    if ([...this.deliveryVerifiedPlatforms].some((platform) => !this.approvedPlatforms.has(platform))) {
      throw new Error("Cobalt delivery verified platforms must be approved platforms.");
    }
    this.manifest = {
      id: "cobalt-selfhosted",
      displayName: "Cobalt (self-hosted)",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: REQUEST_TIMEOUT_MS,
      costWeight: 80,
      platforms: SUPPORTED_PLATFORMS.map((platform) => ({
        platform,
        priority: platform === "odnoklassniki" ? 500 : 450,
        deliveryModes: this.deliveryVerifiedPlatforms.has(platform) ? ["redirect"] : [],
        verificationStatus: this.deliveryVerifiedPlatforms.has(platform) ? "delivery_verified" : "fixture_verified"
      }))
    };
  }

  async resolve(input: ResolveInput) {
    const platform = input.platform as CobaltPlatform;
    if (!SUPPORTED_PLATFORMS.includes(platform) || !this.approvedPlatforms.has(input.platform)) {
      throw new ProviderError("Cobalt is not approved for this platform.", "unsupported_url", false, true);
    }
    if (!this.deliveryVerifiedPlatforms.has(input.platform)) {
      throw new ProviderError("Cobalt delivery is not verified for this platform.", "unsupported_url", false, true);
    }
    if (!this.apiKey) {
      throw new ProviderError("The Cobalt service key is not configured.", "authentication_required", false, false);
    }

    const startedAt = Date.now();
    let phase: CobaltDiagnosticPhase = "request";
    let httpStatus: number | null = null;
    let responseStatus: string | null = null;
    let candidateCount: number | null = null;
    let validMediaCount = 0;
    let rejectedCount = 0;
    const emit = (outcome: CobaltDiagnosticEvent["outcome"], code: ProviderFailureCode | null) => {
      try {
        this.diagnosticSink?.({
          event: "cobalt_resolution_diagnostic",
          taskId: input.taskId,
          platform: input.platform,
          phase,
          outcome,
          httpStatus,
          responseStatus,
          candidateCount,
          validMediaCount,
          rejectedCount,
          failureCode: code,
          durationMs: Math.max(0, Date.now() - startedAt)
        });
      } catch {
        // Diagnostics must never affect provider behavior.
      }
    };

    const controller = new AbortController();
    const abort = () => controller.abort();
    if (input.signal?.aborted) controller.abort();
    input.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      phase = "request";
      const response = await this.fetchImpl(new URL("/", this.apiOrigin), {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Api-Key ${this.apiKey}`,
          "user-agent": "TikDD/cobalt-secondary"
        },
        body: JSON.stringify({
          url: input.canonicalUrl,
          videoQuality: "1080",
          downloadMode: "auto",
          filenameStyle: "basic",
          alwaysProxy: false,
          localProcessing: "disabled"
        })
      });
      httpStatus = response.status;
      phase = "response";
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        throw new ProviderError("Cobalt returned an unexpected redirect.", "provider_schema_changed", true, true);
      }
      const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
      if (Number.isFinite(contentLength) && contentLength > MAXIMUM_RESPONSE_BYTES) {
        throw new ProviderError("Cobalt returned an oversized response.", "provider_schema_changed", true, true);
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAXIMUM_RESPONSE_BYTES) {
        throw new ProviderError("Cobalt returned an oversized response.", "provider_schema_changed", true, true);
      }
      const body = new TextDecoder().decode(bytes);
      phase = "parse";
      const parsed = parseCobaltResponse(body, response.status);
      const raw = JSON.parse(body) as { status?: string; picker?: unknown[] };
      responseStatus = typeof raw.status === "string" ? raw.status : null;
      candidateCount = Array.isArray(raw.picker) ? raw.picker.length : parsed.formats.length;
      validMediaCount = parsed.formats.length;
      rejectedCount = Math.max(0, (candidateCount ?? 0) - validMediaCount);
      phase = "completed";
      emit("success", null);
      return ProviderResolutionSchema.parse(createRedirectResolution(
        this.manifest.id,
        this.manifest.kind,
        input,
        {
          ...parsed,
          thumbnailUrl: null,
          warnings: [`Cobalt is a self-hosted experimental ${input.platform} secondary Provider.`]
        },
        {
          hostPolicyId: DELIVERY_POLICY_IDS[platform],
          maximumLifetimeMs: MAXIMUM_CANDIDATE_LIFETIME_MS
        }
      ));
    } catch (error) {
      emit("failure", failureCode(error));
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new ProviderError("Cobalt timed out.", "provider_timeout", true, true);
      }
      throw new ProviderError("Cobalt could not be reached.", "provider_unavailable", true, true);
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
    }
  }
}
