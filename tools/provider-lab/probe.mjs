import { readFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { pathToFileURL } from "node:url";
import catalog from "./catalog.json" with { type: "json" };
import {
  contentTypeCategory,
  isMp4Response,
  isPublicIp,
  isSafeHttpsUrl,
  mediaHostSuffix,
  sanitizeFailure,
  sanitizeRecord
} from "./sanitize.mjs";

export const MAX_REDIRECTS = 3;
export const MAX_BODY_BYTES = 512_000;
export const MAX_MEDIA_BYTES = 1_024;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MIN_INTERVAL_MS = 10_000;
export const MAX_REQUESTS = 24;
export const MAX_MATRIX_REQUESTS = 55;
export const MAX_SCRIPT_REQUESTS = 2;
export const KNOWN_MATRIX_PLATFORMS = new Set(["x", "instagram", "tiktok", "facebook", "youtube", "vimeo", "pinterest"]);

const CHALLENGE_MARKER = /(?:cf-chl-|cf-challenge|cf-mitigated|turnstile|captcha|verify\s+you\s+are\s+human|challenge-platform)/i;

export function hasChallengeMarker(body = "") {
  return typeof body === "string" && CHALLENGE_MARKER.test(body.slice(0, MAX_BODY_BYTES));
}

export class RequestBudget {
  constructor({ maxRequests = MAX_REQUESTS, minIntervalMs = MIN_INTERVAL_MS, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
    this.maxRequests = maxRequests;
    this.minIntervalMs = minIntervalMs;
    this.now = now;
    this.sleep = sleep;
    this.lastRequestAt = 0;
    this.requestCount = 0;
  }

  async take() {
    if (this.requestCount >= this.maxRequests) throw new Error("request_budget_exhausted");
    const wait = this.minIntervalMs - (this.now() - this.lastRequestAt);
    if (this.lastRequestAt > 0 && wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
    this.requestCount += 1;
  }
}

function providerById(providerId) {
  return catalog.providers.find((provider) => provider.id === providerId) ?? null;
}

async function readLimitedText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value ?? new Uint8Array();
      const remaining = MAX_BODY_BYTES - total;
      const selected = chunk.byteLength > remaining ? chunk.slice(0, remaining) : chunk;
      chunks.push(selected);
      total += selected.byteLength;
      if (selected.byteLength < chunk.byteLength) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

async function readLimitedBytes(response) {
  if (!response.body) return 0;
  const reader = response.body.getReader();
  let total = 0;
  try {
    while (total < MAX_MEDIA_BYTES) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value ?? new Uint8Array();
      const remaining = MAX_MEDIA_BYTES - total;
      total += Math.min(chunk.byteLength, remaining);
      if (chunk.byteLength > remaining) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return total;
}

async function publicDns(hostname) {
  try {
    const answers = await lookup(hostname, { all: true, verbatim: true });
    return answers.length > 0 && answers.every(({ address }) => isPublicIp(address));
  } catch {
    return false;
  }
}

async function fetchBounded(url, options, budget, { expectedHosts = new Set(), media = false, fetcher = fetch, dnsCheck = publicDns } = {}) {
  let current = new URL(url);
  let redirectCount = 0;
  while (true) {
    if (!isSafeHttpsUrl(current.toString()) || (expectedHosts.size > 0 && !expectedHosts.has(current.hostname.toLowerCase()))) {
      return { response: null, body: "", redirectCount, failureCode: "host_rejected" };
    }
    if (!(await dnsCheck(current.hostname))) return { response: null, body: "", redirectCount, failureCode: "dns_rejected" };
    await budget.take();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetcher(current, { ...options, redirect: "manual", signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      return { response: null, body: "", redirectCount, failureCode: sanitizeFailure(error) };
    }
    clearTimeout(timer);
    const location = response.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      if (redirectCount >= MAX_REDIRECTS) return { response, body: "", redirectCount, failureCode: "redirect_limit" };
      const next = new URL(location, current);
      if (!isSafeHttpsUrl(next.toString()) || (expectedHosts.size > 0 && !expectedHosts.has(next.hostname.toLowerCase()))) {
        return { response, body: "", redirectCount, failureCode: "redirect_outside_policy" };
      }
      current = next;
      redirectCount += 1;
      continue;
    }
    const body = media ? "" : await readLimitedText(response);
    const bytesRead = media ? await readLimitedBytes(response) : 0;
    return { response, body, bytesRead, finalUrl: current.toString(), redirectCount, failureCode: null };
  }
}

function extractFirstPartyScripts(html, origin) {
  const output = [];
  const seen = new Set();
  const pattern = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const url = new URL(match[1], origin);
      if (url.protocol !== "https:" || url.hostname !== new URL(origin).hostname) continue;
      url.hash = "";
      url.search = "";
      if (!seen.has(url.toString())) {
        seen.add(url.toString());
        output.push(url.toString());
      }
    } catch {
      // Ignore malformed script references from untrusted HTML.
    }
    if (output.length >= MAX_SCRIPT_REQUESTS) break;
  }
  return output;
}

function extractEndpointHints(value) {
  const output = new Set();
  const pattern = /(?:https:\/\/[^\s"'<>]+)?\/(?:api|ajax|download|parse|resolve|convert|info|media)[a-zA-Z0-9._~!$&'()*+,;=:@%/?-]*/g;
  for (const match of String(value).matchAll(pattern)) {
    try {
      const url = new URL(match[0], "https://hint.invalid");
      const path = url.pathname.replace(/\/+/g, "/");
      if (path.length > 1) output.add(path.slice(0, 120));
    } catch {
      // Ignore non-URL script fragments.
    }
    if (output.size >= 20) break;
  }
  return [...output];
}

function selectActiveEndpoint(provider, platform) {
  const endpoints = Array.isArray(provider.activeEndpoints)
    ? provider.activeEndpoints
    : provider.active
      ? [provider.active]
      : [];
  if (!platform) return endpoints[0] ?? null;
  return endpoints.find((endpoint) => endpoint.platform === platform) ?? null;
}

export function activeEndpointFor(provider, platform) {
  return selectActiveEndpoint(provider, platform);
}

function collectMediaUrls(value, baseOrigin, output = [], seen = new Set()) {
  if (output.length >= 50 || value === null || value === undefined) return output;
  if (typeof value === "string") {
    let candidate = value;
    if (candidate.startsWith("/")) {
      try { candidate = new URL(candidate, baseOrigin).toString(); } catch { candidate = ""; }
    }
    if (isSafeHttpsUrl(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      output.push(candidate);
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMediaUrls(item, baseOrigin, output, seen);
    return output;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectMediaUrls(item, baseOrigin, output, seen);
  }
  return output;
}

function resolveEndpointPath(endpoint, sample, platform) {
  if (!endpoint.pathTemplate) return endpoint.path;
  if (endpoint.pathTemplate === "instagram-shortcode") {
    const match = sample.url.match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
    return match ? endpoint.path.replace("{shortcode}", encodeURIComponent(match[1])) : null;
  }
  return null;
}

export async function passiveProbe(provider, { fetchImpl = fetch, budget = new RequestBudget(), dnsCheck = publicDns } = {}) {
  if (provider.localOnly) return sanitizeRecord({ providerId: provider.id, result: "local_only", failureCode: "local_source" });
  const started = Date.now();
  try {
    const probeUrl = provider.probeUrl ?? provider.landingUrl;
    const result = await fetchBounded(probeUrl, { method: "GET", headers: { accept: "text/html,application/xhtml+xml,application/json" } }, budget, { expectedHosts: new Set([new URL(probeUrl).hostname.toLowerCase()]), fetcher: fetchImpl, dnsCheck });
    const response = result.response;
    const scriptUrls = response && contentTypeCategory(response.headers) === "html"
      ? extractFirstPartyScripts(result.body, probeUrl)
      : [];
    const scriptBodies = [];
    for (const scriptUrl of scriptUrls) {
      const scriptResult = await fetchBounded(scriptUrl, { method: "GET", headers: { accept: "application/javascript,text/javascript,*/*" } }, budget, {
        expectedHosts: new Set([new URL(probeUrl).hostname.toLowerCase()]),
        fetcher: fetchImpl,
        dnsCheck
      });
      if (scriptResult.body) scriptBodies.push(scriptResult.body);
    }
    const inspectionBody = [result.body, ...scriptBodies].join("\n");
    const challenge = response?.headers.get("cf-mitigated") === "challenge" || hasChallengeMarker(inspectionBody);
    const state = result.failureCode === "timeout" || response?.status === 408 || response?.status === 429 || (response?.status ?? 0) >= 500
      ? "deferred"
      : result.failureCode || challenge || response?.status === 401 || response?.status === 403
        ? "blocked"
        : response && response.status >= 200 && response.status < 400
          ? "reachable"
          : "blocked";
    return sanitizeRecord({
      providerId: provider.id,
      result: state,
      httpStatus: response?.status ?? null,
      contentType: response ? contentTypeCategory(response.headers) : "missing",
      latencyMs: Date.now() - started,
      scriptCount: scriptUrls.length,
      endpointHints: extractEndpointHints(inspectionBody),
      redirectCount: result.redirectCount,
      failureCode: result.failureCode ?? (challenge || response?.status === 401 || response?.status === 403 ? "access_challenge" : null)
    });
  } catch (error) {
    return sanitizeRecord({ providerId: provider.id, result: "blocked", latencyMs: Date.now() - started, failureCode: sanitizeFailure(error) });
  }
}

export async function activeProbe(provider, sample, { platform, budget = new RequestBudget(), fetchImpl = fetch, dnsCheck = publicDns } = {}) {
  const endpoint = selectActiveEndpoint(provider, platform);
  if (!endpoint) return sanitizeRecord({ providerId: provider.id, platform: platform ?? null, result: "not_configured", failureCode: "protocol_not_confirmed" });
  const endpointPath = resolveEndpointPath(endpoint, sample, platform);
  if (!endpointPath || !provider.apiHost) return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "not_configured", failureCode: "protocol_not_confirmed" });
  const api = new URL(endpointPath, `https://${provider.apiHost}`);
  if (endpoint.queryField) api.searchParams.set(endpoint.queryField, sample.url);
  const requestPayload = { [endpoint.bodyField]: sample.url, ...(endpoint.bodyDefaults ?? {}) };
  const options = endpoint.method === "POST"
    ? endpoint.bodyEncoding === "form-urlencoded"
      ? { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams(requestPayload).toString() }
      : { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(requestPayload) }
    : { method: "GET", headers: { accept: "application/json" } };
  const started = Date.now();
  const result = await fetchBounded(api.toString(), options, budget, { expectedHosts: new Set([provider.apiHost]), fetcher: fetchImpl, dnsCheck });
  const response = result.response;
  if (!response) return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "deferred", latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: result.failureCode });
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "deferred", httpStatus: response.status, contentType: contentTypeCategory(response.headers), latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: response.status >= 500 ? "upstream_unavailable" : "rate_limited" });
  }
  if (response.status === 401 || response.status === 403 || response.status === 419) {
    return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "blocked", httpStatus: response.status, contentType: contentTypeCategory(response.headers), latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: response.status === 419 ? "session_required" : "access_challenge" });
  }
  const type = contentTypeCategory(response.headers);
  if (response.headers.get("cf-mitigated") === "challenge" || hasChallengeMarker(result.body)) {
    return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "blocked", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "access_challenge" });
  }
  if (type !== "json") return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "no_media", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "non_json_response" });
  let payload;
  try { payload = JSON.parse(result.body); } catch { return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "no_media", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "schema_changed" }); }
  const urls = collectMediaUrls(payload, `https://${provider.apiHost}`);
  const mediaHostSuffixes = new Set();
  const mediaTopologies = new Set();
  let validMediaCount = 0;
  // One Provider request plus one bounded media check keeps each matrix cell at two requests.
  for (const url of urls.slice(0, 1)) {
    const mediaResult = await fetchBounded(url, { method: "GET", headers: { accept: "video/*,audio/*", range: "bytes=0-1023" } }, budget, { media: true, fetcher: fetchImpl, dnsCheck });
    const mediaType = mediaResult.response ? contentTypeCategory(mediaResult.response.headers) : "missing";
    if (mediaResult.response && mediaResult.response.status >= 200 && mediaResult.response.status < 300 && isMp4Response(mediaResult.response.headers, mediaResult.finalUrl ?? url)) {
      validMediaCount += 1;
      const finalUrl = mediaResult.finalUrl ?? url;
      const mediaHost = new URL(finalUrl).hostname.toLowerCase();
      const apiHost = provider.apiHost.toLowerCase();
      mediaTopologies.add(mediaHost === apiHost || mediaHost.endsWith(`.${apiHost}`) ? "provider-stream" : "source-cdn");
      mediaHostSuffixes.add(mediaHostSuffix(finalUrl));
    }
  }
  return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: validMediaCount > 0 ? "resolved" : "no_media", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, resourceCount: urls.length, validMediaCount, mediaHostSuffixes: [...mediaHostSuffixes], mediaTopologies: [...mediaTopologies], redirectCount: result.redirectCount, failureCode: validMediaCount > 0 ? null : "no_valid_media" });
}

