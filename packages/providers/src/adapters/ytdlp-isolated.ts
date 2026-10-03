import { createHmac } from "node:crypto";
import { YtDlpRunnerRequestSchema, YtDlpRunnerResponseSchema, type ProviderDeliveryMode, type YtDlpRunnerPlatform } from "@tikdd/contracts";
import { ProviderResolutionSchema, assertDeliveryTargetPolicy } from "@tikdd/delivery-core";
import { ProviderError } from "../errors";
import type { ProviderManifest, ResolveInput, ResolverProvider } from "../index";
import { createResolveResult, type ParsedFormat, type ProviderFetch } from "./shared";

const SUPPORTED_PLATFORMS = ["dailymotion", "youtube"] as const;
export type YtDlpDeliveryCapability = "direct" | "relay";
export interface YtDlpIsolatedProviderOptions {
  enabled?: boolean; apiUrl?: string; hmacSecret?: string;
  approvedPlatforms?: readonly YtDlpRunnerPlatform[];
  deliveryVerifiedCapabilities?: Readonly<Partial<Record<YtDlpRunnerPlatform, YtDlpDeliveryCapability>>>;
  fetchImpl?: ProviderFetch;
}

const modeFor = (capability: YtDlpDeliveryCapability): ProviderDeliveryMode => capability === "relay" ? "proxy" : "redirect";
const policyFor = (platform: YtDlpRunnerPlatform, capability: YtDlpDeliveryCapability) =>
  `ytdlp-${platform}-${capability === "relay" ? "relay" : "direct"}-v1`;
function sign(secret: string, timestamp: string, body: ReturnType<typeof YtDlpRunnerRequestSchema.parse>): string {
  return createHmac("sha256", secret).update(`${timestamp}\n${JSON.stringify(body)}`).digest("base64url");
}
function mapFormat(format: ReturnType<typeof YtDlpRunnerResponseSchema.parse>["formats"][number]): ParsedFormat {
  return { url: format.targetUrl, label: format.quality, quality: format.quality, container: format.container,
    hasVideo: format.hasVideo, hasAudio: format.hasAudio, mediaKind: format.hasVideo ? "video" : "audio" };
}
async function readBoundedJson(response: Response): Promise<string> {
  const declared = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > 2 * 1_024 * 1_024) throw new Error("oversized");
  if (!response.body) throw new Error("empty");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.byteLength; if (total > 2 * 1_024 * 1_024) { await reader.cancel(); throw new Error("oversized"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

export class YtDlpIsolatedProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  private readonly apiUrl: URL;
  private readonly hmacSecret: string;
  private readonly approvedPlatforms: ReadonlySet<YtDlpRunnerPlatform>;
  private readonly capabilities: Readonly<Partial<Record<YtDlpRunnerPlatform, YtDlpDeliveryCapability>>>;
  private readonly fetchImpl: ProviderFetch;
  constructor(options: YtDlpIsolatedProviderOptions = {}) {
    this.apiUrl = new URL("/internal/v1/extractions", options.apiUrl ?? "http://ytdlp-runner:9100/");
    if (!["http:", "https:"].includes(this.apiUrl.protocol) || this.apiUrl.username || this.apiUrl.password) throw new Error("The yt-dlp Runner URL is invalid.");
    this.hmacSecret = options.hmacSecret?.trim() ?? "";
    this.approvedPlatforms = new Set(options.approvedPlatforms ?? []);
    this.capabilities = options.deliveryVerifiedCapabilities ?? {};
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifest = { id: "ytdlp-isolated", displayName: "yt-dlp (isolated)", kind: "yt-dlp", enabled: options.enabled ?? false,
      regions: ["nl"], timeoutMs: 35_000, costWeight: 95,
      platforms: SUPPORTED_PLATFORMS.map((platform) => {
        const capability = this.capabilities[platform];
        return { platform, priority: platform === "dailymotion" ? 300 : 250,
          deliveryModes: capability ? [modeFor(capability)] : [],
          verificationStatus: capability ? "delivery_verified" : "fixture_verified" };
      }) };
  }
  async resolve(input: ResolveInput) {
    const platform = input.platform as YtDlpRunnerPlatform;
    const capability = this.capabilities[platform];
    if (!SUPPORTED_PLATFORMS.includes(platform) || !this.approvedPlatforms.has(platform) || !capability) throw new ProviderError("yt-dlp is not delivery-approved for this platform.", "unsupported_url", false, true);
    if (this.hmacSecret.length < 32) throw new ProviderError("yt-dlp Runner authentication is not configured.", "authentication_required", false, false);
    const body = YtDlpRunnerRequestSchema.parse({ requestId: input.taskId, platform, url: input.canonicalUrl, deadlineMs: 30_000 });
    const timestamp = String(Date.now());
    let response: Response;
    try { response = await this.fetchImpl(this.apiUrl, { method: "POST", redirect: "manual", ...(input.signal ? { signal: input.signal } : {}),
      headers: { accept: "application/json", "content-type": "application/json", "x-tikdd-timestamp": timestamp,
        "x-tikdd-signature": sign(this.hmacSecret, timestamp, body) }, body: JSON.stringify(body) }); }
    catch { throw new ProviderError("The isolated yt-dlp Runner is unavailable.", "provider_unavailable", true, true); }
    if (!response.ok) throw new ProviderError("The isolated yt-dlp Runner could not resolve this media.", response.status >= 500 ? "provider_unavailable" : "unsupported_url", response.status >= 500, true);
    let normalized: ReturnType<typeof YtDlpRunnerResponseSchema.parse>;
    try { normalized = YtDlpRunnerResponseSchema.parse(JSON.parse(await readBoundedJson(response))); }
    catch { throw new ProviderError("The isolated yt-dlp response was invalid.", "provider_schema_changed", false, true); }
    const formats = normalized.formats.filter((format) => format.protocol === "https" && format.container === "mp4" && format.hasVideo && format.hasAudio);
    if (formats.length === 0) throw new ProviderError("yt-dlp returned no progressive MP4.", "invalid_result", false, true);
    const result = createResolveResult("ytdlp-isolated", "yt-dlp", input, { title: normalized.title, author: normalized.author,
      thumbnailUrl: normalized.thumbnailUrl, durationSeconds: normalized.durationSeconds, formats: formats.map(mapFormat) }, { deliveryPending: false });
    const mode = modeFor(capability); const hostPolicyId = policyFor(platform, capability); const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const candidates = result.formats.map((format, index) => ({ formatId: format.id, mode, targetUrl: formats[index]!.targetUrl,
      hostPolicyId, expiresAt, secretHeaders: formats[index]!.headers }));
    for (const candidate of candidates) assertDeliveryTargetPolicy({ providerId: "ytdlp-isolated", mode: candidate.mode, hostPolicyId, targetUrl: candidate.targetUrl });
    return ProviderResolutionSchema.parse({ result, candidates });
  }
}
