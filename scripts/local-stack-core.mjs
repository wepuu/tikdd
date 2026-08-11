import { randomBytes } from "node:crypto";

export const LOCAL_STACK_PORTS = Object.freeze([3000, 4000, 4002]);

export const PILOT_PROVIDERS = Object.freeze({
  twittersaver: Object.freeze({
    host: "twittersaver.net",
    approvals: Object.freeze(["TWITTERSAVER_TERMS_APPROVED"])
  }),
  dlpanda: Object.freeze({
    host: "dlpanda.com",
    approvals: Object.freeze(["DLPANDA_TERMS_APPROVED"])
  }),
  ssstwitter: Object.freeze({
    host: "ssstwitter.com",
    approvals: Object.freeze([
      "SSSTWITTER_TERMS_APPROVED",
      "SSSTWITTER_DELIVERY_AUDIT_APPROVED"
    ])
  })
});

const proxyKeys = Object.freeze([
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "NODE_USE_ENV_PROXY"
]);

function isTrue(value) {
  return value === "true";
}

function parseProviders(value) {
  const providers = (value ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
  if (providers.length === 0) {
    throw new Error(
      "TIKDD_PILOT_PROVIDERS must name at least one exact provider: twittersaver, dlpanda, or ssstwitter."
    );
  }
  if (new Set(providers).size !== providers.length) {
    throw new Error("TIKDD_PILOT_PROVIDERS must not contain duplicate provider IDs.");
  }
  for (const provider of providers) {
    if (!Object.hasOwn(PILOT_PROVIDERS, provider)) {
      throw new Error(`Unsupported local pilot provider: ${provider}.`);
    }
  }
  return providers;
}

function parseProxy(value) {
  if (!value) return null;
  let proxy;
  try {
    proxy = new URL(value);
  } catch {
    throw new Error("TIKDD_PILOT_PROXY_URL must be an absolute HTTP proxy URL.");
  }
  if (proxy.protocol !== "http:") {
    throw new Error("TIKDD_PILOT_PROXY_URL currently supports only an explicit http:// proxy.");
  }
  if (!proxy.hostname || !proxy.port) {
    throw new Error("TIKDD_PILOT_PROXY_URL must include a host and port.");
  }
  return proxy;
}

export function parseEnvironmentFile(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function buildLocalStackProfile({
  mode,
  commandEnvironment = process.env,
  fileEnvironment = {},
  entropy = randomBytes
}) {
  if (mode !== "offline" && mode !== "pilot") {
    throw new Error(`Unsupported local stack mode: ${mode}.`);
  }

  const environment = { ...fileEnvironment, ...commandEnvironment };
  for (const key of proxyKeys) delete environment[key];
  environment.NO_PROXY = "localhost,127.0.0.1,::1";
  environment.no_proxy = environment.NO_PROXY;
  environment.NODE_ENV = "development";
  environment.PORT = "3000";
  environment.API_PORT = "4000";
  environment.DELIVERY_PORT = "4002";
  environment.WEB_ORIGIN = "http://localhost:3000";
  environment.NEXT_PUBLIC_API_BASE_URL = "http://localhost:4000";
  environment.NEXT_PUBLIC_DELIVERY_BASE_URL = "http://localhost:4002";
  environment.DELIVERY_PUBLIC_BASE_URL = "http://localhost:4002";
  environment.SITE_URL = "http://localhost:3000";
  environment.DATABASE_URL ??= "postgresql://tikdd:tikdd@localhost:5432/tikdd";
  environment.REDIS_HOST_PORT ??= "16379";
  environment.REDIS_URL ??= `redis://localhost:${environment.REDIS_HOST_PORT}`;
  environment.TIKDD_CANARY_AUTHORIZED = "false";
  environment.PROVIDER_HEALTH_ENABLED = "false";
  environment.PROVIDER_PILOT_GUARD_REQUIRED = "false";

  const readinessToken = entropy(16).toString("hex");
  environment.LOCAL_STACK_READINESS_TOKEN = readinessToken;

  if (mode === "offline") {
    environment.ENABLE_MOCK_PROVIDER = "true";
    environment.ENABLE_TWITTERSAVER_PROVIDER = "false";
    environment.ENABLE_DLPANDA_PROVIDER = "false";
    environment.ENABLE_SSSTWITTER_PROVIDER = "false";
    environment.PROVIDER_ROLLOUT_ENABLED = "false";
    environment.PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS = "false";
    delete environment.DELIVERY_ENCRYPTION_KEY_ID;
    delete environment.DELIVERY_ENCRYPTION_KEY_BASE64URL;
    return {
      mode,
      environment,
      readinessToken,
      providers: [],
      providerHosts: [],
      proxy: null
    };
  }

  if (!isTrue(commandEnvironment.TIKDD_LOCAL_LIVE_AUTHORIZED)) {
    throw new Error(
      "TIKDD_LOCAL_LIVE_AUTHORIZED=true must be set in the current shell before starting a live local pilot."
    );
  }
  const providers = parseProviders(commandEnvironment.TIKDD_PILOT_PROVIDERS);
  for (const provider of providers) {
    for (const approval of PILOT_PROVIDERS[provider].approvals) {
      if (!isTrue(commandEnvironment[approval])) {
        throw new Error(`${approval}=true is required in the current shell for ${provider}.`);
      }
    }
  }

  const proxy = parseProxy(commandEnvironment.TIKDD_PILOT_PROXY_URL);
  if (proxy) {
    environment.HTTP_PROXY = proxy.toString();
    environment.HTTPS_PROXY = proxy.toString();
    environment.NODE_USE_ENV_PROXY = "1";
  }
  environment.ENABLE_MOCK_PROVIDER = "false";
  environment.ENABLE_TWITTERSAVER_PROVIDER = String(providers.includes("twittersaver"));
  environment.ENABLE_DLPANDA_PROVIDER = String(providers.includes("dlpanda"));
  environment.ENABLE_SSSTWITTER_PROVIDER = String(providers.includes("ssstwitter"));
  environment.PROVIDER_ROLLOUT_ENABLED = "false";
  environment.PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS = "true";
  environment.DELIVERY_ENCRYPTION_KEY_ID = `local-pilot-${entropy(8).toString("hex")}`;
  environment.DELIVERY_ENCRYPTION_KEY_BASE64URL = entropy(32).toString("base64url");

  return {
    mode,
    environment,
    readinessToken,
    providers,
    providerHosts: providers.map((provider) => PILOT_PROVIDERS[provider].host),
    proxy
  };
}

export function validateDockerServices(records) {
  for (const service of ["postgres", "redis"]) {
    const record = records.find(
      (candidate) => (candidate.Service ?? candidate.service) === service
    );
    if (!record) throw new Error(`Docker Compose did not report the ${service} service.`);
    const state = String(record.State ?? record.state ?? "").toLowerCase();
    const health = String(record.Health ?? record.health ?? "").toLowerCase();
    if (state !== "running" || health !== "healthy") {
      throw new Error(`${service} is not healthy (state=${state || "unknown"}, health=${health || "unknown"}).`);
    }
  }
}

export async function verifyProviderEgress(providerHosts, probe) {
  const results = [];
  for (const host of providerHosts) {
    try {
      await probe(host);
      results.push({ host, reachable: true });
    } catch {
      throw new Error(`Provider page-host egress failed for ${host}.`);
    }
  }
  return results;
}
