import { isIP } from "node:net";
import { z } from "zod";
import type {
  DeliveryClientProcessingPlan,
  Platform,
  ProviderDeliveryMode,
  ProviderFailureCode
} from "@tikdd/contracts";
import {
  assertDeliveryTargetPolicy,
  ProviderResolutionSchema,
  type DeliveryCandidateInput,
  type ProviderResolution
} from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import { createResolveResult, type ParsedFormat, type ProviderFetch } from "./shared";
import {
  resolveTikTokThumbnail,
  type TikTokThumbnailDiagnosticEvent
} from "./tiktok-thumbnail";

const SUPPORTED_PLATFORMS = [
  "odnoklassniki",
  "x",
  "instagram",
  "tiktok",
  "facebook",
  "pinterest",
  "vimeo",
  "dailymotion",
  "reddit",
  "vk"
] as const;
type CobaltPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const COBALT_SUCCESS_MODES = [
  "redirect",
  "picker",
  "tunnel",
  "local-processing"
] as const;
export type CobaltSuccessMode = (typeof COBALT_SUCCESS_MODES)[number];

const DIRECT_POLICY_IDS: Partial<Record<CobaltPlatform, string>> = {
  odnoklassniki: "cobalt-selfhosted-okru-media-v1",
  x: "cobalt-selfhosted-x-media-v1",
  instagram: "cobalt-selfhosted-instagram-media-v1",
  tiktok: "cobalt-selfhosted-tiktok-media-v1",
  facebook: "cobalt-selfhosted-facebook-media-v1",
  pinterest: "cobalt-selfhosted-pinterest-media-v1",
  vimeo: "cobalt-selfhosted-vimeo-media-v1"
};

const TUNNEL_POLICY_ID = "cobalt-selfhosted-tunnel-media-v1";
const PROCESSING_POLICY_ID = "cobalt-selfhosted-processing-media-v1";
const MAXIMUM_RESPONSE_BYTES = 512_000;
const MAXIMUM_MEDIA_URL_LENGTH = 8_192;
const MAXIMUM_FORMATS = 12;
const REQUEST_TIMEOUT_MS = 15_000;
const MAXIMUM_CANDIDATE_LIFETIME_MS = 2 * 60 * 1_000;
const API_KEY_MAXIMUM_LENGTH = 512;

const PickerItemSchema = z.object({
  type: z.enum(["photo", "video", "gif"]).nullish(),
  url: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish(),
  thumb: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish(),
  filename: z.string().max(300).nullish(),
  quality: z.string().max(80).nullish()
}).passthrough();

const ProcessingOutputSchema = z.object({
  type: z.string().min(1).max(100),
  filename: z.string().min(1).max(300),
  metadata: z.record(z.string(), z.string().max(500)).nullish(),
  subtitles: z.boolean().nullish()
}).passthrough();

const ProcessingAudioSchema = z.object({
  copy: z.boolean().nullish(),
  format: z.enum(["best", "mp3", "ogg", "wav", "opus", "m4a"]).nullish(),
  bitrate: z.union([z.string(), z.number()]).nullish(),
  cover: z.boolean().nullish(),
  cropCover: z.boolean().nullish()
}).passthrough();

