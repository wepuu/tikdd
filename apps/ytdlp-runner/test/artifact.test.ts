import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ArtifactCapacityError, ARTIFACT_TTL_MS, MAXIMUM_ARTIFACT_BYTES, YtDlpArtifactStore } from "../src/artifact";

describe("yt-dlp temporary artifact store", () => {
  it("prepares one bounded MP4 with an opaque id and removes it after TTL", async () => {
    const root = await mkdtemp(join(tmpdir(), "tikdd-ytdlp-"));
    let current = 1_800_000_000_000;
    try {
      const store = new YtDlpArtifactStore(root, async (_command, args) => {
        const output = args[args.indexOf("--output") + 1]!;
        expect(args.join(" ")).toContain("height<=720");
        expect(args.join(" ")).toContain('"thumbnail":%(thumbnail)j');
        await writeFile(output.replace("%(ext)s", "mp4"), Buffer.from([0, 1, 2, 3]));
        return JSON.stringify({ sourceId: "sample", title: "Sample", author: null,
          durationSeconds: 12, extractor: "Dailymotion",
          thumbnail: "https://s1.dmcdn.net/v/fixture/x720.jpg#fragment", width: 640, height: 360 });
      }, "yt-dlp", () => current, () => "a".repeat(32));
      const result = await store.prepare({ requestId: "req-1", platform: "dailymotion",
        url: "https://www.dailymotion.com/video/sample", deadlineMs: 175_000, maximumHeight: 720 });
      expect(result.artifact).toMatchObject({ id: `yta_${"a".repeat(32)}`, sizeBytes: 4,
        mimeType: "video/mp4", quality: "360p" });
      expect(result.thumbnailUrl).toBe("https://s1.dmcdn.net/v/fixture/x720.jpg");
      expect(existsSync(join(root, `${result.artifact.id}.mp4`))).toBe(true);
      current += ARTIFACT_TTL_MS + 1;
      await store.cleanup();
      expect(existsSync(join(root, `${result.artifact.id}.mp4`))).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps a valid artifact when the optional thumbnail is missing or unsafe", async () => {
    const root = await mkdtemp(join(tmpdir(), "tikdd-ytdlp-"));
    try {
      const store = new YtDlpArtifactStore(root, async (_command, args) => {
        const output = args[args.indexOf("--output") + 1]!;
        await writeFile(output.replace("%(ext)s", "mp4"), Buffer.from([0, 1]));
        return JSON.stringify({ sourceId: "sample", title: "Sample", extractor: "Dailymotion",
          thumbnail: "https://evil.example.test/fixture.jpg", width: 320, height: 180 });
      }, "yt-dlp", Date.now, () => "d".repeat(32));
      const result = await store.prepare({ requestId: "req-thumbnail", platform: "dailymotion",
        url: "https://www.dailymotion.com/video/sample", deadlineMs: 175_000, maximumHeight: 720 });
      expect(result.thumbnailUrl).toBeNull();
      expect(result.artifact.sizeBytes).toBe(2);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("rejects concurrent preparation and removes an oversized partial artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "tikdd-ytdlp-"));
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    try {
      const first = new YtDlpArtifactStore(root, async (_command, args) => {
        await blocked;
        const output = args[args.indexOf("--output") + 1]!;
        await writeFile(output.replace("%(ext)s", "mp4"), Buffer.from([1]));
        return JSON.stringify({ sourceId: "one", title: "One", height: 360 });
      }, "yt-dlp", Date.now, () => "b".repeat(32));
      const input = { requestId: "req-2", platform: "dailymotion" as const,
        url: "https://www.dailymotion.com/video/sample", deadlineMs: 175_000, maximumHeight: 720 };
      const running = first.prepare(input);
      await expect(first.prepare({ ...input, requestId: "req-3" })).rejects.toBeInstanceOf(ArtifactCapacityError);
      release();
      await running;

      const oversized = new YtDlpArtifactStore(root, async (_command, args) => {
        const output = args[args.indexOf("--output") + 1]!;
        const path = output.replace("%(ext)s", "mp4");
        await writeFile(path, Buffer.from([1]));
        await truncate(path, MAXIMUM_ARTIFACT_BYTES + 1);
        return JSON.stringify({ sourceId: "large", title: "Large", height: 720 });
      }, "yt-dlp", Date.now, () => "c".repeat(32));
      await expect(oversized.prepare({ ...input, requestId: "req-4" })).rejects.toThrow(/size/i);
      expect((await readdir(root)).some((name) => name.includes("c".repeat(32)))).toBe(false);
    } finally { release?.(); await rm(root, { recursive: true, force: true }); }
  });
});
