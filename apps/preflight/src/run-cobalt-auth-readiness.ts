import {
  readAndValidateCobaltKeyRegistry,
  verifyCobaltAuthReadiness
} from "./cobalt-auth-readiness";

const apiKey = process.env.COBALT_API_KEY?.trim();
if (!apiKey) throw new Error("COBALT_API_KEY is required for Cobalt authentication readiness.");

const registryPath = process.env.TIKDD_COBALT_API_KEYS_FILE ?? "/run/secrets/cobalt_api_keys";
readAndValidateCobaltKeyRegistry(registryPath, apiKey);
const result = await verifyCobaltAuthReadiness({
  apiUrl: process.env.COBALT_API_URL ?? "http://cobalt-api:9000/",
  apiKey
});

process.stdout.write(`cobalt_auth_readiness=PASS status=${result.httpStatus} code=${result.errorCode}\n`);
