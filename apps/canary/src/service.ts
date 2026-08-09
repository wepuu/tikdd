import { setTimeout as delay } from "node:timers/promises";
import { loadCanarySchedulerConfiguration } from "./configuration";
import { executeCanaryRun } from "./runtime";

const configuration = loadCanarySchedulerConfiguration();
let stopping = false;
process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });
while (!stopping) {
  let runtime: Awaited<ReturnType<typeof executeCanaryRun>> | undefined;
  try {
    runtime = await executeCanaryRun();
    process.stdout.write(`${JSON.stringify(runtime.summary)}\n`);
  } catch {
    process.stderr.write("Scheduled canary run failed; inspect protected telemetry.\n");
  } finally {
    await runtime?.close();
  }
  if (!stopping) await delay(configuration.intervalMs);
}
