import { isIP } from "node:net";

const URL_PATTERN = /^https:\/\//i;

export function contentTypeCategory(headers) {
  const value = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!value) return "missing";
  if (value === "application/json" || value.endsWith("+json")) return "json";
  if (value === "text/html" || value === "application/xhtml+xml") return "html";
  if (value.startsWith("text/")) return "text";
  if (value.startsWith("video/")) return "video";
  if (value.startsWith("audio/")) return "audio";
  return "other";
}

export function mediaMime(headers) {
  return headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function isMp4Response(headers, rawUrl = "") {
  const mime = mediaMime(headers);
  if (mime === "video/mp4") return true;
  return !mime && /\.mp4(?:$|[?#])/i.test(rawUrl);
}
export function mediaHostSuffix(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const labels = url.hostname.toLowerCase().split(".").filter(Boolean);
    return labels.length >= 2 ? labels.slice(-2).join(".") : "invalid";
  } catch {
    return "invalid";
  }
}

export function sanitizeFailure(error) {
  if (!error) return null;
  if (typeof error === "string") return error.slice(0, 80).replace(/[^a-z0-9_:-]/gi, "_");
  const name = typeof error.name === "string" ? error.name : "Error";
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error";
}

export function isSafeHttpsUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length > 16_384 || !URL_PATTERN.test(rawUrl)) return false;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export function isPublicIp(value) {
  if (!isIP(value)) return false;
  if (value.includes(":")) {
    const lower = value.toLowerCase();
    return !lower.startsWith("fc") && !lower.startsWith("fd") && !lower.startsWith("fe8") &&
      !lower.startsWith("fe9") && !lower.startsWith("fea") && !lower.startsWith("feb") && lower !== "::1";
  }
  const octets = value.split(".").map(Number);
  const [a, b] = octets;
  return a !== 10 && a !== 127 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && b === 168) && !(a === 198 && (b === 18 || b === 19)) && !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 0);
}

export function sanitizeRecord(record) {
  return {
    providerId: String(record.providerId).slice(0, 100),
    endpointId: record.endpointId ? String(record.endpointId).slice(0, 100) : null,
    platform: record.platform ? String(record.platform).slice(0, 40) : null,
    sourceRef: record.sourceRef ? String(record.sourceRef).slice(0, 120) : null,
    result: String(record.result).slice(0, 40),
    httpStatus: Number.isInteger(record.httpStatus) ? record.httpStatus : null,
    contentType: String(record.contentType ?? "missing").slice(0, 20),
    latencyMs: Number.isFinite(record.latencyMs) ? Math.max(0, Math.round(record.latencyMs)) : null,
    resourceCount: Number.isInteger(record.resourceCount) ? Math.max(0, record.resourceCount) : 0,
    validMediaCount: Number.isInteger(record.validMediaCount) ? Math.max(0, record.validMediaCount) : 0,
    mediaHostSuffixes: [...new Set((record.mediaHostSuffixes ?? []).filter((item) => typeof item === "string").map((item) => item.slice(0, 120)))].slice(0, 10),
    mediaTopologies: [...new Set((record.mediaTopologies ?? []).filter((item) => typeof item === "string" && ["source-cdn", "provider-stream"].includes(item)))].slice(0, 4),
    scriptCount: Number.isInteger(record.scriptCount) ? Math.max(0, record.scriptCount) : 0,
    endpointHints: [...new Set((record.endpointHints ?? []).filter((item) => typeof item === "string").map((item) => item.slice(0, 120)))].slice(0, 20),
    redirectCount: Number.isInteger(record.redirectCount) ? Math.max(0, record.redirectCount) : 0,
    failureCode: record.failureCode ? String(record.failureCode).slice(0, 80) : null
  };
}
