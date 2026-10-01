import {
  DeliveryClientProcessingResponseSchema,
  type DeliveryClientProcessingPlan
} from "@tikdd/contracts";
import {
  CLIENT_DOWNLOAD_MAX_BYTES,
  CLIENT_DOWNLOAD_TIMEOUT_MS,
  ClientDownloadError
} from "./client-download";

interface LibAvInstance {
  writeFile(name: string, content: Uint8Array): Promise<Uint8Array>;
  readFile(name: string): Promise<Uint8Array>;
  ffmpeg(...args: (string | string[])[]): Promise<number>;
  terminate(): void;
}

interface LibAvModule {
  LibAV(options?: { noworker?: boolean }): Promise<LibAvInstance>;
}

export interface ClientProcessingOptions {
  url: string;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  createProcessor?: (requiresEncoding: boolean) => Promise<LibAvInstance>;
  saveBlob?: (blob: Blob, filename: string) => void;
}

function safeExtension(mimeType: string): string {
  const subtype = mimeType.split("/", 2)[1]?.split(";", 1)[0]?.toLowerCase();
  if (subtype === "x-m4a") return "m4a";
  if (subtype && /^(?:mp4|webm|mp3|m4a|ogg|opus|wav|gif|jpg|jpeg|png|webp)$/.test(subtype)) {
    return subtype;
  }
  return "bin";
}

function ffmpegArgs(plan: DeliveryClientProcessingPlan, inputNames: string[]): string[] {
  const inputs = inputNames.flatMap((name) => ["-i", name]);
  const output = "tikdd-output." + safeExtension(plan.output.mimeType);
  const metadata = Object.entries(plan.output.metadata ?? {}).flatMap(([key, value]) => ["-metadata", `${key}=${value}`]);
  switch (plan.operation) {
    case "merge":
    case "remux":
      return [
        "-nostdin", "-y", "-loglevel", "error", ...inputs,
        "-c:v", "copy", "-c:a", "copy",
        ...(plan.output.subtitles ? ["-c:s", output.endsWith(".mp4") ? "mov_text" : "webvtt"] : []),
        ...metadata,
        output
      ];
    case "mute":
      return ["-nostdin", "-y", "-loglevel", "error", ...inputs, "-c:v", "copy", "-an", ...metadata, output];
    case "audio": {
      const audio = plan.audio;
      if (!audio) throw new ClientDownloadError("invalid_response");
      const cover = audio.cover && audio.format === "mp3";
      return [
        "-nostdin", "-y", "-loglevel", "error", ...inputs,
        ...(cover
          ? ["-map", "0", "-map", "1", ...(audio.cropCover
              ? ["-c:v", "mjpeg", "-vf", "scale=-1:720,crop=720:720"]
              : ["-c:v", "copy"])]
          : ["-vn"]),
        ...(audio.copy ? ["-c:a", "copy"] : ["-b:a", `${audio.bitrateKbps}k`]),
        ...metadata,
        ...(audio.format === "mp3" && audio.bitrateKbps === 8 ? ["-ar", "12000"] : []),
        ...(audio.format === "opus" ? ["-vbr", "off"] : []),
        "-f", audio.format === "m4a" ? "ipod" : audio.format,
        output
      ];
    }
    case "gif":
      return [
        "-nostdin", "-y", "-loglevel", "error", ...inputs,
        "-vf", "scale=-1:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        "-loop", "0", "-f", "gif", output
      ];
    default:
      throw new ClientDownloadError("invalid_response");
  }
}

async function defaultProcessor(requiresEncoding: boolean): Promise<LibAvInstance> {
  const asset = requiresEncoding ? "libav-encode-cli.mjs" : "libav-remux-cli.mjs";
  const moduleUrl = new URL(`/vendor/libav/${asset}`, window.location.origin).toString();
  // The wrapper and its WASM worker are copied from the pinned packages into
  // the same-origin public tree at build time. Keeping this as a native URL
  // import avoids bundlers trying to statically resolve libav's worker import.
  const imported = await import(/* webpackIgnore: true */ moduleUrl);
  const module = (imported.default ?? imported) as unknown as LibAvModule;
  return module.LibAV();
}

function defaultSaveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readBounded(response: Response, remaining: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw new ClientDownloadError("invalid_response");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > remaining) throw new ClientDownloadError("too_large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > remaining) {
        await reader.cancel();
        throw new ClientDownloadError("too_large");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new ClientDownloadError("empty");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Redeem a TikDD processing ticket and process its short-lived, allowlisted
 * Cobalt inputs entirely in the browser. TikDD never receives media bytes.
 */
export async function downloadClientProcessedMedia(options: ClientProcessingOptions): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? CLIENT_DOWNLOAD_MAX_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? CLIENT_DOWNLOAD_TIMEOUT_MS);
  let processor: LibAvInstance | undefined;
  try {
    const ticketResponse = await fetchImpl(options.url, {
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
    if (!ticketResponse.ok) throw new ClientDownloadError("invalid_response");
    const ticket = DeliveryClientProcessingResponseSchema.safeParse(await ticketResponse.json());
    if (!ticket.success) throw new ClientDownloadError("invalid_response");

    const buffers: Uint8Array[] = [];
    let total = 0;
    for (const input of ticket.data.processing.inputs) {
      const response = await fetchImpl(input.url, {
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      const bytes = await readBounded(response, maxBytes - total);
      total += bytes.byteLength;
      buffers.push(bytes);
    }

    const needsEncoding = ticket.data.processing.operation === "audio" || ticket.data.processing.operation === "gif";
    processor = await (options.createProcessor ?? defaultProcessor)(needsEncoding);
    const inputNames: string[] = [];
    for (const [index, input] of ticket.data.processing.inputs.entries()) {
      // Signed tunnel URLs intentionally hide the source extension. FFmpeg
      // probes bytes, while a conventional suffix improves browser builds'
      // format detection without exposing an upstream URL.
      const filename = `tikdd-input-${index}`;
      inputNames.push(filename);
      await processor.writeFile(filename, buffers[index]!);
    }
    const args = ffmpegArgs(ticket.data.processing, inputNames);
    const exitCode = await processor.ffmpeg(...args);
    if (exitCode !== 0) throw new ClientDownloadError("invalid_response");
    const outputName = args.at(-1)!;
    const output = await processor.readFile(outputName);
    if (output.byteLength === 0) throw new ClientDownloadError("empty");
    (options.saveBlob ?? defaultSaveBlob)(
      new Blob([output as unknown as BlobPart], { type: ticket.data.processing.output.mimeType }),
      ticket.data.processing.output.filename
    );
  } catch (error) {
    if (error instanceof ClientDownloadError) throw error;
    if (controller.signal.aborted) throw new ClientDownloadError("timeout");
    throw new ClientDownloadError("network");
  } finally {
    processor?.terminate();
    clearTimeout(timer);
  }
}
