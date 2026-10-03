import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, statfs } from "node:fs/promises";
import { join } from "node:path";
import {
  YtDlpArtifactResponseSchema,
  type YtDlpArtifactRequest,
  type YtDlpArtifactResponse
} from "@tikdd/contracts";

export const MAXIMUM_ARTIFACT_BYTES = 300 * 1_024 * 1_024;
export const MAXIMUM_ARTIFACT_STORE_BYTES = 1_024 * 1_024 * 1_024;
export const MINIMUM_FREE_BYTES = 512 * 1_024 * 1_024;
export const ARTIFACT_TTL_MS = 15 * 60_000;

export class ArtifactCapacityError extends Error {}

export type ArtifactProcessRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
  signal?: AbortSignal
) => Promise<string>;

interface ArtifactMetadata {
  sourceId?: unknown;
  title?: unknown;
  author?: unknown;
  durationSeconds?: unknown;
  extractor?: unknown;
  width?: unknown;
  height?: unknown;
}

const safeText = (value: unknown, fallback: string, maximum: number) =>
  (typeof value === "string" && value.trim() ? value.trim() : fallback).slice(0, maximum);
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

export class YtDlpArtifactStore {
  private active = false;
  constructor(
    private readonly root: string,
    private readonly run: ArtifactProcessRunner,
    private readonly command = "yt-dlp",
    private readonly now: () => number = Date.now,
    private readonly idFactory: () => string = () => randomBytes(16).toString("hex")
  ) {}

  async cleanup(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const cutoff = this.now() - ARTIFACT_TTL_MS;
    for (const entry of await readdir(this.root, { withFileTypes: true })) {
      if (!/^yta_[a-f0-9]{32}\.mp4$/.test(entry.name) && !/^\.work-[a-f0-9]{32}$/.test(entry.name)) continue;
      const path = join(this.root, entry.name);
      const details = await stat(path);
      if (details.mtimeMs <= cutoff) await rm(path, { recursive: entry.isDirectory(), force: true });
    }
  }

  private async assertCapacity(): Promise<void> {
    let total = 0;
    for (const entry of await readdir(this.root, { withFileTypes: true })) {
      if (!entry.isFile() || !/^yta_[a-f0-9]{32}\.mp4$/.test(entry.name)) continue;
      total += (await stat(join(this.root, entry.name))).size;
    }
    const filesystem = await statfs(this.root);
    const available = Number(filesystem.bavail) * Number(filesystem.bsize);
    if (total > MAXIMUM_ARTIFACT_STORE_BYTES - MAXIMUM_ARTIFACT_BYTES ||
        available < MINIMUM_FREE_BYTES + MAXIMUM_ARTIFACT_BYTES) {
      throw new ArtifactCapacityError("The artifact store has no safe capacity.");
    }
  }

  async prepare(input: YtDlpArtifactRequest & { signal?: AbortSignal }): Promise<YtDlpArtifactResponse> {
    if (this.active) throw new ArtifactCapacityError("The artifact runner is busy.");
    const suffix = this.idFactory();
    if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error("The artifact id factory returned an invalid value.");
    this.active = true;
    const id = `yta_${suffix}`;
    const work = join(this.root, `.work-${suffix}`);
    const finalPath = join(this.root, `${id}.mp4`);
    try {
      await this.cleanup();
      await this.assertCapacity();
      await mkdir(work, { mode: 0o700 });
      const outputTemplate = join(work, "media.%(ext)s");
      const format = `bv*[height<=${input.maximumHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${input.maximumHeight}][ext=mp4]/bv*[height<=${input.maximumHeight}]+ba/b[height<=${input.maximumHeight}]`;
      const printed = "after_move:{\"sourceId\":%(id)j,\"title\":%(title)j,\"author\":%(uploader)j,\"durationSeconds\":%(duration)j,\"extractor\":%(extractor_key)j,\"width\":%(width)j,\"height\":%(height)j}";
      const stdout = await this.run(this.command, [
        "--ignore-config", "--no-config-locations", "--no-plugin-dirs", "--no-playlist", "--no-cache-dir",
        "--quiet", "--no-warnings", "--no-simulate", "--socket-timeout", "10", "--js-runtimes", "node",
        "--use-extractors", input.platform === "dailymotion" ? "Dailymotion,-generic" : "Youtube,YoutubeYtBe,-youtube:tab,-generic",
        "--max-filesize", String(MAXIMUM_ARTIFACT_BYTES), "--format", format,
        "--merge-output-format", "mp4", "--remux-video", "mp4", "--output", outputTemplate,
        "--print", printed, "--", input.url
      ], input.deadlineMs, input.signal);
      const metadata = JSON.parse(stdout.trim().split(/\r?\n/).at(-1) ?? "{}") as ArtifactMetadata;
      const preparedPath = join(work, "media.mp4");
      const details = await stat(preparedPath);
      if (!details.isFile() || details.size <= 0 || details.size > MAXIMUM_ARTIFACT_BYTES) {
        throw new Error("The prepared artifact size is invalid.");
      }
      await rename(preparedPath, finalPath);
      const height = safeNumber(metadata.height);
      const width = safeNumber(metadata.width);
      const response = YtDlpArtifactResponseSchema.parse({
        platform: input.platform,
        sourceId: safeText(metadata.sourceId, "media", 200).replace(/[^A-Za-z0-9._-]/g, "_") || "media",
        title: safeText(metadata.title, "Public video", 500),
        author: typeof metadata.author === "string" ? metadata.author.slice(0, 200) : null,
        thumbnailUrl: null,
        durationSeconds: safeNumber(metadata.durationSeconds),
        isLive: false,
        extractor: safeText(metadata.extractor, input.platform, 100),
        artifact: {
          id, container: "mp4", mimeType: "video/mp4",
          quality: height ? `${Math.min(height, input.maximumHeight)}p` : `up-to-${input.maximumHeight}p`,
          width: width && Number.isInteger(width) ? width : null,
          height: height && Number.isInteger(height) ? Math.min(height, input.maximumHeight) : null,
          sizeBytes: details.size,
          sha256: await sha256(finalPath),
          expiresAt: new Date(this.now() + ARTIFACT_TTL_MS).toISOString()
        }
      });
      return response;
    } catch (error) {
      await rm(finalPath, { force: true });
      throw error;
    } finally {
      await rm(work, { recursive: true, force: true });
      this.active = false;
    }
  }
}
