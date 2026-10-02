import { readFileSync } from "node:fs";

const API_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SERVICE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
const ALLOWED_DETAIL_KEYS = new Set(["name", "ips", "userAgents", "limit", "allowedServices"]);
const REQUIRED_USER_AGENT = "TikDD/cobalt-secondary";
const MAXIMUM_RESPONSE_BYTES = 16 * 1_024;
const DEFAULT_TIMEOUT_MS = 5_000;
const EXPECTED_PROBE_ERRORS = new Set(["error.api.link.invalid", "error.api.link.unsupported"]);

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 32 ||
      value.some((entry) => typeof entry !== "string" || entry.length < 1 || entry.length > 256)) {
    throw new Error(`Cobalt key registry ${label} must be a bounded string array.`);
  }
  return value;
}

export interface CobaltKeyRegistryReadiness {
  allowedServices: "all" | readonly string[];
  userAgents: readonly string[];
}

export function parseCobaltKeyRegistry(
  value: unknown,
  expectedApiKey: string
): CobaltKeyRegistryReadiness {
  const expected = expectedApiKey.trim();
  if (!API_KEY_PATTERN.test(expected)) {
    throw new Error("COBALT_API_KEY must be one lowercase UUID.");
  }
  if (!isRecord(value)) throw new Error("Cobalt key registry must be an object.");
  const entries = Object.entries(value);
  if (entries.length !== 1) throw new Error("Cobalt key registry must contain exactly one key.");
  const [registryKey, details] = entries[0] as [string, unknown];
  if (!API_KEY_PATTERN.test(registryKey) || registryKey !== expected) {
    throw new Error("Cobalt key registry does not match the configured Worker key.");
  }
  if (!isRecord(details)) throw new Error("Cobalt key registry details must be an object.");
  const unexpected = Object.keys(details).find((key) => !ALLOWED_DETAIL_KEYS.has(key));
  if (unexpected) throw new Error(`Cobalt key registry contains an unsupported detail field: ${unexpected}.`);
  if (details.name !== undefined && (typeof details.name !== "string" || details.name.length < 1 || details.name.length > 128)) {
    throw new Error("Cobalt key registry name must be a bounded string.");
  }
  if (details.limit !== undefined && details.limit !== "unlimited" &&
      (!Number.isInteger(details.limit) || (details.limit as number) < 1)) {
    throw new Error("Cobalt key registry limit must be a positive integer or unlimited.");
  }
  if (details.ips !== undefined) boundedStringArray(details.ips, "ips");
  const userAgents = boundedStringArray(details.userAgents, "userAgents");
  if (!userAgents.includes(REQUIRED_USER_AGENT)) {
    throw new Error("Cobalt key registry must allow the exact TikDD Worker user agent.");
  }
  let allowedServices: "all" | readonly string[];
  if (details.allowedServices === "all") {
    allowedServices = "all";
  } else {
    const services = boundedStringArray(details.allowedServices, "allowedServices");
    if (services.length < 1 || services.some((service) => !SERVICE_PATTERN.test(service)) || new Set(services).size !== services.length) {
      throw new Error("Cobalt key registry allowedServices must contain unique service identifiers.");
    }
    allowedServices = services;
  }
  return { allowedServices, userAgents };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > MAXIMUM_RESPONSE_BYTES) {
    throw new Error("Cobalt authentication probe returned an oversized response.");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAXIMUM_RESPONSE_BYTES) {
    throw new Error("Cobalt authentication probe returned an oversized response.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("Cobalt authentication probe returned invalid JSON.");
  }
}

export interface CobaltAuthReadinessResult {
  httpStatus: number;
  errorCode: string;
}

export async function verifyCobaltAuthReadiness(options: {
  apiUrl: string;
  apiKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<CobaltAuthReadinessResult> {
  const origin = new URL(options.apiUrl);
  if (origin.protocol !== "http:" || origin.hostname !== "cobalt-api" || origin.port !== "9000" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("COBALT_API_URL must be the exact private Cobalt service origin.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(origin, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Api-Key ${options.apiKey}`,
        "user-agent": REQUIRED_USER_AGENT
      },
      body: JSON.stringify({ url: "https://example.invalid/" })
    });
    const body = await readBoundedJson(response);
    const errorCode = isRecord(body) && isRecord(body.error) && typeof body.error.code === "string"
      ? body.error.code
      : null;
    if (response.status !== 400 || !errorCode || !EXPECTED_PROBE_ERRORS.has(errorCode)) {
      throw new Error("Cobalt authentication readiness probe did not reach post-authentication URL validation.");
    }
    return { httpStatus: response.status, errorCode };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new Error("Cobalt authentication readiness probe timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function readAndValidateCobaltKeyRegistry(path: string, expectedApiKey: string): CobaltKeyRegistryReadiness {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error("Cobalt key registry is missing or invalid JSON.");
  }
  return parseCobaltKeyRegistry(value, expectedApiKey);
}
