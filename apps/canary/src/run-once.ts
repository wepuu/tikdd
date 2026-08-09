import { executeCanaryRun } from "./runtime";

let runtime: Awaited<ReturnType<typeof executeCanaryRun>> | undefined;
try {
  runtime = await executeCanaryRun();
  process.stdout.write(`${JSON.stringify(runtime.summary)}\n`);
  if (runtime.summary.errorCount > 0) process.exitCode = 1;
} catch {
  process.stderr.write("Authorized canary run could not start; inspect protected telemetry.\n");
  process.exitCode = 1;
} finally {
  await runtime?.close();
}
