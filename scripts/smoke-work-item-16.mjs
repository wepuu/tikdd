import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const runtimeRoot = resolve(root, "tmp", "work-item-16-smoke");
const secretRoot = resolve(runtimeRoot, "secrets");
const composeArguments = [
  "scripts/docker.mjs", "compose", "--env-file", "deploy/production.env.example",
  "-f", "compose.production.yml", "-f", "compose.production.smoke.yml"
];
const node = process.execPath;
const password = "offline-only-postgres-password";
const redisPassword = "offline-only-redis-password";
const databaseUrl = `postgresql://tikdd:${password}@postgres:5432/tikdd`;
const redisUrl = `redis://:${redisPassword}@redis:6379`;
const base64Key = Buffer.alloc(32, 23).toString("base64url");
const environment = {
  ...process.env,
  TIKDD_PRODUCTION_ENV_FILE: "deploy/production.env.example",
  TIKDD_SECRETS_DIR: secretRoot.replaceAll("\\", "/"),
  TIKDD_GIT_SHA: "f".repeat(40),
  TIKDD_WEB_HOST_PORT: "13300",
  TIKDD_ADMIN_HOST_PORT: "13301",
  TIKDD_API_HOST_PORT: "13400",
  TIKDD_DELIVERY_HOST_PORT: "13402",
  TIKDD_CANARY_AUTHORIZED: "false",
  ENABLE_MOCK_PROVIDER: "false",
  ENABLE_TWITTERSAVER_PROVIDER: "false",
  ENABLE_DLPANDA_PROVIDER: "false",
  ENABLE_SSSTWITTER_PROVIDER: "false",
  PROVIDER_ROLLOUT_ENABLED: "false",
  TIKDD_BUILD_HTTP_PROXY: process.env.TIKDD_BUILD_HTTP_PROXY ?? "",
  TIKDD_BUILD_HTTPS_PROXY: process.env.TIKDD_BUILD_HTTPS_PROXY ?? "",
  HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "",
  NO_PROXY: "localhost,127.0.0.1,::1,postgres,redis"
};

function run(stage, args, options = {}) {
  process.stdout.write(`${JSON.stringify({ event: "work_item_16_smoke_stage_start", stage })}\n`);
  const result = spawnSync(node, [...composeArguments, ...args], {
    cwd: root, env: environment, encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit", windowsHide: true
  });
  if (result.error) throw result.error;
  if (options.expectedStatuses && options.expectedStatuses.includes(result.status)) {
    process.stdout.write(`${JSON.stringify({ event: "work_item_16_smoke_stage_complete", stage, passed: true, expectedStatus: result.status })}\n`);
    return result;
  }
  if (result.status !== 0) {
    if (options.capture) process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    throw new Error(`${stage} failed with status ${result.status}.`);
  }
  process.stdout.write(`${JSON.stringify({ event: "work_item_16_smoke_stage_complete", stage, passed: true })}\n`);
  return result;
}

function writeSecret(name, value) {
  writeFileSync(resolve(secretRoot, name), `${value}\n`, { encoding: "utf8", mode: 0o600 });
}

rmSync(runtimeRoot, { recursive: true, force: true });
mkdirSync(secretRoot, { recursive: true, mode: 0o700 });
writeSecret("postgres_password", password);
writeSecret("redis_password", redisPassword);
writeSecret("redis_url", redisUrl);
for (const name of [
  "public_content_database_url", "api_database_url", "worker_database_url", "delivery_database_url",
  "admin_database_url", "ops_database_url", "migration_database_url"
]) writeSecret(name, databaseUrl);
for (const name of ["delivery_encryption_key", "task_admission_hmac_key", "provider_rollout_cohort_key", "internal_preflight_hmac_key"]) writeSecret(name, base64Key);
for (const name of ["provider_diagnostics_token", "pilot_evidence_diagnostics_token", "admin_csrf_secret", "admin_command_secret", "admin_origin_proof", "public_content_revalidation_secret"]) writeSecret(name, `offline-only-${name}-value-with-more-than-32-characters`);

let succeeded = false;
try {
  run("compose-config", ["--profile", "admin", "--profile", "ops", "--profile", "admin-ops", "config", "--quiet"]);
  if (process.env.TIKDD_SMOKE_SKIP_BUILD !== "true") {
    run("image-build", ["--profile", "admin", "build", "web", "api", "admin"]);
  }
  run("datastores", ["up", "-d", "postgres", "redis"]);
  run("migration", ["--profile", "ops", "run", "--rm", "migration"]);
  run("public-services", ["up", "-d", "web", "api", "worker", "delivery"]);
  run("admin-services", ["--profile", "admin", "up", "-d", "admin-api", "admin"]);
  run("health-wait", ["--profile", "admin", "up", "-d", "--wait", "web", "api", "worker", "delivery", "admin-api", "admin"]);
  run("cleanup-dry-run", ["--profile", "ops", "run", "--rm", "cleanup-dry-run"]);
  run("cleanup", ["--profile", "ops", "run", "--rm", "cleanup"]);
  run("evidence", ["--profile", "ops", "run", "--rm", "evidence"]);
  run("canary-fail-closed", ["--profile", "ops", "run", "--rm", "--no-deps", "canary"], { expectedStatuses: [1, 2] });
  run("preflight-fail-closed", ["--profile", "ops", "run", "--rm", "--no-deps", "preflight"], { expectedStatuses: [2] });
  const ports = run("published-ports", ["--profile", "admin", "ps", "--format", "json"], { capture: true });
  const text = ports.stdout ?? "";
  for (const port of ["13300", "13301", "13400", "13402"]) {
    if (!text.includes(`127.0.0.1:${port}`)) throw new Error(`Expected loopback publication ${port} is missing.`);
  }
  if (text.includes("0.0.0.0") || /(?:5432|6379|4100)->/.test(text)) throw new Error("A private service acquired a host publication.");
  run("idle-memory-snapshot", ["stats", "--no-stream"]);
  succeeded = true;
} finally {
  if (process.env.TIKDD_SMOKE_KEEP_ON_FAILURE === "true" && !succeeded) {
    process.stderr.write("Smoke project retained for bounded failure diagnostics. Run the exact cleanup command after inspection.\n");
  } else {
    try { run("cleanup-smoke-project", ["--profile", "admin", "--profile", "ops", "down", "-v", "--remove-orphans"]); }
    finally { rmSync(runtimeRoot, { recursive: true, force: true }); }
  }
}

process.stdout.write(`${JSON.stringify({
  event: "work_item_16_offline_smoke_complete", passed: succeeded, liveProviderNetwork: false,
  productionDatabase: false, cloudflareAccess: false, productionMigration: false
})}\n`);
