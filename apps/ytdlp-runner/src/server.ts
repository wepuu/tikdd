import { createYtDlpRunnerApp } from "./app";
import { SubprocessYtDlpCli } from "./cli";
import { YtDlpArtifactStore } from "./artifact";

const secret = process.env.YTDLP_RUNNER_HMAC_SECRET;
if (!secret) throw new Error("YTDLP_RUNNER_HMAC_SECRET is required.");
const port = Number.parseInt(process.env.YTDLP_RUNNER_PORT ?? "9100", 10);
const cli = new SubprocessYtDlpCli();
const artifacts = new YtDlpArtifactStore(
  process.env.YTDLP_ARTIFACT_ROOT ?? "/var/lib/tikdd-ytdlp-artifacts",
  async (command, args, timeoutMs, signal) => {
    const { runProcess } = await import("./cli");
    return runProcess(command, args, timeoutMs, signal);
  }
);
await artifacts.cleanup();
const app = createYtDlpRunnerApp({ cli, artifactPreparer: artifacts, hmacSecret: secret });
const cleanupTimer = setInterval(() => void artifacts.cleanup().catch(() => undefined), 60_000);
cleanupTimer.unref();

const close = async () => {
  clearInterval(cleanupTimer);
  await app.close();
  process.exit(0);
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
await app.listen({ host: "0.0.0.0", port });
