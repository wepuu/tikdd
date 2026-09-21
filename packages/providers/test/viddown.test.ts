import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseVidDownResponse,
  VidDownProvider,
  type ResolveInput
} from "../src/index";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://vimeo.com/fixture-video",
  canonicalUrl: "https://vimeo.com/fixture-video",
  platform: "vimeo"
};

function response(body: string, contentType: string, url: string, status = 200, headers?: Record<string, string>) {
  const result = new Response(body, { status, headers: { "content-type": contentType, ...headers } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

describe("VidDown Vimeo adapter", () => {
  it("uses the bounded inline page token and does not call the legacy token endpoint", async () => {
    const body = await fixture("viddown-vimeo-success.json");
    const inlineToken = "inline-token-123456789012345678901234567890";
    const page = `<html><script>window.__VID_DOWN_DYNAMIC_PAGE_JWT__ = "${inlineToken}";</script>${"x".repeat(70_000)}</html>`;
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), init });
        if (url.toString().includes("/download-vimeo-video")) {
          return response(page, "text/html", url.toString());
        }
        return response(body, "application/json", url.toString());
      }
    });

    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toContain("api.viddown.net/vimeo/v1/getLoaderList");
    const apiInit = calls[1]?.init;
    expect(apiInit).toBeDefined();
    if (!apiInit) return;
    expect(new Headers(apiInit.headers).get("authorization")).toBe(inlineToken);
    expect(new Headers(apiInit.headers).get("accept-lang")).toBe("en");
    expect(JSON.stringify(resolution.result)).not.toContain(inlineToken);
  });

  it("uses the anonymous page-token flow once and returns opaque Vimeo candidates", async () => {
    const body = await fixture("viddown-vimeo-success.json");
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), init });
        if (url.toString().includes("/download-vimeo-video")) {
          return response("<html>fixture</html>", "text/html", url.toString());
        }
        if (url.toString().includes("/api/get-page-token")) {
          return response(JSON.stringify({ token: "fixture-token" }), "application/json", url.toString(), 200, {
            "set-cookie": "vid_down_dynamic_page_jwt=fixture-session; Path=/"
          });
        }
        return response(body, "application/json", url.toString());
      }
    });

    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toContain("www.viddown.net/download-vimeo-video");
    expect(calls[1]?.url).toContain("www.viddown.net/api/get-page-token");
    expect(calls[2]?.url).toContain("api.viddown.net/vimeo/v1/getLoaderList");
    const apiInit = calls[2]?.init;
    expect(apiInit).toBeDefined();
    if (!apiInit) return;
    expect(JSON.parse(String(apiInit.body))).toEqual({
      url: input.canonicalUrl,
      ga: { client_id: "", events: [] }
    });
    expect(new Headers(apiInit.headers).get("authorization")).toBe("fixture-token");
    expect(resolution.result.media.title).toBe("Fixture Vimeo video");
    expect(resolution.result.media.thumbnailUrl).toContain("i.vimeocdn.com");
    expect(resolution.result.formats).toHaveLength(2);
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "viddown-net-vimeo-media-v1"
    });
    expect(JSON.stringify(resolution.result)).not.toContain("player.vimeo.com");
    expect(JSON.stringify(resolution.result)).not.toContain("fixture-token");
    expect(JSON.stringify(resolution.candidates)).toContain("player.vimeo.com");
  });

  it("fails closed when neither the inline token nor the legacy token endpoint is valid", async () => {
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url) => {
        if (url.toString().includes("/download-vimeo-video")) {
          return response(
            "<html><script>window.__VID_DOWN_DYNAMIC_PAGE_JWT__ = \"too-short\";</script></html>",
            "text/html",
            url.toString()
          );
        }
        return response(JSON.stringify({}), "application/json", url.toString());
      }
    });

    await expect(provider.resolve(input)).rejects.toThrow(/valid page token/i);
  });

  it("rejects a VidDown page above the bounded response limit", async () => {
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url) => response(
        `<html>${"x".repeat(256_001)}</html>`,
        "text/html",
        url.toString()
      )
    });

    await expect(provider.resolve(input)).rejects.toThrow(/exceeded the configured size limit/i);
  });

  it("tolerates missing optional metadata while requiring a reviewed MP4", async () => {
    const parsed = parseVidDownResponse(JSON.stringify({
      state: 0,
      data: {
        links: [{ url: "https://player.vimeo.com/video/fixture.mp4?token=fixture", quality: "Source" }]
      }
    }));
    expect(parsed.title).toBeNull();
    expect(parsed.thumbnailUrl).toBeNull();
    expect(parsed.formats[0]).toMatchObject({ container: "mp4", quality: "Source" });
  });

  it("rejects unreviewed hosts, non-MP4 resources, and no-media responses", async () => {
    const noMedia = await fixture("viddown-vimeo-no-media.json");
    expect(() => parseVidDownResponse(JSON.stringify({
      state: 0,
      data: { links: [{ url: "https://evil.example.test/video.mp4" }] }
    }))).toThrow(/no reviewed Vimeo MP4/i);
    expect(() => parseVidDownResponse(JSON.stringify({
      state: 0,
      data: { links: [{ url: "https://player.vimeo.com/video/fixture.webm" }] }
    }))).toThrow(/no reviewed Vimeo MP4/i);
    expect(() => parseVidDownResponse(noMedia))
      .toThrow(/no reviewed Vimeo MP4/i);
    expect(() => parseVidDownResponse("not-json")).toThrow(/invalid API response/i);
  });

  it("classifies an unsuccessful upstream response without retrying it in the adapter", () => {
    expect(() => parseVidDownResponse(JSON.stringify({ state: 1, msg: "private video" }), 200))
      .toThrow(/private Vimeo/i);
    expect(() => parseVidDownResponse(JSON.stringify({
      state: 1,
      data: null,
      error: { code: "content_not_found" }
    }), 200)).toThrow(/could not find/i);
    expect(() => parseVidDownResponse(JSON.stringify({
      state: 1,
      data: null,
      error: { type: "unsupported_url" }
    }), 200)).toThrow(/does not support/i);
    expect(() => parseVidDownResponse(JSON.stringify({
      state: 1,
      data: null,
      error: { status: "temporary_failure" }
    }), 200)).toThrow(/unsuccessful response/i);
  });
});
