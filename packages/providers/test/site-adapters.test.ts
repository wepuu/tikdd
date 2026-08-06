import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DLPandaProvider,
  ProviderRouter,
  TwitterSaverProvider,
  type ResolveInput
} from "../src/index";

const fixture = async (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const xInput: ResolveInput = {
  sourceUrl: "https://x.com/authorized/status/123456",
  canonicalUrl: "https://x.com/authorized/status/123456",
  platform: "x"
};

function response(body: string, url: string, init: ResponseInit = {}): Response {
  const value = new Response(body, init);
  Object.defineProperty(value, "url", { value: url });
  return value;
}

describe("TwitterSaverProvider", () => {
  it("normalizes only downloadable MP4 variants", async () => {
    const resultHtml = await fixture("twittersaver-success.html");
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = input.toString();
      calls.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith("/en")) {
        return response("<html><form id=search-form></form></html>", url, {
          headers: { "set-cookie": "fixture_session=abc; Path=/; HttpOnly" }
        });
      }
      return response(
        JSON.stringify({ status: "ok", data: resultHtml }),
        url,
        { headers: { "content-type": "application/json" } }
      );
    };
    const provider = new TwitterSaverProvider({ enabled: true, fetchImpl });

    const resolution = await provider.resolve(xInput);
    const result = resolution.result;

    expect(result.media.title).toBe("Authorized fixture & test clip");
    expect(result.media.durationSeconds).toBe(220);
    expect(result.formats.map(({ quality }) => quality)).toEqual(["720p", "360p"]);
    expect(JSON.stringify(result)).not.toContain("media.invalid/video");
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.candidates.every(({ hostPolicyId }) => hostPolicyId === "twittersaver-media-v1"))
      .toBe(true);
    expect(result.warnings).not.toContain("Media delivery persistence is not enabled for this provider yet.");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.init?.headers).toMatchObject({ cookie: "fixture_session=abc" });
  });

  it("maps provider misses to a fallback-allowed error", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = input.toString();
      return url.endsWith("/en")
        ? response("<html></html>", url)
        : response(
            JSON.stringify({
              status: "ok",
              statusCode: 404,
              msg: "Video not found. Maybe the video is private or blocked."
            }),
            url
          );
    };
    const provider = new TwitterSaverProvider({ enabled: true, fetchImpl });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false,
      fallbackAllowed: true
    });
  });

  it("does not attempt to bypass an interactive challenge", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      return response('<div class="cf-turnstile"></div>', input.toString());
    };
    const provider = new TwitterSaverProvider({ enabled: true, fetchImpl });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "provider_challenge",
      fallbackAllowed: true
    });
    expect(calls).toBe(1);
  });
});

describe("DLPandaProvider", () => {
  it("submits the public tokenized form and normalizes formats", async () => {
    const [landingHtml, resultHtml] = await Promise.all([
      fixture("dlpanda-landing.html"),
      fixture("dlpanda-success.html")
    ]);
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = input.toString();
      urls.push(url);
      return response(url.includes("t0ken=") ? resultHtml : landingHtml, url);
    };
    const provider = new DLPandaProvider({ enabled: true, fetchImpl });

    const resolution = await provider.resolve({
      sourceUrl: "https://www.tiktok.com/@authorized/video/123456",
      canonicalUrl: "https://www.tiktok.com/@authorized/video/123456",
      platform: "tiktok"
    });

    expect(resolution.result.formats).toHaveLength(2);
    expect(resolution.result.formats.map(({ height }) => height)).toEqual([1080, 720]);
    expect(urls[1]).toContain("t0ken=fixture-token");
    expect(urls[1]).toContain("url=https%3A%2F%2Fwww.tiktok.com");
  });

  it("maps Cloudflare blocks to provider challenge", async () => {
    const fetchImpl: typeof fetch = async (input) =>
      response("<title>Attention Required! | Cloudflare</title>", input.toString(), { status: 403 });
    const provider = new DLPandaProvider({ enabled: true, fetchImpl });

    await expect(
      provider.resolve({ ...xInput, platform: "tiktok", canonicalUrl: "https://tiktok.com/v/1" })
    ).rejects.toMatchObject({ failureCode: "provider_challenge", fallbackAllowed: true });
  });

  it("stops when a response requests an upstream account cookie", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = input.toString();
      return response(
        url.includes("t0ken=")
          ? '<div>Paste the sessdata value here</div>'
          : '<input name="t0ken" value="fixture-token">',
        url
      );
    };
    const provider = new DLPandaProvider({ enabled: true, fetchImpl });

    await expect(
      provider.resolve({
        sourceUrl: "https://www.bilibili.com/video/BVfixture",
        canonicalUrl: "https://www.bilibili.com/video/BVfixture",
        platform: "bilibili"
      })
    ).rejects.toMatchObject({
      failureCode: "authentication_required",
      retryable: false,
      fallbackAllowed: false
    });
  });

  it("does not declare Instagram because the site requires a session cookie", () => {
    const provider = new DLPandaProvider({ enabled: true });
    expect(provider.manifest.platforms.some(({ platform }) => platform === "instagram")).toBe(false);
  });
});

describe("site adapter routing", () => {
  it("falls back from TwitterSaver to DLPanda for X", async () => {
    const resultHtml = await fixture("dlpanda-success.html");
    const twitter = new TwitterSaverProvider({
      enabled: true,
      fetchImpl: async (input) => {
        const url = input.toString();
        return url.endsWith("/en")
          ? response("<html></html>", url)
          : response(JSON.stringify({ status: "ok", statusCode: 404, msg: "not found" }), url);
      }
    });
    const dlpanda = new DLPandaProvider({
      enabled: true,
      fetchImpl: async (input) => {
        const url = input.toString();
        return response(
          url.includes("t0ken=") ? resultHtml : '<input name="t0ken" value="route-token">',
          url
        );
      }
    });
    const router = new ProviderRouter([dlpanda, twitter]);

    const routed = await router.resolve(xInput);

    expect(routed.resolution.result.provenance.provider).toBe("dlpanda");
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["twittersaver", "failed"],
      ["dlpanda", "succeeded"]
    ]);
  });
});
