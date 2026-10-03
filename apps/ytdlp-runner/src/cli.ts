import { spawn } from "node:child_process";
import type { YtDlpRunnerPlatform, YtDlpRunnerResponse } from "@tikdd/contracts";
import { normalizeYtDlpOutput } from "./normalize";

const MAXIMUM_OUTPUT_BYTES = 2 * 1_024 * 1_024;
const EXTRACTORS: Readonly<Record<YtDlpRunnerPlatform, string>> = {
  dailymotion: "Dailymotion,-generic",
  youtube: "Youtube,YoutubeYtBe,-youtube:tab,-generic"
};

export function classifyYtDlpProcessFailure(errorOutput: string, code: number | null): string {
  if (/impersonat(?:e|ion).*unavailable|none of these impersonate targets are available/i.test(errorOutput)) {
    return "yt-dlp impersonation runtime is unavailable.";
  }
  return `yt-dlp exited with status ${code ?? "unknown"}.`;
}

export interface YtDlpCliInput {
  platform: YtDlpRunnerPlatform;
  url: string;
  deadlineMs: number;
  signal?: AbortSignal;
}

export interface YtDlpCli {
  extract(input: YtDlpCliInput): Promise<YtDlpRunnerResponse>;
  version(): Promise<string>;
}

function runProcess(command: string, args: readonly string[], timeoutMs: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: process.env.PATH ?? "", HOME: "/nonexistent", PYTHONUNBUFFERED: "1" }
    });
    let output = Buffer.alloc(0);
    let errorOutput = Buffer.alloc(0);
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(output.toString("utf8"));
    };
    const abort = () => {
      child.kill("SIGKILL");
      finish(new Error("yt-dlp execution was cancelled."));
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("yt-dlp execution timed out."));
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      output = Buffer.concat([output, chunk]);
      if (output.byteLength > MAXIMUM_OUTPUT_BYTES) abort();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput = Buffer.concat([errorOutput, chunk]).subarray(0, 8_192);
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(classifyYtDlpProcessFailure(errorOutput.toString("utf8"), code)));
    });
  });
}

export class SubprocessYtDlpCli implements YtDlpCli {
  constructor(private readonly command = process.env.YTDLP_COMMAND ?? "yt-dlp") {}

  async extract(input: YtDlpCliInput): Promise<YtDlpRunnerResponse> {
    const output = await runProcess(this.command, [
      "--ignore-config",
      "--no-config-locations",
      "--no-plugin-dirs",
      "--no-playlist",
      "--no-cache-dir",
      "--skip-download",
      "--dump-single-json",
      "--no-warnings",
      "--socket-timeout", "10",
      "--js-runtimes", "node",
      "--use-extractors", EXTRACTORS[input.platform],
      "--",
      input.url
    ], input.deadlineMs, input.signal);
    return normalizeYtDlpOutput(input.platform, JSON.parse(output));
  }

  async version(): Promise<string> {
    return (await runProcess(this.command, ["--version"], 5_000)).trim().slice(0, 40);
  }
}