const CobaltResponseSchema = z.object({
  status: z.enum(["tunnel", "local-processing", "redirect", "picker", "error"]),
  url: z.string().max(MAXIMUM_MEDIA_URL_LENGTH).nullish(),
  filename: z.string().max(300).nullish(),
  picker: z.array(PickerItemSchema).max(50).nullish(),
  audio: z.union([ProcessingAudioSchema, z.string().max(MAXIMUM_MEDIA_URL_LENGTH)]).nullish(),
  audioFilename: z.string().max(300).nullish(),
  type: z.enum(["merge", "mute", "audio", "gif", "remux"]).nullish(),
  service: z.string().min(1).max(64).nullish(),
  tunnel: z.array(z.string().max(MAXIMUM_MEDIA_URL_LENGTH)).min(1).max(8).nullish(),
  output: ProcessingOutputSchema.nullish(),
  isHLS: z.boolean().nullish(),
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
  thumbnailFetchImpl?: ProviderFetch;
  diagnosticSink?: (event: CobaltDiagnosticEvent) => void;
  thumbnailDiagnosticSink?: (event: TikTokThumbnailDiagnosticEvent) => void;
  approvedPlatforms?: readonly Platform[];
  deliveryVerifiedPlatforms?: readonly Platform[];
  deliveryVerifiedCapabilities?: Readonly<Partial<Record<Platform, readonly CobaltSuccessMode[]>>>;
}

export interface CobaltPlatformConfiguration {
  approvedPlatforms: readonly Platform[];
  deliveryVerifiedPlatforms: readonly Platform[];
  deliveryVerifiedCapabilities: Readonly<Record<string, readonly CobaltSuccessMode[]>>;
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

function parsePlatformList(value: string | undefined, variableName: string): Platform[] {
  return (value ?? SUPPORTED_PLATFORMS.join(","))
    .split(",")
    .map((platform) => platform.trim())
    .filter((platform, index, platforms) => platform.length > 0 && platforms.indexOf(platform) === index)
    .map((platform) => {
      if (!SUPPORTED_PLATFORMS.includes(platform as CobaltPlatform)) {
        throw new Error(`${variableName} contains unsupported platform: ${platform}.`);
      }
      return platform as Platform;
    });
}

function parseVerifiedCapabilities(
  value: string | undefined,
  approvedPlatforms: readonly Platform[]
): Record<string, readonly CobaltSuccessMode[]> {
  const capabilities: Record<string, readonly CobaltSuccessMode[]> = {};
  if (!value?.trim()) return capabilities;
  for (const rawEntry of value.split(",")) {
    const [rawPlatform, rawModes, ...rest] = rawEntry.trim().split(":");
    if (!rawPlatform || !rawModes || rest.length > 0) {
      throw new Error("COBALT_DELIVERY_VERIFIED_CAPABILITIES must use platform:mode|mode entries.");
    }
    if (!approvedPlatforms.includes(rawPlatform)) {
      throw new Error(`COBALT_DELIVERY_VERIFIED_CAPABILITIES contains an unapproved platform: ${rawPlatform}.`);
    }
    const modes = rawModes.split("|").filter(Boolean);
    if (modes.length === 0 || modes.some((mode) => !COBALT_SUCCESS_MODES.includes(mode as CobaltSuccessMode))) {
      throw new Error(`COBALT_DELIVERY_VERIFIED_CAPABILITIES contains an unsupported mode for ${rawPlatform}.`);
    }
    capabilities[rawPlatform] = [...new Set(modes)] as CobaltSuccessMode[];
  }
  return capabilities;
}

export function parseCobaltPlatformConfiguration(input: {
  approvedPlatforms?: string | undefined;
  deliveryVerifiedPlatforms?: string | undefined;
  deliveryVerifiedCapabilities?: string | undefined;
}): CobaltPlatformConfiguration {
  const approvedPlatforms = parsePlatformList(input.approvedPlatforms, "COBALT_APPROVED_PLATFORMS");
  const legacyVerified = input.deliveryVerifiedPlatforms === undefined
    ? []
    : parsePlatformList(input.deliveryVerifiedPlatforms, "COBALT_DELIVERY_VERIFIED_PLATFORMS");
  if (legacyVerified.some((platform) => !approvedPlatforms.includes(platform))) {
    throw new Error("COBALT_DELIVERY_VERIFIED_PLATFORMS must be a subset of COBALT_APPROVED_PLATFORMS.");
  }
  const deliveryVerifiedCapabilities = parseVerifiedCapabilities(
    input.deliveryVerifiedCapabilities,
    approvedPlatforms
  );
  for (const platform of legacyVerified) {
    deliveryVerifiedCapabilities[platform] ??= ["redirect", "picker"];
  }
  return {
    approvedPlatforms,
    deliveryVerifiedPlatforms: Object.keys(deliveryVerifiedCapabilities),
    deliveryVerifiedCapabilities
  };
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
    !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search ||
    url.hash || !["cobalt-api", "localhost", "127.0.0.1"].includes(url.hostname.toLowerCase())
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

function cleanFilename(value: string | null | undefined, fallback: string): string {
  const filename = value?.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (filename || fallback).slice(0, 120);
}

function extension(value: string | null | undefined, url: string, fallback: string): string {
  const match = `${value ?? ""} ${new URL(url).pathname}`.toLowerCase().match(/\.([a-z0-9]{2,8})(?:\s|$)/);
  return match?.[1] ?? fallback;
}

function qualityLabel(value: string | null | undefined, url: string): string {
  const source = `${value ?? ""} ${url}`;
  return source.match(/\b(\d{3,4}p)\b/i)?.[1] ?? "Source";
}

function mapCobaltError(code: string | null | undefined): never {
  const normalized = code?.toLowerCase() ?? "";
  if (/auth|api.key|jwt/.test(normalized)) {
    throw new ProviderError("The Cobalt service requires authentication.", "authentication_required", false, false);
  }
  if (/rate|limit|too.many/.test(normalized)) {
    throw new ProviderError("The Cobalt service is temporarily rate limited.", "provider_rate_limited", true, true);
  }
  if (/private|login|blocked|restricted|age/.test(normalized)) {
    throw new ProviderError("This media is private or restricted.", "content_private", false, false);
  }
  if (/invalid|unsupported|service/.test(normalized)) {
    throw new ProviderError("Cobalt does not support this URL.", "unsupported_url", false, true);
  }
  throw new ProviderError("Cobalt could not resolve this URL.", "provider_unavailable", true, true);
}

export interface NormalizedCobaltFormat extends ParsedFormat {
  mode: "redirect" | "proxy";
  hostPolicyId: string;
  processing?: DeliveryClientProcessingPlan;
}

export interface ParsedCobaltResponse {
  responseMode: CobaltSuccessMode;
  title: string | null;
  formats: NormalizedCobaltFormat[];
  requiredModes: readonly CobaltSuccessMode[];
}

function isTunnelUrl(url: string): boolean {
  return new URL(url).hostname.toLowerCase() === "media.tikdd.cc";
}

function normalizedFormat(
  candidate: {
    url: string;
    filename?: string | null | undefined;
    quality?: string | null | undefined;
    type?: string | null | undefined;
  },
  directPolicyId: string | undefined
): NormalizedCobaltFormat {
  const mediaKind = candidate.type === "photo"
    ? "image"
    : candidate.type === "gif"
      ? "gif"
      : candidate.type === "audio"
        ? "audio"
        : "video";
  const fallbackExtension = mediaKind === "image"
    ? "jpg"
    : mediaKind === "gif"
      ? "gif"
      : mediaKind === "audio"
        ? "m4a"
        : "mp4";
  const container = extension(candidate.filename, candidate.url, fallbackExtension);
  const tunnel = isTunnelUrl(candidate.url);
  if (!tunnel && !directPolicyId) {
    throw new ProviderError(
      "Cobalt returned a direct media host without a reviewed platform policy.",
      "unsupported_url",
      false,
      true
    );
  }
  return {
    url: candidate.url,
    label: mediaKind === "video" ? `${qualityLabel(candidate.quality ?? candidate.filename, candidate.url)} ${container.toUpperCase()}` : `${mediaKind} ${container.toUpperCase()}`,
    quality: qualityLabel(candidate.quality ?? candidate.filename, candidate.url),
    container,
    hasVideo: mediaKind === "video",
    hasAudio: mediaKind === "video" || mediaKind === "audio",
    mediaKind,
    mode: tunnel ? "proxy" : "redirect",
    hostPolicyId: tunnel ? TUNNEL_POLICY_ID : directPolicyId as string
  };
}

function processingInputRoles(
  operation: DeliveryClientProcessingPlan["operation"],
  count: number,
  hasSubtitles: boolean,
  hasCover: boolean
): DeliveryClientProcessingPlan["inputs"][number]["role"][] {
  const roles: DeliveryClientProcessingPlan["inputs"][number]["role"][] = [];
  for (let index = 0; index < count; index += 1) {
    if (hasCover && index === count - 1) roles.push("cover");
    else if (hasSubtitles && index === count - 1 - (hasCover ? 1 : 0)) roles.push("subtitle");
    else if (operation === "merge" && index === 0) roles.push("video");
    else if (operation === "merge" && index === 1) roles.push("audio");
    else roles.push("media");
  }
  return roles;
}

const PROCESSING_METADATA_KEYS = new Set([
  "album", "composer", "genre", "copyright", "title", "artist",
  "album_artist", "track", "date", "sublanguage"
]);

function normalizedProcessingMetadata(
  metadata: Record<string, string> | null | undefined
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const output = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => PROCESSING_METADATA_KEYS.has(key))
  );
  return Object.keys(output).length > 0 ? output : undefined;
}

export function parseCobaltResponse(
  body: string,
  httpStatus = 200,
  platform: Platform = "x"
): ParsedCobaltResponse {
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
  const responseMode = parsed.data.status as CobaltSuccessMode;
  const directPolicyId = DIRECT_POLICY_IDS[platform as CobaltPlatform];

  if (responseMode === "local-processing") {
    const operation = parsed.data.type;
    const output = parsed.data.output;
    const tunnelUrls = (parsed.data.tunnel ?? []).map(reviewedMediaUrl).filter((url): url is string => Boolean(url));
    if (!operation || !output || tunnelUrls.length !== parsed.data.tunnel?.length || tunnelUrls.some((url) => !isTunnelUrl(url))) {
      throw new ProviderError("Cobalt returned an invalid processing plan.", "invalid_result", false, true);
    }
    const audio = typeof parsed.data.audio === "object" && parsed.data.audio ? parsed.data.audio : undefined;
    // Cobalt Web reverses the API tunnel list before passing files to FFmpeg.
    // Preserve that normalized client-processing order in the encrypted plan.
    const processingUrls = [...tunnelUrls].reverse();
    const roles = processingInputRoles(operation, processingUrls.length, Boolean(output.subtitles), Boolean(audio?.cover));
    const metadata = normalizedProcessingMetadata(output.metadata);
    const plan: DeliveryClientProcessingPlan = {
      operation,
      platform,
      inputs: processingUrls.map((url, index) => ({ url, role: roles[index] ?? "media" })),
      output: {
        mimeType: output.type,
        filename: cleanFilename(output.filename, `TikDD-${platform}-processed.mp4`),
        ...(metadata ? { metadata } : {}),
        ...(output.subtitles !== null && output.subtitles !== undefined
          ? { subtitles: output.subtitles }
          : {})
      },
      ...(audio ? {
        audio: {
          copy: audio.copy ?? false,
          format: audio.format ?? "m4a",
          bitrateKbps: Math.min(320, Math.max(8, Number.parseInt(String(audio.bitrate ?? "128"), 10) || 128)),
          cover: audio.cover ?? false,
          cropCover: audio.cropCover ?? false
        }
      } : {}),
      isHls: parsed.data.isHLS ?? false
    };
    const container = output.filename.split(".").at(-1)?.toLowerCase() || "mp4";
    return {
      responseMode,
      title: cleanFilename(output.filename, `${platform}-media`),
      requiredModes: ["local-processing"],
      formats: [{
        url: tunnelUrls[0] as string,
        label: `Processed ${container.toUpperCase()}`,
        quality: "Processed",
        container,
        hasVideo: output.type.startsWith("video/"),
        hasAudio: operation !== "mute",
        mediaKind: output.type.startsWith("audio/") ? "audio" : output.type === "image/gif" ? "gif" : "video",
        mode: "proxy",
        hostPolicyId: PROCESSING_POLICY_ID,
        processing: plan
      }]
    };
  }

  const candidates = responseMode === "picker"
    ? [
      ...(parsed.data.picker ?? []).map((item) => ({
        url: item.url,
        filename: item.filename,
        type: item.type,
        quality: item.quality
      })),
      ...(typeof parsed.data.audio === "string" ? [{
        url: parsed.data.audio,
        filename: parsed.data.audioFilename,
        type: "audio",
        quality: "audio"
      }] : [])
    ]
    : [{
        url: parsed.data.url,
        filename: parsed.data.filename,
        type: "video",
        quality: null
      }];
  const formats: NormalizedCobaltFormat[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const url = reviewedMediaUrl(candidate.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    formats.push(normalizedFormat({ ...candidate, url }, directPolicyId));
    if (formats.length >= MAXIMUM_FORMATS) break;
  }
  if (formats.length === 0) {
    throw new ProviderError("Cobalt returned no usable media resource.", "invalid_result", false, true);
  }
  const requiredModes = new Set<CobaltSuccessMode>([responseMode]);
  if (formats.some((format) => format.mode === "proxy")) requiredModes.add("tunnel");
  return {
    responseMode,
    title: cleanFilename(parsed.data.filename, `${platform}-media`),
    formats,
    requiredModes: [...requiredModes]
  };
}

function expirationForFormats(formats: readonly NormalizedCobaltFormat[]): string {
  let expiresAt = Date.now() + MAXIMUM_CANDIDATE_LIFETIME_MS;
  for (const format of formats) {
    const urls = format.processing?.inputs.map(({ url }) => url) ?? [format.url];
    for (const value of urls) {
      if (!isTunnelUrl(value)) continue;
      const tunnelExpiry = Number(new URL(value).searchParams.get("exp"));
      if (Number.isSafeInteger(tunnelExpiry)) expiresAt = Math.min(expiresAt, tunnelExpiry);
    }
  }
  if (expiresAt <= Date.now()) {
    throw new ProviderError("Cobalt returned an expired tunnel.", "invalid_result", true, true);
  }
  return new Date(expiresAt).toISOString();
}

function createCobaltResolution(
  providerId: string,
  input: ResolveInput,
  parsed: ParsedCobaltResponse,
  thumbnailUrl: string | null = null
): ProviderResolution {
  const result = createResolveResult(providerId, "api", input, {
    title: parsed.title,
    thumbnailUrl,
    formats: parsed.formats,
    warnings: [`Cobalt is a self-hosted experimental ${input.platform} fallback Provider.`]
  }, { deliveryPending: false });
  const expiresAt = expirationForFormats(parsed.formats);
  const candidates: DeliveryCandidateInput[] = result.formats.map((format, index) => {
    const normalized = parsed.formats[index] as NormalizedCobaltFormat;
    if (normalized.processing) {
      normalized.processing.inputs.forEach(({ url }) => assertDeliveryTargetPolicy({
        providerId,
        mode: "proxy",
        hostPolicyId: normalized.hostPolicyId,
        targetUrl: url
      }));
      return {
        kind: "processing",
        formatId: format.id,
        mode: "proxy",
        hostPolicyId: normalized.hostPolicyId,
        expiresAt,
        processing: normalized.processing
      };
    }
    assertDeliveryTargetPolicy({
      providerId,
      mode: normalized.mode,
      hostPolicyId: normalized.hostPolicyId,
      targetUrl: normalized.url
    });
    return {
      kind: "target",
      formatId: format.id,
      mode: normalized.mode,
      targetUrl: normalized.url,
      hostPolicyId: normalized.hostPolicyId,
      expiresAt,
      secretHeaders: {}
    };
  });
  return ProviderResolutionSchema.parse({ result, candidates });
}

function deliveryModesFor(modes: readonly CobaltSuccessMode[]): ProviderDeliveryMode[] {
  const deliveryModes = new Set<ProviderDeliveryMode>();
  if (modes.includes("redirect") || modes.includes("picker")) deliveryModes.add("redirect");
  if (modes.includes("tunnel") || modes.includes("local-processing")) deliveryModes.add("proxy");
  return [...deliveryModes];
}

export class CobaltProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly apiOrigin: URL;
  private readonly apiKey: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly thumbnailFetchImpl: ProviderFetch;
  private readonly diagnosticSink: ((event: CobaltDiagnosticEvent) => void) | null;
  private readonly thumbnailDiagnosticSink: ((event: TikTokThumbnailDiagnosticEvent) => void) | null;
  private readonly approvedPlatforms: ReadonlySet<string>;
  private readonly verifiedCapabilities: Readonly<Record<string, readonly CobaltSuccessMode[]>>;

  constructor(options: CobaltProviderOptions = {}) {
    this.apiOrigin = safeApiOrigin(options.apiUrl ?? "http://cobalt-api:9000/");
    this.apiKey = options.apiKey?.trim() ?? "";
    if (this.apiKey.length > API_KEY_MAXIMUM_LENGTH) throw new Error("COBALT_API_KEY is too long.");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.thumbnailFetchImpl = options.thumbnailFetchImpl ?? fetch;
    this.diagnosticSink = options.diagnosticSink ?? null;
    this.thumbnailDiagnosticSink = options.thumbnailDiagnosticSink ?? null;
    this.approvedPlatforms = new Set(options.approvedPlatforms ?? SUPPORTED_PLATFORMS);
    const verifiedCapabilities: Record<string, readonly CobaltSuccessMode[]> = {};
    for (const [platform, modes] of Object.entries(options.deliveryVerifiedCapabilities ?? {})) {
      if (modes) verifiedCapabilities[platform] = modes;
    }
    for (const platform of options.deliveryVerifiedPlatforms ?? []) {
      verifiedCapabilities[platform] ??= ["redirect", "picker"];
    }
    if (Object.keys(verifiedCapabilities).some((platform) => !this.approvedPlatforms.has(platform))) {
      throw new Error("Cobalt delivery verified capabilities must belong to approved platforms.");
    }
    this.verifiedCapabilities = verifiedCapabilities;
    this.manifest = {
      id: "cobalt-selfhosted",
      displayName: "Cobalt (self-hosted)",
      kind: "api",
      enabled: options.enabled ?? false,
      regions: ["nl"],
      timeoutMs: REQUEST_TIMEOUT_MS,
      costWeight: 80,
      platforms: SUPPORTED_PLATFORMS.map((platform) => {
        const modes = this.verifiedCapabilities[platform] ?? [];
        return {
          platform,
          priority: platform === "odnoklassniki" ? 500 : 450,
          deliveryModes: deliveryModesFor(modes),
          verificationStatus: modes.length > 0 ? "delivery_verified" : "fixture_verified"
        };
      })
    };
  }

  async resolve(input: ResolveInput) {
    const platform = input.platform as CobaltPlatform;
    if (!SUPPORTED_PLATFORMS.includes(platform) || !this.approvedPlatforms.has(input.platform)) {
      throw new ProviderError("Cobalt is not approved for this platform.", "unsupported_url", false, true);
    }
    const verifiedModes = this.verifiedCapabilities[input.platform] ?? [];
    if (verifiedModes.length === 0) {
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
          localProcessing: verifiedModes.includes("local-processing") ? "preferred" : "disabled"
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
      const parsed = parseCobaltResponse(body, response.status, input.platform);
      if (parsed.requiredModes.some((mode) => !verifiedModes.includes(mode))) {
        throw new ProviderError("Cobalt returned a delivery mode that is not verified for this platform.", "unsupported_url", false, true);
      }
      responseStatus = parsed.responseMode;
      const raw = JSON.parse(body) as { picker?: unknown[]; tunnel?: unknown[] };
      candidateCount = Array.isArray(raw.picker) ? raw.picker.length : Array.isArray(raw.tunnel) ? raw.tunnel.length : 1;
      validMediaCount = parsed.formats.length;
      rejectedCount = Math.max(0, (candidateCount ?? 0) - validMediaCount);
      const thumbnailUrl = input.platform === "tiktok"
        ? await resolveTikTokThumbnail({
            taskId: input.taskId,
            canonicalUrl: input.canonicalUrl,
            fetchImpl: this.thumbnailFetchImpl,
            ...(input.signal ? { signal: input.signal } : {}),
            ...(this.thumbnailDiagnosticSink ? { diagnosticSink: this.thumbnailDiagnosticSink } : {})
          })
        : null;
      const resolution = createCobaltResolution(this.manifest.id, input, parsed, thumbnailUrl);
      phase = "completed";
      emit("success", null);
      return resolution;
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
