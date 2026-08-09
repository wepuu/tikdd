import { executeCleanup } from "./runtime";

let runtime: Awaited<ReturnType<typeof executeCleanup>> | undefined;
try {
  runtime = await executeCleanup(process.argv.includes("--dry-run"));
  process.stdout.write(`${JSON.stringify(runtime.metrics)}\n`);
  if (runtime.metrics.errors > 0) process.exitCode = 1;
} catch {
  process.stderr.write("Cleanup could not start; inspect protected service telemetry.\n");
  process.exitCode = 1;
} finally {
  await runtime?.close();
}
