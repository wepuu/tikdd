import { spawn } from "node:child_process";
import type { YtDlpRunnerFailureCode, YtDlpRunnerPlatform, YtDlpRunnerResponse } from "@tikdd/contracts";
import { normalizeYtDlpOutput } from "./normalize";

const MAXIMUM_OUTPUT_BYTES = 2 * 1_024 * 1_024;
const EXTRACTORS: Readonly<Record<YtDlpRunnerPlatform, string>> = {
  dailymotion: "Dailymotion,-generic",
  youtube: "Youtube,YoutubeYtBe,-youtube:tab,-generic"
};

export interface ClassifiedYtDlpFailure {
  code: YtDlpRunnerFailureCode;
  message: string;
}

export class YtDlpProcessError extends Error {
  constructor(readonly failureCode: YtDlpRunnerFailureCode, message: string) {
    super(message);
    this.name = "YtDlpProcessError";
  }
}

export function classifyYtDlpProcessFailure(errorOutput: string, code: number | null): ClassifiedYtDlpFailure {
  if (/impersonat(?:e|ion).*unavailable|none of these impersonate targets are available/i.test(errorOutput)) {
    return { code: "runtime_dependency_unavailable", message: "yt-dlp impersonation runtime is unavailable." };
  }
  if (/http\s*429|too many requests|rate.?limit/i.test(errorOutput)) {
    return { code: "rate_limited", message: "yt-dlp upstream rate limit was reached." };
  }
  if (/sign in to confirm|not a bot|captcha|login_required|confirm you.?re not a bot/i.test(errorOutput)) {
    return { code: "bot_challenge", message: "yt-dlp upstream requested an anonymous bot check." };
  }
  if (/po\s*token|visitor data|missing required visitor|gvs/i.test(errorOutput)) {
    return { code: "po_token_required", message: "yt-dlp could not obtain the required YouTube proof-of-origin data." };
  }
  if (/requested format is not available|requested format not available|format.*not available/i.test(errorOutput)) {
    return { code: "format_unavailable", message: "yt-dlp found no requested media format." };
  }
  if (/no video formats found|requested media is not available|no formats found/i.test(errorOutput)) {
    return { code: "no_media", message: "yt-dlp found no downloadable media." };
  }
  if (/unsupported url|not a valid url|does not support this url/i.test(errorOutput)) {
    return { code: "extractor_unsupported", message: "yt-dlp does not support this URL." };
  }
  return { code: "extractor_error", message: `yt-dlp exited with status ${code ?? "unknown"}.` };
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

export function runProcess(command: string, args: readonly string[], timeoutMs: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
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
    const killTree = () => {
      try {
        if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch { child.kill("SIGKILL"); }
    };
    const abort = () => {
      killTree();
      finish(new Error("yt-dlp execution was cancelled."));
    };
    const timer = setTimeout(() => {
      killTree();
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
      else {
        const classified = classifyYtDlpProcessFailure(errorOutput.toString("utf8"), code);
        finish(new YtDlpProcessError(classified.code, classified.message));
      }
    });
  });
}

export function buildYtDlpPlatformArgs(platform: YtDlpRunnerPlatform): string[] {
  if (platform === "dailymotion") return ["--no-plugin-dirs", "--use-extractors", EXTRACTORS[platform]];
  const playerClient = process.env.YTDLP_YOUTUBE_PLAYER_CLIENT?.trim() || "mweb";
  const potProviderUrl = process.env.YTDLP_YOUTUBE_POT_PROVIDER_URL?.trim();
  const args = ["--use-extractors", EXTRACTORS[platform], "--extractor-args", `youtube:player-client=${playerClient}`];
  if (potProviderUrl) args.push("--extractor-args", `youtubepot-bgutilhttp:base_url=${potProviderUrl}`);
  return args;
}

export class SubprocessYtDlpCli implements YtDlpCli {
  constructor(private readonly command = process.env.YTDLP_COMMAND ?? "yt-dlp") {}

  private commonArgs(platform: YtDlpRunnerPlatform): string[] {
    const args = [
      "--ignore-config",
      "--no-config-locations",
      "--no-playlist",
      "--no-cache-dir",
      "--skip-download",
      "--dump-single-json",
      "--no-warnings",
      "--socket-timeout", "10",
      "--js-runtimes", "node"
    ];
    // YouTube's PO Token Provider is a yt-dlp plugin. Dailymotion remains
    // plugin-free so its existing deterministic behavior is unchanged.
    args.push(...buildYtDlpPlatformArgs(platform));
    return args;
  }

  async extract(input: YtDlpCliInput): Promise<YtDlpRunnerResponse> {
    const output = await runProcess(this.command, [
      ...this.commonArgs(input.platform),
      "--",
      input.url
    ], input.deadlineMs, input.signal);
    return normalizeYtDlpOutput(input.platform, JSON.parse(output));
  }

  async version(): Promise<string> {
    return (await runProcess(this.command, ["--version"], 5_000)).trim().slice(0, 40);
  }
}