export async function loadSamples(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("samples_must_be_array");
  return parsed.map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.url !== "string") throw new Error("invalid_sample");
    return { id: item.id.slice(0, 80), url: item.url };
  });
}

export async function runPassive(ids = catalog.providers.map(({ id }) => id)) {
  const selected = ids.map(providerById).filter(Boolean);
  if (selected.length === 0) throw new Error("no_known_provider");
  const budget = new RequestBudget();
  const results = [];
  for (const provider of selected) results.push(await passiveProbe(provider, { budget }));
  return { requestCount: budget.requestCount, results };
}

export async function runActive(providerId, samples) {
  const provider = providerById(providerId);
  if (!provider) throw new Error("no_known_provider");
  const budget = new RequestBudget({ maxRequests: 6, minIntervalMs: MIN_INTERVAL_MS });
  const results = [];
  for (const sample of samples.slice(0, 2)) results.push(await activeProbe(provider, sample, { budget }));
  return { requestCount: budget.requestCount, results };
}

export async function runMatrix(cells, { fetchImpl = fetch, dnsCheck = publicDns } = {}) {
  if (!Array.isArray(cells) || cells.length === 0) throw new Error("matrix_must_be_non_empty");
  const budget = new RequestBudget({ maxRequests: MAX_MATRIX_REQUESTS, minIntervalMs: MIN_INTERVAL_MS });
  const results = [];
  for (const cell of cells) {
    if (!cell || typeof cell.providerId !== "string" || typeof cell.platform !== "string" || !cell.sample) {
      throw new Error("invalid_matrix_cell");
    }
    const provider = providerById(cell.providerId);
    if (!provider) throw new Error("no_known_provider");
    if (!KNOWN_MATRIX_PLATFORMS.has(cell.platform)) throw new Error("platform_not_allowed");
    const allowedPlatforms = provider.matrixPlatforms ?? (provider.activeEndpoints ?? []).map((endpoint) => endpoint.platform);
    if (allowedPlatforms.length > 0 && !allowedPlatforms.includes(cell.platform)) throw new Error("platform_not_allowed");
    const sample = cell.sample;
    results.push(await activeProbe(provider, sample, { platform: cell.platform, budget, fetchImpl, dnsCheck }));
  }
  return { requestCount: budget.requestCount, results };
}

