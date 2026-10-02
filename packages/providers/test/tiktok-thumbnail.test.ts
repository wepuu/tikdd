import { describe, expect, it, vi } from "vitest";
import {
  resolveTikTokThumbnail,
  reviewedTikTokThumbnailUrl,
  type TikTokThumbnailDiagnosticEvent
} from "../src";

const canonicalUrl = "https://www.tiktok.com/@fixture/video/1234567890123456789";
const thumbnailUrl = "https://p16-common-sign.tiktokcdn-eu.com/obj/fixture-cover?x-expires=fixture";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers }
  });
}

describe("TikTok official thumbnail enrichment", () => {
  it("accepts only the exact reviewed TikTok image host", () => {
    expect(reviewedTikTokThumbnailUrl(`${thumbnailUrl}#fragment`)).toBe(thumbnailUrl);
    for (const value of [
      "http://p16-common-sign.tiktokcdn-eu.com/obj/cover",
      "https://p16-common-sign.tiktokcdn-eu.com:444/obj/cover",
      "https://user:pass@p16-common-sign.tiktokcdn-eu.com/obj/cover",
      "https://tiktokcdn-eu.com/obj/cover",
      "https://evilp16-common-sign.tiktokcdn-eu.com/obj/cover",
      "https://p16-common-sign.tiktokcdn-eu.com.example.com/obj/cover",
      "https://p16.muscdn.com/obj/cover",
      "not-a-url"
    ]) {
      expect(reviewedTikTokThumbnailUrl(value)).toBeNull();
    }
  });

  it("returns a reviewed thumbnail from the fixed official oEmbed endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const result = await resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), ...(init ? { init } : {}) });
        return jsonResponse({ thumbnail_url: thumbnailUrl, thumbnail_width: 720, thumbnail_height: 1280 });
      }
    });

    expect(result).toBe(thumbnailUrl);
    expect(calls).toHaveLength(1);
    const endpoint = new URL(calls[0]?.url ?? "");
    expect(`${endpoint.origin}${endpoint.pathname}`).toBe("https://www.tiktok.com/oembed");
    expect(endpoint.searchParams.get("url")).toBe(canonicalUrl);
    expect(calls[0]?.init).toMatchObject({ method: "GET", redirect: "manual", credentials: "omit", referrerPolicy: "no-referrer" });
    expect(new Headers(calls[0]?.init?.headers).has("cookie")).toBe(false);
  });

  it.each([
    ["missing", jsonResponse({ title: "fixture" })],
    ["schema_changed", new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })],
    ["schema_changed", new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } })],
    ["http_error", jsonResponse({ error: "missing" }, { status: 404 })],
    ["http_error", jsonResponse({ error: "limited" }, { status: 429 })],
    ["http_error", jsonResponse({ error: "upstream" }, { status: 503 })],
    ["unsafe_host", jsonResponse({ thumbnail_url: "https://p16-common-sign.tiktokcdn-eu.com.example.com/cover" })]
  ] as const)("degrades to null with sanitized %s diagnostics", async (expectedStatus, response) => {
    const diagnostics: TikTokThumbnailDiagnosticEvent[] = [];
    const result = await resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl: async () => response.clone(),
      diagnosticSink: (event) => diagnostics.push(event)
    });
    expect(result).toBeNull();
    expect(diagnostics.at(-1)?.status).toBe(expectedStatus);
    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain(canonicalUrl);
    expect(serialized).not.toContain("tiktokcdn-eu.com");
    expect(serialized).not.toContain("not-json");
  });

  it("rejects oversized JSON without reading it as metadata", async () => {
    const diagnostics: TikTokThumbnailDiagnosticEvent[] = [];
    const result = await resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl: async () => new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "65537" }
      }),
      diagnosticSink: (event) => diagnostics.push(event)
    });
    expect(result).toBeNull();
    expect(diagnostics.at(-1)?.status).toBe("schema_changed");
  });

  it("rejects a redirect outside the exact oEmbed host", async () => {
    const diagnostics: TikTokThumbnailDiagnosticEvent[] = [];
    const result = await resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { location: "https://example.com/oembed" }
      }),
      diagnosticSink: (event) => diagnostics.push(event)
    });
    expect(result).toBeNull();
    expect(diagnostics.at(-1)?.status).toBe("unsafe_host");
  });

  it("times out without throwing or retrying", async () => {
    const fetchImpl = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const diagnostics: TikTokThumbnailDiagnosticEvent[] = [];
    await expect(resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl,
      timeoutMs: 5,
      diagnosticSink: (event) => diagnostics.push(event)
    })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(diagnostics.at(-1)?.status).toBe("timeout");
  });

  it("turns a network failure into optional missing metadata", async () => {
    const diagnostics: TikTokThumbnailDiagnosticEvent[] = [];
    await expect(resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl: async () => { throw new TypeError("network failed"); },
      diagnosticSink: (event) => diagnostics.push(event)
    })).resolves.toBeNull();
    expect(diagnostics.at(-1)?.status).toBe("http_error");
  });

  it("ignores diagnostic sink failures", async () => {
    await expect(resolveTikTokThumbnail({
      taskId: "tsk_thumbnail_fixture",
      canonicalUrl,
      fetchImpl: async () => jsonResponse({ thumbnail_url: thumbnailUrl }),
      diagnosticSink: () => { throw new Error("diagnostic failure"); }
    })).resolves.toBe(thumbnailUrl);
  });
});
