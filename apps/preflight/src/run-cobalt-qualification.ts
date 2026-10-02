import { readFileSync } from "node:fs";
import {
  assertCobaltQualificationTrafficIsolation,
  parseCobaltQualificationPlan,
  readCobaltApiKey,
  runCobaltQualification,
  writeCobaltQualificationTunnelArtifact
} from "./cobalt-qualification";

const inputPath = process.env.TIKDD_COBALT_QUALIFICATION_INPUT ?? "/run/tikdd/cobalt-qualification-input.json";
const keyPath = process.env.TIKDD_COBALT_API_KEYS_FILE ?? "/run/secrets/cobalt_api_keys";
const apiUrl = process.env.COBALT_API_URL ?? "http://cobalt-api:9000/";
const tunnelOutputPath = process.env.TIKDD_COBALT_QUALIFICATION_TUNNEL_OUTPUT ?? "/run/tikdd/cobalt-qualification-tunnel-output.json";
const plan = parseCobaltQualificationPlan(JSON.parse(readFileSync(inputPath, "utf8")));
assertCobaltQualificationTrafficIsolation(plan, {
  approvedPlatforms: process.env.COBALT_APPROVED_PLATFORMS,
  verifiedCapabilities: process.env.COBALT_DELIVERY_VERIFIED_CAPABILITIES
});
const results = await runCobaltQualification(plan, {
  apiUrl,
  apiKey: readCobaltApiKey(keyPath),
  tunnelArtifactSink: (samples) => writeCobaltQualificationTunnelArtifact(tunnelOutputPath, samples)
});
process.stdout.write(`${JSON.stringify({ schemaVersion: "1.0", sampleCount: results.length, results }, null, 2)}\n`);
if (results.some(({ outcome }) => outcome !== "resolved")) process.exitCode = 2;
