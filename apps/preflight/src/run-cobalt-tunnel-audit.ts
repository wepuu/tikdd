import { readFileSync } from "node:fs";
import { parseCobaltTunnelAuditInput, runCobaltTunnelAudit } from "./cobalt-tunnel-audit";

const inputPath = process.env.TIKDD_COBALT_TUNNEL_AUDIT_INPUT ?? "/run/tikdd/cobalt-tunnel-audit-input.json";
const webOrigin = process.env.TIKDD_WEB_PUBLIC_ORIGIN ?? "https://www.tikdd.cc";
const rawInput = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
const exitOverride = process.env.TIKDD_COBALT_TUNNEL_AUDIT_EXIT;
const plan = parseCobaltTunnelAuditInput(rawInput, exitOverride);
const results = await runCobaltTunnelAudit(plan, { webOrigin });
process.stdout.write(`${JSON.stringify({ schemaVersion: "1.0", sampleCount: results.length, results }, null, 2)}\n`);
if (results.some(({ outcome }) => outcome !== "passed")) process.exitCode = 2;
