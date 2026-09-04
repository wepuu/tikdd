import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (value, message) => { if (!value) throw new Error(message); };

function serviceBlock(compose, name) {
  const pattern = new RegExp(`^  ${name.replaceAll("-", "\\-")}:\\r?\\n([\\s\\S]*?)(?=^  [a-z0-9][a-z0-9-]*:\\r?$|^networks:\\r?$)`, "m");
  const match = compose.match(pattern);
  assert(match, `Production Compose service is missing: ${name}`);
  return match[1];
}

function networks(block) {
  const match = block.match(/^    networks:\r?\n((?:      - [a-z0-9-]+\r?\n)+)/m);
  return match ? [...match[1].matchAll(/- ([a-z0-9-]+)/g)].map((item) => item[1]) : [];
}

export function verifyWorkItem17Static() {
  const compose = read("compose.production.yml");
  const productionEnv = read("deploy/production.env.example");
  const canaryConfig = JSON.parse(read("config/provider-canaries.json"));
  const migration = read("infra/migrations/0021_operational_service_status.sql");
  const rootPackage = JSON.parse(read("package.json"));
  const persistencePackage = JSON.parse(read("packages/persistence/package.json"));
  const serviceBlocks = Object.fromEntries([
    "canary", "evidence", "cleanup", "cleanup-dry-run",
    "canary-scheduled", "evidence-scheduled", "cleanup-scheduled", "operational-readiness"
  ].map((name) => [name, serviceBlock(compose, name)]));

  assert(canaryConfig.scheduledCanaryIds?.length === 1 && canaryConfig.scheduledCanaryIds[0] === "ssstwitter-x-recurring-001", "Recurring Canary authorization must contain exactly ssstwitter-x-recurring-001.");
  const recurring = canaryConfig.canaries.find(({ id }) => id === "ssstwitter-x-recurring-001");
  assert(recurring?.provider === "ssstwitter" && recurring.platform === "x" && recurring.url === "https://x.com/SpaceX/status/2093477720638341395?s=20", "The recurring Canary tuple changed.");
  assert(!canaryConfig.scheduledCanaryIds.includes("twittersaver-x-authorized-001") && !canaryConfig.scheduledCanaryIds.includes("dlpanda-tiktok-authorized-001"), "Manual TwitterSaver/DLPanda definitions cannot be recurring.");
  assert(/^CANARY_REGION=canary-global$/m.test(productionEnv), "Production Canary region must be canary-global.");
  assert(/^WORKER_REGION=nl$/m.test(productionEnv), "Production Worker region must remain nl.");
  assert(/^TIKDD_CANARY_AUTHORIZED=false$/m.test(productionEnv) && /^TIKDD_SCHEDULED_CANARY_AUTHORIZED=true$/m.test(productionEnv), "Manual and scheduled Canary authorization flags must remain separate.");
  assert(/^PROVIDER_ROLLOUT_ENABLED=false$/m.test(productionEnv), "Public rollout must remain disabled.");
  assert(/operational_service_status/.test(migration) && /GRANT SELECT, INSERT, UPDATE ON TABLE operational_service_status TO tikdd_ops/.test(migration), "Operational status migration or narrow tikdd_ops grant is missing.");
  assert(!/GRANT\s+ALL|SUPERUSER|OWNER\s+TO/i.test(migration), "Operational status migration grants are too broad.");
  assert(rootPackage.scripts?.["verify:operational-services"] === "pnpm --filter @tikdd/persistence db:verify-operational-services", "Operational readiness command is missing.");
  assert(rootPackage.scripts?.["verify:work-item-17"] === "node scripts/verify-work-item-17.mjs", "WI17 verifier command is missing.");
  assert(persistencePackage.scripts?.["db:verify-operational-services"] === "tsx src/verify-operational-services.ts", "Persistence operational verifier is missing.");

  assert(/command: \["pnpm", "canary:run"\]/.test(serviceBlocks.canary), "Manual Canary service changed.");
  assert(/command: \["pnpm", "evidence:run"\]/.test(serviceBlocks.evidence), "Manual evidence service changed.");
  assert(/command: \["pnpm", "cleanup:run"\]/.test(serviceBlocks.cleanup), "Manual cleanup service changed.");
  assert(/command: \["pnpm", "cleanup:dry-run"\]/.test(serviceBlocks["cleanup-dry-run"]), "Manual cleanup dry-run service changed.");
  assert(/command: \["pnpm", "canary:scheduled"\]/.test(serviceBlocks["canary-scheduled"]), "Scheduled Canary wrapper is missing.");
  assert(/command: \["pnpm", "evidence:scheduled"\]/.test(serviceBlocks["evidence-scheduled"]), "Scheduled evidence wrapper is missing.");
  assert(/command: \["pnpm", "cleanup:scheduled"\]/.test(serviceBlocks["cleanup-scheduled"]), "Scheduled cleanup wrapper is missing.");
  assert(JSON.stringify(networks(serviceBlocks["canary-scheduled"])) === JSON.stringify(["data", "provider-egress"]), "Scheduled Canary network boundary changed.");
  assert(JSON.stringify(networks(serviceBlocks["evidence-scheduled"])) === JSON.stringify(["data"]), "Scheduled evidence network boundary changed.");
  assert(JSON.stringify(networks(serviceBlocks["cleanup-scheduled"])) === JSON.stringify(["data"]), "Scheduled cleanup network boundary changed.");
  for (const name of ["canary-scheduled", "evidence-scheduled", "cleanup-scheduled", "operational-readiness"]) {
    assert(/restart: "no"/.test(serviceBlocks[name]), `${name} must be one-shot.`);
    assert(!/^    ports:/m.test(serviceBlocks[name]), `${name} must not publish a host port.`);
    assert(/^    secrets:/m.test(serviceBlocks[name]), `${name} must declare explicit secrets.`);
  }
  assert(/TIKDD_REQUIRED_SECRET_ENV_VARS: DATABASE_URL REDIS_URL PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL/.test(serviceBlocks["canary-scheduled"]), "Scheduled Canary secret boundary changed.");
  assert(!/DELIVERY_ENCRYPTION_KEY|ADMIN_CSRF|ADMIN_COMMAND|CLOUDFLARE/.test(serviceBlocks["canary-scheduled"] + serviceBlocks["evidence-scheduled"] + serviceBlocks["cleanup-scheduled"]), "Scheduled jobs received unrelated secrets.");

  const units = ["tikdd-canary.service", "tikdd-canary.timer", "tikdd-evidence.service", "tikdd-evidence.timer", "tikdd-cleanup.service", "tikdd-cleanup.timer"];
  for (const unit of units) assert(read(`deploy/systemd/${unit}`).length > 0, `Missing systemd unit: ${unit}`);
  for (const service of ["tikdd-canary.service", "tikdd-evidence.service", "tikdd-cleanup.service"]) {
    const text = read(`deploy/systemd/${service}`);
    assert(/Type=oneshot/.test(text) && /TimeoutStartSec=/.test(text) && !/Restart=always/.test(text), `${service} must be bounded oneshot.`);
    assert(!/PASSWORD|TOKEN|DATABASE_URL=|REDIS_URL=/.test(text), `${service} embeds a credential.`);
  }
  for (const timer of ["tikdd-canary.timer", "tikdd-evidence.timer", "tikdd-cleanup.timer"]) {
    const text = read(`deploy/systemd/${timer}`);
    assert(/Persistent=true/.test(text) && /Unit=tikdd-(?:canary|evidence|cleanup)\.service/.test(text), `${timer} timer linkage or persistence is missing.`);
  }
  for (const script of ["run-scheduled-operation.sh", "install-operational-timers.sh", "verify-operational-scheduler.sh"]) {
    const text = read(`scripts/${script}`);
    assert(/^#!\/bin\/sh\nset -eu/.test(text), `${script} must fail closed with set -eu.`);
    assert(!/DATABASE_URL=|REDIS_URL=|PASSWORD=|TOKEN=/.test(text), `${script} embeds credentials.`);
  }
  return { scheduledCanaryIds: canaryConfig.scheduledCanaryIds, serviceCount: 4, timerCount: 3 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify({ event: "work_item_17_static_verification_complete", passed: true, ...verifyWorkItem17Static() })}\n`);
}
