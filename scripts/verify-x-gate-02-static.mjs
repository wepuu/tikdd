import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function requireText(text, expected, label) {
  if (!text.includes(expected)) throw new Error(`X-GATE-02 invariant missing: ${label}`);
}

function serviceBlock(compose, name) {
  const match = compose.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z0-9-]+:|^networks:)`, "m"));
  if (!match) throw new Error(`X-GATE-02 invariant missing: ${name} service`);
  return match[0];
}

export function verifyXGate02Static(root = repositoryRoot) {
  const compose = readFileSync(resolve(root, "compose.production.yml"), "utf8");
  const environment = readFileSync(resolve(root, "deploy/production.env.example"), "utf8");
  const api = readFileSync(resolve(root, "apps/api/src/server.ts"), "utf8");
  const worker = readFileSync(resolve(root, "apps/worker/src/worker.ts"), "utf8");
  const preflight = readFileSync(resolve(root, "packages/deployment-preflight/src/index.ts"), "utf8");
  const nginx = readFileSync(resolve(root, "deploy/nginx/tikdd.conf.template"), "utf8");

  for (const service of ["calibration-api-preflight", "calibration-worker-preflight", "calibration-api", "calibration-worker"]) {
    const block = serviceBlock(compose, service);
    requireText(block, 'profiles: ["calibration"]', `${service} default-off profile`);
    requireText(block, 'restart: "no"', `${service} no automatic restart`);
  }
  requireText(compose, "TIKDD_RESOLVE_QUEUE_NAME: resolve\n", "explicit public queue");
  requireText(compose, "TIKDD_RESOLVE_QUEUE_NAME: resolve-internal-ssstwitter-x-nl", "isolated calibration queue");
  requireText(compose, "127.0.0.1:${TIKDD_CALIBRATION_API_HOST_PORT:-3410}:4000", "loopback-only calibration API");
  requireText(compose, "TIKDD_INTERNAL_RUNTIME_ROLE: api", "API role binding");
  requireText(compose, "TIKDD_INTERNAL_RUNTIME_ROLE: worker", "Worker role binding");
  requireText(compose, "/run/tikdd/calibration-api.attestation", "API attestation path");
  requireText(compose, "/run/tikdd/calibration-worker.attestation", "Worker attestation path");
  requireText(compose, 'RESOLVER_CONCURRENCY: "1"', "single calibration worker slot");
  requireText(environment, "TIKDD_CALIBRATION_ENABLE_SSSTWITTER_PROVIDER=false", "Provider default off");
  requireText(environment, "TIKDD_CALIBRATION_ROLLOUT_ENABLED=false", "rollout default off");
  requireText(api, "loadResolveQueueName(process.env.TIKDD_RESOLVE_QUEUE_NAME)", "API queue contract");
  requireText(worker, "loadResolveQueueName(process.env.TIKDD_RESOLVE_QUEUE_NAME)", "Worker queue contract");
  requireText(preflight, "serviceRole: z.enum", "role-bound runtime");
  requireText(preflight, "resolveQueueName: ResolveQueueNameSchema", "queue-bound runtime");
  if (/3410|calibration/i.test(nginx)) throw new Error("X-GATE-02 invariant violated: calibration API is routed by Nginx");

  return {
    profile: "calibration",
    publicQueue: "resolve",
    calibrationQueue: "resolve-internal-ssstwitter-x-nl",
    liveProviderNetwork: false
  };
}
