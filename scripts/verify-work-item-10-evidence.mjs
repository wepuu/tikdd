import { readFileSync } from "node:fs";

const evidencePath = new URL("../config/x-pilot-evidence.json", import.meta.url);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const allowedTopLevel = new Set(["schemaVersion", "status", "requiredConsecutiveDays", "providers", "dailyReviews"]);
const forbiddenKey = /(url|task|candidate|cookie|header|token|secret|payload|media|title|author|address)/i;

function inspect(value, path = []) {
  if (typeof value === "string" && /(?:https?:\/\/|x\.com\/|twitter\.com\/)/i.test(value)) {
    throw new Error(`Operational evidence contains a URL-like value at ${path.join(".")}.`);
  }
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, [...path, String(index)]));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKey.test(key)) throw new Error(`Operational evidence contains prohibited key ${[...path, key].join(".")}.`);
    inspect(child, [...path, key]);
  }
}

if (evidence.schemaVersion !== 1) throw new Error("X pilot evidence schemaVersion must be 1.");
if (!['pending', 'complete'].includes(evidence.status)) throw new Error("X pilot evidence status is invalid.");
if (evidence.requiredConsecutiveDays !== 7) throw new Error("X pilot evidence must require seven consecutive days.");
if (Object.keys(evidence).some((key) => !allowedTopLevel.has(key))) throw new Error("X pilot evidence contains an unknown top-level field.");
if (!Array.isArray(evidence.providers) || [...evidence.providers].sort().join(",") !== "ssstwitter,twittersaver") {
  throw new Error("X pilot evidence must cover exactly TwitterSaver and SSSTwitter.");
}
if (!Array.isArray(evidence.dailyReviews)) throw new Error("X pilot dailyReviews must be an array.");
inspect(evidence);

const dates = evidence.dailyReviews.map((review) => review.date);
if (new Set(dates).size !== dates.length) throw new Error("X pilot evidence contains duplicate review dates.");
for (let index = 1; index < dates.length; index += 1) {
  const previous = new Date(`${dates[index - 1]}T00:00:00.000Z`).getTime();
  const current = new Date(`${dates[index]}T00:00:00.000Z`).getTime();
  if (current - previous !== 86_400_000) throw new Error("X pilot evidence review dates are not consecutive.");
}
if (evidence.status === "complete") {
  if (dates.length < evidence.requiredConsecutiveDays) throw new Error("Complete X pilot evidence needs seven daily reviews.");
  for (const review of evidence.dailyReviews) {
    if (review.healthy !== true || review.sampleSufficient !== true) throw new Error("Complete X pilot evidence contains an unhealthy or insufficient review.");
    if (!Number.isInteger(review.policyVersion) || review.policyVersion < 1) throw new Error("Complete X pilot evidence needs a policy version for every review.");
    if (typeof review.evidenceReference !== "string" || !/^[a-z0-9]+(?:[._:@-][a-z0-9]+)*$/i.test(review.evidenceReference)) {
      throw new Error("Complete X pilot evidence needs an opaque evidence reference for every review.");
    }
  }
}

process.stdout.write(`${JSON.stringify({
  externalPilotEvidence: evidence.status,
  providerCount: evidence.providers.length,
  healthyReviewCount: evidence.dailyReviews.filter((review) => review.healthy && review.sampleSufficient).length,
  requiredConsecutiveDays: evidence.requiredConsecutiveDays,
  deterministicGateMayPass: true,
  workItemMayClose: evidence.status === "complete"
})}\n`);
