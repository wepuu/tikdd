import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (value, message) => { if (!value) throw new Error(message); };

export function verifyWorkItem95Static() {
  const productionEnv = read("deploy/production.env.example");
  const operations = read("docs/provider-health-operations.md");
  const adr = read("docs/architecture/adr/0043-low-traffic-circuit-recovery.md");
  const roadmap = read("docs/work-item-95-low-traffic-circuit-recovery.md");

  const policyMatch = productionEnv.match(/^PROVIDER_HEALTH_POLICY_JSON=(.*)$/m);
  assert(policyMatch, "Production Provider health policy is missing.");
  const policy = JSON.parse(policyMatch[1]);
  assert(policy.version === "production-low-traffic-v2", "Production health policy version must be reviewed for low traffic.");
  assert(policy.recoverySuccesses === 1, "Production half-open recovery must require one successful probe.");
  assert(policy.probeLeaseMs === 30_000, "The single half-open probe lease changed unexpectedly.");
  assert(policy.baseCooldownMs === 30_000 && policy.maximumCooldownMs === 900_000, "Circuit cooldown bounds changed unexpectedly.");
  assert(/cache hit|缓存命中/i.test(operations), "Health operations must state that cache hits are not health evidence.");
  assert(/one successful|一次成功|低流量/i.test(adr), "Low-traffic recovery ADR is missing its one-probe decision.");
  assert(/no Provider request|Do not issue a synthetic Provider request|不.*Provider|不主动/i.test(roadmap), "WI95 must record that release verification does not generate Provider traffic.");
  return { policyVersion: policy.version, recoverySuccesses: policy.recoverySuccesses };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify({ event: "work_item_95_static_verification_complete", passed: true, ...verifyWorkItem95Static() })}\n`);
}
