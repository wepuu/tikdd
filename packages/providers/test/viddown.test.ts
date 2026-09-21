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
    const inlineToken = "fixture-inline-token-123456789012345678901234567890";
    const page = `${await fixture("viddown-vimeo-inline-page.html")}${"x".repeat(70_000)}`;
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
    expect(new Headers(apiInit.headers).get("user-agent")).toBe("TikDD/viddown-vimeo");
    expect(JSON.stringify(resolution.result)).not.toContain(inlineToken);
  });

  it("accepts a bounded inline token longer than the legacy regex limit", async () => {
    const body = await fixture("viddown-vimeo-success.json");
    const inlineToken = `inline-token-${"a".repeat(700)}`;
    const calls: string[] = [];
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url) => {
        calls.push(url.toString());
        if (url.toString().includes("/download-vimeo-video")) {
          return response(
            `<script>window.__VID_DOWN_DYNAMIC_PAGE_JWT__ = "${inlineToken}";</script>`,
            "text/html",
            url.toString()
          );
        }
        return response(body, "application/json", url.toString());
      }
    });

    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("api.viddown.net/vimeo/v1/getLoaderList");
    expect(resolution.result.formats).toHaveLength(2);
  });

  it("accepts a valid landing page that references challenge libraries", async () => {
    const page = await fixture("viddown-vimeo-normal-with-challenge-library.html");
    const body = await fixture("viddown-vimeo-success.json");
    const events: unknown[] = [];
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const provider = new VidDownProvider({
      enabled: true,
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), init });
        if (url.toString().includes("/download-vimeo-video")) {
          return response(page, "text/html", url.toString(), 200, {
            "set-cookie": "fixture_session=page; Path=/"
          });
        }
        return response(body, "application/json", url.toString());
      }
    });

    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(2);
    expect(calls.some(({ url }) => url.includes("/api/get-page-token"))).toBe(false);
    expect(resolution.result.formats).toHaveLength(2);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      phase: "completed",
      outcome: "success",
      challengeDetected: false,
      challengeReason: "none",
      tokenSource: "inline",
      tokenValid: true,
      sessionCookiePresent: true,
      validMediaCount: 2
    });
  });

  it("rejects a structural Cloudflare interstitial without treating static strings as sufficient", async () => {
    const page = (await fixture("viddown-vimeo-cloudflare-interstitial.html")).replace(
      "</body>",
      '<script>window.__VID_DOWN_DYNAMIC_PAGE_JWT__ = "fixture-inline-token-123456789012345678901234567890";</script></body>'
    );
    const events: unknown[] = [];
    const calls: string[] = [];
    const provider = new VidDownProvider({
      enabled: true,
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async (url) => {
        calls.push(url.toString());
        return response(page, "text/html", url.toString());
      }
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_challenge" });
    expect(calls).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      phase: "landing",
      outcome: "failure",
      httpStatus: 200,
      challengeDetected: true,
      challengeReason: "cloudflare_interstitial",
      tokenSource: "none",
      tokenValid: false,
      failureCode: "provider_challenge"
    });
  });

  it("classifies an HTTP 200 access-denied document as a landing challenge", async () => {
    const page = await fixture("viddown-vimeo-challenge.html");
    const events: unknown[] = [];
    const provider = new VidDownProvider({
      enabled: true,
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async (url) => response(page, "text/html", url.toString())
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_challenge" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      phase: "landing",
      outcome: "failure",
      httpStatus: 200,
      challengeDetected: true,
      challengeReason: "access_denied_document",
      failureCode: "provider_challenge"
    });
  });

  it("uses the anonymous page-token flow once and returns opaque Vimeo candidates", async () => {
    const body = await fixture("viddown-vimeo-success.json");
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), init });
        if (url.toString().includes("/download-vimeo-video")) {
          return response(
            '<html><script src="/cdn-cgi/challenge-platform/library.js"></script></html>',
            "text/html",
            url.toString(),
            200,
            {
              "set-cookie": "fixture_session=page; Path=/"
            }
          );
        }
        if (url.toString().includes("/api/get-page-token")) {
          return response(JSON.stringify({ token: "fixture-token" }), "application/json", url.toString(), 200, {
            "set-cookie": "fixture_session=token; Path=/"
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
    expect(new Headers(apiInit.headers).get("cookie")).toBe("fixture_session=token");
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
    const calls: string[] = [];
    const provider = new VidDownProvider({
      enabled: true,
      fetchImpl: async (url) => {
        calls.push(url.toString());
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

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_schema_changed" });
    expect(calls).toHaveLength(1);
  });

  it("emits only sanitized phase diagnostics for a loader challenge", async () => {
    const inlineToken = "inline-token-123456789012345678901234567890";
    const challengeBody = await fixture("viddown-vimeo-challenge.html");
    const events: unknown[] = [];
    const provider = new VidDownProvider({
      enabled: true,
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async (url) => {
        if (url.toString().includes("/download-vimeo-video")) {
          return response(
            `<script>window.__VID_DOWN_DYNAMIC_PAGE_JWT__ = "${inlineToken}";</script>`,
            "text/html",
            url.toString()
          );
        }
        return response(challengeBody, "text/html", url.toString(), 403, {
          "set-cookie": "challenge_session=fixture; Path=/"
        });
      }
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_challenge" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "viddown_resolution_diagnostic",
      phase: "loader",
      outcome: "failure",
      httpStatus: 403,
      challengeDetected: true,
      challengeReason: "http_403",
      tokenSource: "inline",
      tokenValid: true,
      sessionCookiePresent: true,
      failureCode: "provider_challenge"
    });
    expect(JSON.stringify(events[0])).not.toContain(inlineToken);
    expect(JSON.stringify(events[0])).not.toContain("Access denied");
    expect(JSON.stringify(events[0])).not.toContain("vimeo.com");
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
