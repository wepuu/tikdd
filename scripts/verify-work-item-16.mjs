import { spawnSync } from "node:child_process";
import { verifyWorkItem16Static } from "./verify-work-item-16-static.mjs";

const safeEnvironment = {
  ...process.env,
  TIKDD_PRODUCTION_ENV_FILE: "deploy/production.env.example",
  TIKDD_CANARY_AUTHORIZED: "false",
  WORK_ITEM_10_ALLOW_LIVE_NETWORK: "false",
  ENABLE_MOCK_PROVIDER: "false",
  ENABLE_TWITTERSAVER_PROVIDER: "false",
  ENABLE_DLPANDA_PROVIDER: "false",
  ENABLE_SSSTWITTER_PROVIDER: "false",
  PROVIDER_ROLLOUT_ENABLED: "false",
  HTTP_PROXY: "", HTTPS_PROXY: "", ALL_PROXY: "", http_proxy: "", https_proxy: "", all_proxy: ""
};

function run(stage, command, args) {
  process.stdout.write(`${JSON.stringify({ event: "work_item_16_stage_start", stage, liveNetwork: false })}\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(), env: safeEnvironment, stdio: "inherit", windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  process.stdout.write(`${JSON.stringify({ event: "work_item_16_stage_complete", stage, passed: true })}\n`);
}

verifyWorkItem16Static();
process.stdout.write(`${JSON.stringify({ event: "work_item_16_stage_complete", stage: "static-topology", passed: true })}\n`);

const pnpmCli = process.env.npm_execpath;
const pnpmCommand = pnpmCli ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const pnpmPrefix = pnpmCli ? [pnpmCli] : [];
run("deployment-contract-tests", pnpmCommand, [...pnpmPrefix, "exec", "vitest", "run", "scripts/verify-work-item-16.test.mjs", "packages/persistence/test/database-pool-config.test.ts"]);
run("compose-config", process.execPath, ["scripts/docker.mjs", "compose", "--env-file", "deploy/production.env.example", "-f", "compose.production.yml", "--profile", "admin", "--profile", "ops", "--profile", "admin-ops", "config", "--quiet"]);

process.stdout.write(`${JSON.stringify({
  event: "work_item_16_verification_complete", passed: true, liveProviderNetwork: false,
  cloudflareAccess: false, productionInfrastructureAccess: false, workItem17Implemented: false
})}\n`);
