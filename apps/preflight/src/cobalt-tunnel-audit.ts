import { assertDeliveryTargetPolicy } from "@tikdd/delivery-core";
import type { CobaltOriginHairpinStatus } from "@tikdd/providers";

const SAMPLE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,38}[a-z0-9])?$/;
const MAXIMUM_SAMPLES = 2;
const MAXIMUM_BYTES = 1_024;
const DEFAULT_TIMEOUT_MS = 20_000;
const TUNNEL_POLICY_ID = "cobalt-selfhosted-tunnel-media-v1";

export type CobaltTunnelAuditExit = "client-direct" | "client-proxy" | "origin-hairpin";
export type CobaltTunnelAuditFailure =
  | "network_error"
  | "timeout"
  | "http_rejected"
  | "redirect_rejected"
  | "range_rejected"
  | "mime_rejected"
  | "empty_media"
  | "attachment_rejected"
  | "cors_rejected"
  | "cache_policy_rejected";

export interface CobaltTunnelAuditSample {
  id: string;
  targetUrl: string;
}

export interface CobaltTunnelAuditPlan {
  exit: CobaltTunnelAuditExit;
  samples: readonly CobaltTunnelAuditSample[];
}

export interface CobaltTunnelAuditResult {
  sampleId: string;
  exit: CobaltTunnelAuditExit;
  outcome: "passed" | "failed";
  httpStatus: number | null;
  partialContent: boolean;
  videoContent: boolean;
  nonZeroBytes: boolean;
  attachment: boolean;
  corsOriginVerified: boolean;
  privateNoStore: boolean;
  cloudflareRequestIdObserved: boolean;
  failureCode: CobaltTunnelAuditFailure | null;
  durationMs: number;
}

/**
 * Correlates only sanitized request presence. The caller checks the query-free Nginx access log;
 * neither a Cloudflare request ID nor a signed descriptor is accepted by this function.
 */
export function classifyCobaltOriginHairpin(
  result: CobaltTunnelAuditResult,
  originRequestObserved: boolean | null
): CobaltOriginHairpinStatus {
  if (result.outcome === "passed") return "verified";
  if (originRequestObserved === true) return "origin-rejected";
  if (originRequestObserved === false && result.cloudflareRequestIdObserved) return "edge-blocked";
  return "blocked-unclassified";
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCobaltTunnelAuditPlan(value: unknown): CobaltTunnelAuditPlan {
  if (!isRecord(value)) throw new Error("Cobalt tunnel audit input must be an object.");
  if (value.exit !== "client-direct" && value.exit !== "client-proxy" && value.exit !== "origin-hairpin") {
    throw new Error("Cobalt tunnel audit requires a reviewed exit identifier.");
  }
  if (!Array.isArray(value.samples) || value.samples.length < 1 || value.samples.length > MAXIMUM_SAMPLES) {
    throw new Error("Cobalt tunnel audit requires one or two samples.");
  }
  const identifiers = new Set<string>();
  const samples = value.samples.map((candidate): CobaltTunnelAuditSample => {
    if (!isRecord(candidate)) throw new Error("Cobalt tunnel audit samples must be objects.");
    if (typeof candidate.id !== "string" || !SAMPLE_ID_PATTERN.test(candidate.id) || identifiers.has(candidate.id)) {
      throw new Error("Cobalt tunnel audit sample IDs must be unique safe identifiers.");
    }
    identifiers.add(candidate.id);
    if (typeof candidate.url !== "string" || candidate.url.length > 4_096) {
      throw new Error("Cobalt tunnel audit samples require a bounded signed descriptor.");
    }
    const target = assertDeliveryTargetPolicy({
      providerId: "cobalt-selfhosted",
      mode: "proxy",
      hostPolicyId: TUNNEL_POLICY_ID,
      targetUrl: candidate.url
    });
    return { id: candidate.id, targetUrl: target.toString() };
  });
  return { exit: value.exit, samples };
}

export function parseCobaltTunnelAuditInput(
  value: unknown,
  exitOverride?: string | undefined
): CobaltTunnelAuditPlan {
  if (!exitOverride) return parseCobaltTunnelAuditPlan(value);
  if (!isRecord(value) || !Array.isArray(value.samples)) {
    throw new Error("Cobalt tunnel descriptor artifact must contain samples.");
  }
  return parseCobaltTunnelAuditPlan({ ...value, exit: exitOverride });
}

async function readBoundedBody(response: Response): Promise<number> {
  if (!response.body) return 0;
  const reader = response.body.getReader();
  let bytesRead = 0;
  try {
    while (bytesRead < MAXIMUM_BYTES) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += Math.min(chunk.value.byteLength, MAXIMUM_BYTES - bytesRead);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return bytesRead;
}

function failureFor(result: Omit<CobaltTunnelAuditResult, "outcome" | "failureCode" | "durationMs">): CobaltTunnelAuditFailure | null {
  if (result.httpStatus !== 206) return result.httpStatus !== null && result.httpStatus >= 300 && result.httpStatus < 400
    ? "redirect_rejected"
    : "http_rejected";
  if (!result.partialContent) return "range_rejected";
  if (!result.videoContent) return "mime_rejected";
  if (!result.nonZeroBytes) return "empty_media";
  if (!result.attachment) return "attachment_rejected";
  if (!result.corsOriginVerified) return "cors_rejected";
  if (!result.privateNoStore) return "cache_policy_rejected";
  return null;
}

export async function runCobaltTunnelAudit(
  plan: CobaltTunnelAuditPlan,
  options: {
    webOrigin: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  }
): Promise<readonly CobaltTunnelAuditResult[]> {
  const webOrigin = new URL(options.webOrigin);
  if (webOrigin.protocol !== "https:" || webOrigin.pathname !== "/" || webOrigin.search || webOrigin.hash) {
    throw new Error("Cobalt tunnel audit requires an exact HTTPS Web origin.");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const results: CobaltTunnelAuditResult[] = [];

  for (const sample of plan.samples) {
    const startedAt = Date.now();
    try {
      const response = await fetchImpl(sample.targetUrl, {
        method: "GET",
        headers: { Range: "bytes=0-1023", Origin: webOrigin.origin },
        credentials: "omit",
        redirect: "manual",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(timeoutMs)
      });
      const bytesRead = await readBoundedBody(response);
      const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
      const base = {
        sampleId: sample.id,
        exit: plan.exit,
        httpStatus: response.status,
        partialContent: response.status === 206 && response.headers.get("content-range") !== null,
        videoContent: response.headers.get("content-type")?.toLowerCase().startsWith("video/") ?? false,
        nonZeroBytes: bytesRead > 0,
        attachment: response.headers.get("content-disposition")?.toLowerCase().includes("attachment") ?? false,
        corsOriginVerified: response.headers.get("access-control-allow-origin") === webOrigin.origin,
        privateNoStore: cacheControl.includes("private") && cacheControl.includes("no-store"),
        cloudflareRequestIdObserved: response.headers.has("cf-ray")
      };
      const failureCode = failureFor(base);
      results.push({
        ...base,
        outcome: failureCode === null ? "passed" : "failed",
        failureCode,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      results.push({
        sampleId: sample.id,
        exit: plan.exit,
        outcome: "failed",
        httpStatus: null,
        partialContent: false,
        videoContent: false,
        nonZeroBytes: false,
        attachment: false,
        corsOriginVerified: false,
        privateNoStore: false,
        cloudflareRequestIdObserved: false,
        failureCode: error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
          ? "timeout"
          : "network_error",
        durationMs: Date.now() - startedAt
      });
    }
  }
  return results;
}
