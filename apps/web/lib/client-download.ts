export const CLIENT_DOWNLOAD_MAX_BYTES = 200 * 1024 * 1024;
export const CLIENT_DOWNLOAD_TIMEOUT_MS = 120_000;

export type ClientDownloadFailureCode =
  | "network"
  | "timeout"
  | "invalid_response"
  | "too_large"
  | "empty";

export class ClientDownloadError extends Error {
  constructor(readonly code: ClientDownloadFailureCode) {
    super(code);
    this.name = "ClientDownloadError";
  }
}

export interface ClientDownloadOptions {
  url: string;
  filename: string;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
}

function contentType(response: Response): string {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

/**
 * Download media from an approved Delivery URL in the user's browser. The
 * Delivery endpoint only redirects; media bytes never pass through TikDD.
 */
export async function downloadCorsBlob(options: ClientDownloadOptions): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? CLIENT_DOWNLOAD_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? CLIENT_DOWNLOAD_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    let response: Response;
    try {
      response = await fetchImpl(options.url, {
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) throw new ClientDownloadError("timeout");
      throw new ClientDownloadError("network");
    }
    if (!response.ok || contentType(response) !== "video/mp4") {
      throw new ClientDownloadError("invalid_response");
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new ClientDownloadError("too_large");
    }
    if (!response.body) throw new ClientDownloadError("invalid_response");

    reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let total = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value;
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        reader = null;
        throw new ClientDownloadError("too_large");
      }
      // DOM lib versions type Uint8Array's backing buffer as ArrayBufferLike;
      // the bytes are still copied into the Blob without exposing any URL.
      chunks.push(chunk as unknown as BlobPart);
    }
    if (total === 0) throw new ClientDownloadError("empty");

    const blob = new Blob(chunks, { type: "video/mp4" });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = options.filename;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    if (error instanceof ClientDownloadError) throw error;
    if (controller.signal.aborted) throw new ClientDownloadError("timeout");
    throw new ClientDownloadError("network");
  } finally {
    if (reader) await reader.cancel().catch(() => undefined);
    clearTimeout(timer);
  }
}
