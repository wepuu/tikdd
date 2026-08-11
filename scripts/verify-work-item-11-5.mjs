import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  throw new Error("DATABASE_URL and REDIS_URL are required for work item 11.5 verification.");
}
const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const prefix = pnpmCli ? [pnpmCli] : [];
const environment = {
  ...process.env,
  TIKDD_CANARY_AUTHORIZED: "false",
  WORK_ITEM_10_ALLOW_LIVE_NETWORK: "false",
  TIKDD_DEPLOYMENT_STAGE: "verification",
  TIKDD_DEPLOYMENT_ID: "",
  TIKDD_OBSERVATION_CLASS: "public",
  TIKDD_INTERNAL_PREFLIGHT_ATTESTATION: "",
  TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL: "",
  ENABLE_TWITTERSAVER_PROVIDER: "false",
  ENABLE_SSSTWITTER_PROVIDER: "false",
  ENABLE_DLPANDA_PROVIDER: "false",
  ENABLE_MOCK_PROVIDER: "false",
  HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: "",
  NO_PROXY: "localhost,127.0.0.1,::1"
};
const stages = [
  ["migrations", ["db:migrate"]],
  ["preflight-contracts-attestation-and-failure-matrix", ["test:work-item-11-5"]],
  ["pending-provider-use-sanitized-report", ["verify:preflight"]],
  ["internal-observation-admission-and-replay", ["db:verify-task-admission"]],
  ["emergency-deny-stale-rollout-and-worker-restart", ["verify:rollout-control"]],
  ["restrictive-guard-and-manual-recovery", ["verify:pilot-control"]],
  ["cleanup-delay-expiry-and-repeat", ["verify:cleanup"]],
  ["verification-residue", ["verify:work-item-11:residue"]],
  ["repository-quality", ["check"]]
];
for (const [stage, args] of stages) {
  const started = Date.now();
  process.stdout.write(`${JSON.stringify({ event: "work_item_11_5_stage_start", stage })}\n`);
  const result = spawnSync(command, [...prefix, ...args], { cwd: process.cwd(), env: environment, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  const passed = result.status === 0;
  process.stdout.write(`${JSON.stringify({ event: "work_item_11_5_stage_complete", stage, passed, durationMs: Date.now() - started })}\n`);
  if (!passed) process.exit(result.status ?? 1);
}
process.stdout.write(`${JSON.stringify({ event: "work_item_11_5_verification_complete", passed: true, liveProviderNetwork: false, pilotTrafficEnabled: false, publicOpenApiChanged: false, stageCount: stages.length })}\n`);