export async function loadMatrix(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("matrix_must_be_array");
  return parsed.map((cell) => {
    if (!cell || typeof cell.providerId !== "string" || typeof cell.platform !== "string" || !cell.sample) throw new Error("invalid_matrix_cell");
    if (!KNOWN_MATRIX_PLATFORMS.has(cell.platform)) throw new Error("platform_not_allowed");
    if (typeof cell.sample.id !== "string" || typeof cell.sample.url !== "string") throw new Error("invalid_sample");
    return {
      providerId: cell.providerId,
      platform: cell.platform,
      sample: { id: cell.sample.id.slice(0, 80), url: cell.sample.url }
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const mode = args[0] ?? "passive";
  if (mode === "passive") {
    const ids = args.slice(1).filter((arg) => arg !== "--all");
    process.stdout.write(`${JSON.stringify({ event: "provider_lab_passive", ...(await runPassive(ids.length > 0 ? ids : undefined)) })}\n`);
  } else if (mode === "active") {
    const providerId = args[1];
    const platform = args.length >= 4 ? args[2] : undefined;
    const samplePath = args.length >= 4 ? args[3] : args[2];
    if (!providerId || !samplePath) throw new Error("usage: active <provider-id> [platform] <temporary-sample-file>");
    if (platform) {
      const provider = providerById(providerId);
      if (!provider) throw new Error("no_known_provider");
      const samples = await loadSamples(samplePath);
      const budget = new RequestBudget({ maxRequests: 6, minIntervalMs: MIN_INTERVAL_MS });
      const results = [];
      for (const sample of samples.slice(0, 2)) results.push(await activeProbe(provider, sample, { platform, budget }));
      process.stdout.write(`${JSON.stringify({ event: "provider_lab_active", requestCount: budget.requestCount, results })}\n`);
    } else {
      process.stdout.write(`${JSON.stringify({ event: "provider_lab_active", ...(await runActive(providerId, await loadSamples(samplePath))) })}\n`);
    }
  } else if (mode === "matrix") {
    const matrixPath = args[1];
    if (!matrixPath) throw new Error("usage: matrix <temporary-matrix-file>");
    process.stdout.write(`${JSON.stringify({ event: "provider_lab_matrix", ...(await runMatrix(await loadMatrix(matrixPath))) })}\n`);
  } else {
    throw new Error("usage: passive [provider-id ...] | active <provider-id> [platform] <temporary-sample-file> | matrix <temporary-matrix-file>");
  }
}
