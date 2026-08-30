import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InternalPreflightPlanSchema, OperationalSignalsSchema, evaluateInternalPreflight,
  issueInternalPreflightAttestation, loadInternalRuntime
} from "@tikdd/deployment-preflight";
import { loadPreflightProviderManifests } from "./provider-manifests";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const planPath = resolve(repositoryRoot, process.env.TIKDD_INTERNAL_PREFLIGHT_PLAN_PATH ?? "config/x-internal-preflight.json");
const plan = InternalPreflightPlanSchema.parse(JSON.parse(readFileSync(planPath, "utf8")));
let rawSignals: unknown = {};
try { rawSignals = JSON.parse(process.env.TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON ?? "{}"); }
catch { throw new Error("TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON must contain valid JSON."); }
const signals = OperationalSignalsSchema.parse(rawSignals);
const runtime = loadInternalRuntime();
const manifests = loadPreflightProviderManifests(runtime.enabledProviders);
const report = evaluateInternalPreflight({ plan, runtime, signals, manifests });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.decision !== "ready") process.exitCode = 2;
else {
  const key = process.env.TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL;
  const output = process.env.TIKDD_INTERNAL_PREFLIGHT_ATTESTATION_OUTPUT;
  if (!key || !output) throw new Error("Ready preflight requires an HMAC key and an explicit attestation output path.");
  const attestation = issueInternalPreflightAttestation({ report, runtime, encodedKey: key, ttlMs: plan.bounds.attestationTtlMs });
  writeFileSync(resolve(repositoryRoot, output), `${attestation}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}
