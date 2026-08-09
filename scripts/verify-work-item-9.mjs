import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  throw new Error("DATABASE_URL and REDIS_URL are required for the work item 9 verification gate.");
}

const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const prefix = pnpmCli ? [pnpmCli] : [];
const stages = [
  ["migrations", ["db:migrate"]],
  ["rollout-kill-switch-and-stale-control", ["verify:rollout-control"]],
  ["idempotency-and-duplicate-concurrency", ["db:verify-task-admission"]],
  ["quota-and-distributed-concurrency", ["verify:admission-control"]],
  ["failure-health-and-half-open-recovery", ["verify:routing-health"]],
  ["bounded-cleanup-and-repeat", ["verify:cleanup"]],
  ["canary-persistence-lease-and-retention", ["verify:canary"]],
  ["repository-quality-and-failure-tests", ["check"]]
];

const startedAt = Date.now();
const results = [];
for (const [name, args] of stages) {
  const stageStartedAt = Date.now();
  process.stdout.write(`${JSON.stringify({ event: "work_item_9_stage_start", stage: name })}\n`);
  const result = spawnSync(command, [...prefix, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) throw result.error;
  const durationMs = Date.now() - stageStartedAt;
  const passed = result.status === 0;
  results.push({ stage: name, passed, durationMs });
  process.stdout.write(`${JSON.stringify({ event: "work_item_9_stage_complete", stage: name, passed, durationMs })}\n`);
  if (!passed) {
    process.stderr.write("Work item 9 verification stopped at the failed stage.\n");
    process.exit(result.status ?? 1);
  }
}

process.stdout.write(`${JSON.stringify({
  event: "work_item_9_verification_complete",
  passed: true,
  stageCount: results.length,
  durationMs: Date.now() - startedAt,
  stages: results
})}\n`);
