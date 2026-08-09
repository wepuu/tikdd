import { setTimeout as delay } from "node:timers/promises";
import { loadCleanupConfiguration } from "./configuration";
import { executeCleanup } from "./runtime";

const configuration = loadCleanupConfiguration();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
  });
}

while (!stopping) {
  let runtime: Awaited<ReturnType<typeof executeCleanup>> | undefined;
  try {
    runtime = await executeCleanup(false);
    process.stdout.write(`${JSON.stringify(runtime.metrics)}\n`);
  } catch {
    process.stderr.write("Scheduled cleanup failed to start; inspect protected service telemetry.\n");
  } finally {
    await runtime?.close();
  }
  if (!stopping) await delay(configuration.intervalMs);
}
