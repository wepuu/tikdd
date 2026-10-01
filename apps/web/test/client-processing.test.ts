import { describe, expect, it, vi } from "vitest";
import { downloadClientProcessedMedia } from "../lib/client-processing";

describe("client-side Cobalt processing", () => {
  it("redeems a plan, fetches inputs from the browser, and saves the processed output", async () => {
    const inputUrl = "https://media.tikdd.cc/tunnel?id=opaque";
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (input.toString().includes("/d/")) {
        return Response.json({
          id: "dtk_fixture",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          processing: {
            operation: "remux",
            platform: "x",
            inputs: [{ url: inputUrl, role: "media" }],
            output: { mimeType: "video/mp4", filename: "TikDD-X-fixture.mp4" },
            isHls: false
          }
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "3" }
      });
    });
    const writeFile = vi.fn(async () => new Uint8Array());
    const ffmpeg = vi.fn(async () => 0);
    const readFile = vi.fn(async () => new Uint8Array([4, 5]));
    const terminate = vi.fn();
    const saveBlob = vi.fn();

    await downloadClientProcessedMedia({
      url: "https://delivery.tikdd.cc/d/dlt_fixture",
      fetchImpl,
      createProcessor: async () => ({ writeFile, ffmpeg, readFile, terminate }),
      saveBlob
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(inputUrl);
    expect(writeFile).toHaveBeenCalledWith("tikdd-input-0", new Uint8Array([1, 2, 3]));
    expect(ffmpeg).toHaveBeenCalledWith(
      "-nostdin", "-y", "-loglevel", "error", "-i", "tikdd-input-0",
      "-c:v", "copy", "-c:a", "copy", "tikdd-output.mp4"
    );
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "TikDD-X-fixture.mp4");
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("rejects a combined input budget over 200 MiB before processing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => input.toString().includes("/d/")
      ? Response.json({
          id: "dtk_fixture",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          processing: {
            operation: "merge",
            platform: "tiktok",
            inputs: [
              { url: "https://media.tikdd.cc/tunnel?id=video", role: "video" },
              { url: "https://media.tikdd.cc/tunnel?id=audio", role: "audio" }
            ],
            output: { mimeType: "video/mp4", filename: "TikDD-TikTok-merged.mp4" },
            isHls: false
          }
        })
      : new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-length": "4" } }));

    await expect(downloadClientProcessedMedia({
      url: "https://delivery.tikdd.cc/d/dlt_fixture",
      fetchImpl,
      maxBytes: 5,
      createProcessor: async () => { throw new Error("must not initialize"); }
    })).rejects.toMatchObject({ code: "too_large" });
  });
});
