import { createYtDlpRunnerApp } from "./app";
import { SubprocessYtDlpCli } from "./cli";

const secret = process.env.YTDLP_RUNNER_HMAC_SECRET;
if (!secret) throw new Error("YTDLP_RUNNER_HMAC_SECRET is required.");
const port = Number.parseInt(process.env.YTDLP_RUNNER_PORT ?? "9100", 10);
const app = createYtDlpRunnerApp({ cli: new SubprocessYtDlpCli(), hmacSecret: secret });

const close = async () => {
  await app.close();
  process.exit(0);
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
await app.listen({ host: "0.0.0.0", port });
