import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { InternalPreflightPlanSchema, evaluateInternalPreflight, loadInternalRuntime } from "@tikdd/deployment-preflight";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const pending = InternalPreflightPlanSchema.parse(JSON.parse(readFileSync(resolve(repositoryRoot, "config/x-internal-preflight.json"), "utf8")));
const runtime = loadInternalRuntime({});
const report = evaluateInternalPreflight({ plan: pending, runtime, signals: {
  postgresReady: false, redisReady: false, providerEgressReady: false, cleanupLastSucceededAt: null,
  evidenceLastSucceededAt: null, emergencyDenyPropagationMs: null, workerRestartFailClosed: false,
  deliveryExpiryFailClosed: false, manualRecoveryRequired: false
}});
assert.equal(report.decision, "blocked");
assert.ok(report.blockers.some((check) => check.id === "provider_use:twittersaver"));
assert.doesNotMatch(JSON.stringify(report), /sourceUrl|targetUrl|tokenValue|cookie|headerValue|payload|secretValue/i);
process.stdout.write("Pending provider-use confirmation and deployment settings fail closed with a sanitized report.\n");
