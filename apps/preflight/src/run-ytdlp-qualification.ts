import { readFileSync } from "node:fs";
import { parseYtDlpQualificationPlan, assertYtDlpQualificationTrafficIsolation, runYtDlpQualification } from "./ytdlp-qualification";

const inputPath = process.env.TIKDD_YTDLP_QUALIFICATION_INPUT ?? "/run/tikdd/ytdlp-qualification-input.json";
const secretPath = process.env.YTDLP_RUNNER_HMAC_SECRET_FILE ?? "/run/secrets/ytdlp_runner_hmac_secret";
const apiUrl = process.env.YTDLP_RUNNER_API_URL ?? "http://ytdlp-runner:9100/";
const plan = parseYtDlpQualificationPlan(JSON.parse(readFileSync(inputPath, "utf8")));
assertYtDlpQualificationTrafficIsolation(plan, {
  enabled: process.env.ENABLE_YTDLP_PROVIDER,
  approvedPlatforms: process.env.YTDLP_APPROVED_PLATFORMS,
  verifiedCapabilities: process.env.YTDLP_DELIVERY_VERIFIED_CAPABILITIES
});
const results = await runYtDlpQualification(plan, {
  apiUrl,
  hmacSecret: readFileSync(secretPath, "utf8").trim()
});
process.stdout.write(`${JSON.stringify({ schemaVersion: "1.0", sampleCount: results.length, results }, null, 2)}\n`);
if (results.some(({ outcome }) => outcome !== "resolved")) process.exitCode = 2;
