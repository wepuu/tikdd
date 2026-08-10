import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  throw new Error("DATABASE_URL and REDIS_URL are required for the work item 10 verification gate.");
}
if (process.env.WORK_ITEM_10_ALLOW_LIVE_NETWORK === "true") {
  throw new Error("The deterministic work item 10 gate cannot enable live provider network access.");
}

const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const prefix = pnpmCli ? [pnpmCli] : [];
const offlineEnvironment = {
  ...process.env,
  WORK_ITEM_10_ALLOW_LIVE_NETWORK: "false",
  TIKDD_CANARY_AUTHORIZED: "false",
  CANARY_ID: "",
  CANARY_PROVIDER: "",
  HTTP_PROXY: "",
  HTTPS_PROXY: "",
  ALL_PROXY: "",
  http_proxy: "",
  https_proxy: "",
  all_proxy: "",
  ENABLE_TWITTERSAVER_PROVIDER: "false",
  ENABLE_SSSTWITTER_PROVIDER: "false",
  ENABLE_DLPANDA_PROVIDER: "false",
  ENABLE_MOCK_PROVIDER: "false",
  NO_PROXY: "localhost,127.0.0.1,::1"
};

const stages = [
  ["migrations-and-runtime-schema", ["db:migrate"]],
  ["external-evidence-contract", ["verify:work-item-10:evidence"]],
  ["provider-routing-delivery-and-public-contracts", ["test:work-item-10:contracts"]],
  ["delivery-transaction-and-replay", ["db:verify-delivery-transaction"]],
  ["operator-rollout-deny-and-stale-control", ["verify:rollout-control"]],
  ["pilot-hold-rollback-recovery-and-audit", ["verify:pilot-control"]],
  ["admission-and-distributed-concurrency", ["verify:admission-control"]],
  ["circuit-failure-and-half-open-recovery", ["verify:routing-health"]],
  ["canary-metadata-lease-and-retention", ["verify:canary"]],
  ["bounded-cleanup-and-repeat", ["verify:cleanup"]],
  ["verification-residue-is-empty", ["verify:work-item-10:residue"]],
  ["repository-quality-tests-and-production-builds", ["check"]]
];

const startedAt = Date.now();
const results = [];
for (const [name, args] of stages) {
  const stageStartedAt = Date.now();
  process.stdout.write(`${JSON.stringify({ event: "work_item_10_stage_start", stage: name })}\n`);
  const result = spawnSync(command, [...prefix, ...args], {
    cwd: process.cwd(),
    env: offlineEnvironment,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  const durationMs = Date.now() - stageStartedAt;
  const passed = result.status === 0;
  results.push({ stage: name, passed, durationMs });
  process.stdout.write(`${JSON.stringify({ event: "work_item_10_stage_complete", stage: name, passed, durationMs })}\n`);
  if (!passed) {
    process.stderr.write("Work item 10 verification stopped at the failed stage.\n");
    process.exit(result.status ?? 1);
  }
}

process.stdout.write(`${JSON.stringify({
  event: "work_item_10_deterministic_verification_complete",
  passed: true,
  liveProviderNetwork: false,
  externalPilotEvidence: "separate_gate",
  stageCount: results.length,
  durationMs: Date.now() - startedAt,
  stages: results
})}\n`);
