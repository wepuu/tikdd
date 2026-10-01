import { readFileSync } from "node:fs";
import { parseCobaltQualificationPlan, readCobaltApiKey, runCobaltQualification } from "./cobalt-qualification";

const inputPath = process.env.TIKDD_COBALT_QUALIFICATION_INPUT ?? "/run/tikdd/cobalt-qualification-input.json";
const keyPath = process.env.TIKDD_COBALT_API_KEYS_FILE ?? "/run/secrets/cobalt_api_keys";
const apiUrl = process.env.COBALT_API_URL ?? "http://cobalt-api:9000/";
const plan = parseCobaltQualificationPlan(JSON.parse(readFileSync(inputPath, "utf8")));
const results = await runCobaltQualification(plan, { apiUrl, apiKey: readCobaltApiKey(keyPath) });
process.stdout.write(`${JSON.stringify({ schemaVersion: "1.0", sampleCount: results.length, results }, null, 2)}\n`);
if (results.some(({ outcome }) => outcome !== "resolved")) process.exitCode = 2;
