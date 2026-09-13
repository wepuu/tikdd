import { readFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { pathToFileURL } from "node:url";
import catalog from "./catalog.json" with { type: "json" };
import {
  contentTypeCategory,
  isPublicIp,
  isSafeHttpsUrl,
  mediaHostSuffix,
  sanitizeFailure,
  sanitizeRecord
} from "./sanitize.mjs";

export const MAX_REDIRECTS = 3;
export const MAX_BODY_BYTES = 512_000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MIN_INTERVAL_MS = 10_000;
export const MAX_REQUESTS = 24;

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
    const body = media ? await readLimitedText(response) : await readLimitedText(response);
    return { response, body, redirectCount, failureCode: null };
  }
}

function collectHttpsUrls(value, output = [], seen = new Set()) {
  if (output.length >= 50 || value === null || value === undefined) return output;
  if (typeof value === "string") {
    if (isSafeHttpsUrl(value) && !seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHttpsUrls(item, output, seen);
    return output;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectHttpsUrls(item, output, seen);
  }
  return output;
}

export async function passiveProbe(provider, { fetchImpl = fetch, budget = new RequestBudget(), dnsCheck = publicDns } = {}) {
  if (provider.localOnly) return sanitizeRecord({ providerId: provider.id, result: "local_only", failureCode: "local_source" });
  const started = Date.now();
  try {
    const probeUrl = provider.probeUrl ?? provider.landingUrl;
    const result = await fetchBounded(probeUrl, { method: "GET", headers: { accept: "text/html,application/xhtml+xml,application/json" } }, budget, { expectedHosts: new Set([new URL(probeUrl).hostname.toLowerCase()]), fetcher: fetchImpl, dnsCheck });
    const response = result.response;
    const challenge = response?.headers.get("cf-mitigated") === "challenge" || hasChallengeMarker(result.body);
    const state = result.failureCode === "timeout" || response?.status === 408 || response?.status === 429 || (response?.status ?? 0) >= 500
      ? "deferred"
      : result.failureCode || challenge || response?.status === 401 || response?.status === 403
        ? "blocked"
        : response && response.status >= 200 && response.status < 400
          ? "reachable"
          : "blocked";
    return sanitizeRecord({ providerId: provider.id, result: state, httpStatus: response?.status ?? null, contentType: response ? contentTypeCategory(response.headers) : "missing", latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: result.failureCode ?? (challenge || response?.status === 401 || response?.status === 403 ? "access_challenge" : null) });
  } catch (error) {
    return sanitizeRecord({ providerId: provider.id, result: "blocked", latencyMs: Date.now() - started, failureCode: sanitizeFailure(error) });
  }
}

export async function activeProbe(provider, sample, { budget = new RequestBudget(), fetchImpl = fetch, dnsCheck = publicDns } = {}) {
  if (!provider.active) return sanitizeRecord({ providerId: provider.id, result: "not_configured", failureCode: "protocol_not_confirmed" });
  const endpoint = provider.active;
  const api = new URL(endpoint.path, `https://${provider.apiHost}`);
  if (endpoint.queryField) api.searchParams.set(endpoint.queryField, sample.url);
  const options = endpoint.method === "POST"
    ? { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ [endpoint.bodyField]: sample.url }) }
    : { method: "GET", headers: { accept: "application/json" } };
  const started = Date.now();
  const result = await fetchBounded(api.toString(), options, budget, { expectedHosts: new Set([provider.apiHost]), fetcher: fetchImpl, dnsCheck });
  const response = result.response;
  if (!response) return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "deferred", latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: result.failureCode });
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "deferred", httpStatus: response.status, contentType: contentTypeCategory(response.headers), latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: response.status >= 500 ? "upstream_unavailable" : "rate_limited" });
  }
  if (response.status === 401 || response.status === 403) {
    return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "blocked", httpStatus: response.status, contentType: contentTypeCategory(response.headers), latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "access_challenge" });
  }
  const type = contentTypeCategory(response.headers);
  if (response.headers.get("cf-mitigated") === "challenge" || hasChallengeMarker(result.body)) {
    return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "blocked", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "access_challenge" });
  }
  if (type !== "json") return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "no_media", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "non_json_response" });
  let payload;
  try { payload = JSON.parse(result.body); } catch { return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: "no_media", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, redirectCount: result.redirectCount, failureCode: "schema_changed" }); }
  const urls = collectHttpsUrls(payload);
  const mediaHostSuffixes = new Set();
  let validMediaCount = 0;
  for (const url of urls.slice(0, 10)) {
    const mediaResult = await fetchBounded(url, { method: "GET", headers: { accept: "video/*,audio/*", range: "bytes=0-1023" } }, budget, { media: true, fetcher: fetchImpl, dnsCheck });
    const mediaType = mediaResult.response ? contentTypeCategory(mediaResult.response.headers) : "missing";
    if (mediaResult.response && mediaResult.response.status >= 200 && mediaResult.response.status < 300 && (mediaType === "video" || /\.mp4(?:$|[?#])/i.test(url))) {
      validMediaCount += 1;
      mediaHostSuffixes.add(mediaHostSuffix(url));
    }
  }
  return sanitizeRecord({ providerId: provider.id, endpointId: endpoint.id, platform: endpoint.platform, sourceRef: sample.id, result: validMediaCount > 0 ? "resolved" : "no_media", httpStatus: response.status, contentType: type, latencyMs: Date.now() - started, resourceCount: urls.length, validMediaCount, mediaHostSuffixes: [...mediaHostSuffixes], redirectCount: result.redirectCount, failureCode: validMediaCount > 0 ? null : "no_valid_media" });
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const mode = args[0] ?? "passive";
  if (mode === "passive") {
    const ids = args.slice(1).filter((arg) => arg !== "--all");
    process.stdout.write(`${JSON.stringify({ event: "provider_lab_passive", ...(await runPassive(ids.length > 0 ? ids : undefined)) })}\n`);
  } else if (mode === "active") {
    const providerId = args[1];
    const samplePath = args[2];
    if (!providerId || !samplePath) throw new Error("usage: active <provider-id> <temporary-sample-file>");
    process.stdout.write(`${JSON.stringify({ event: "provider_lab_active", ...(await runActive(providerId, await loadSamples(samplePath))) })}\n`);
  } else {
    throw new Error("usage: passive [provider-id ...] | active <provider-id> <temporary-sample-file>");
  }
}
