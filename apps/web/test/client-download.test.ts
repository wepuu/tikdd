import { describe, expect, it, vi } from "vitest";
import { CLIENT_DOWNLOAD_MAX_BYTES, downloadCorsBlob } from "../lib/client-download";

function response(body: Uint8Array, headers: Record<string, string> = {}): Response {
  return new Response(new Blob([body as unknown as BlobPart]), {
    status: 200,
    headers: { "content-type": "video/mp4", ...headers }
  });
}

describe("client-side media download", () => {
  it("fetches with omitted credentials and saves a blob using the requested name", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init).toMatchObject({ credentials: "omit", redirect: "follow", referrerPolicy: "no-referrer" });
      return response(new Uint8Array([1, 2, 3]));
    });
    const clicks: { href: string; download: string }[] = [];
    const previousDocument = globalThis.document;
    const previousCreate = URL.createObjectURL;
    const previousRevoke = URL.revokeObjectURL;
    const revoked: string[] = [];
    globalThis.document = {
      body: { append: () => undefined } as unknown as HTMLElement,
      createElement: () => {
        const anchor = {
          href: "",
          download: "",
          rel: "",
          style: {},
          click: () => clicks.push(anchor),
          remove: () => undefined
        };
        return anchor as unknown as HTMLAnchorElement;
      }
    } as unknown as Document;
    URL.createObjectURL = vi.fn(() => "blob:fixture");
    URL.revokeObjectURL = vi.fn((url: string) => revoked.push(url));
    try {
      await downloadCorsBlob({ url: "https://download.example.test/d/token", filename: "TikDD-Facebook-deadbeef-720p.mp4", fetchImpl });
    } finally {
      globalThis.document = previousDocument;
      URL.createObjectURL = previousCreate;
      URL.revokeObjectURL = previousRevoke;
    }
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(clicks[0]).toMatchObject({ download: "TikDD-Facebook-deadbeef-720p.mp4" });
    expect(revoked).toEqual(["blob:fixture"]);
  });

  it("rejects a declared response larger than 200 MiB before reading", async () => {
    const fetchImpl = vi.fn(async () => response(new Uint8Array([1]), {
      "content-length": String(CLIENT_DOWNLOAD_MAX_BYTES + 1)
    }));
    await expect(downloadCorsBlob({ url: "https://download.example.test/d/token", filename: "video.mp4", fetchImpl }))
      .rejects.toMatchObject({ code: "too_large" });
  });

  it.each([
    ["text/html", "invalid_response"],
    ["video/webm", "invalid_response"]
  ] as const)("rejects non-MP4 responses (%s)", async (mime, code) => {
    const fetchImpl = vi.fn(async () => response(new Uint8Array([1]), { "content-type": mime }));
    await expect(downloadCorsBlob({ url: "https://download.example.test/d/token", filename: "video.mp4", fetchImpl }))
      .rejects.toMatchObject({ code });
  });

  it("cancels an unknown-length stream when it crosses the configured cap", async () => {
    const fetchImpl = vi.fn(async () => response(new Uint8Array([1, 2, 3])));
    await expect(downloadCorsBlob({
      url: "https://download.example.test/d/token",
      filename: "video.mp4",
      fetchImpl,
      maxBytes: 2
    })).rejects.toMatchObject({ code: "too_large" });
  });

  it("maps an aborted fetch to a timeout and never triggers a save", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    await expect(downloadCorsBlob({
      url: "https://download.example.test/d/token",
      filename: "video.mp4",
      fetchImpl,
      timeoutMs: 5
    })).rejects.toMatchObject({ code: "timeout" });
  });
});
