import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DLPandaProvider,
  ProviderRouter,
  SSSTwitterProvider,
  TwitterSaverProvider,
  type ResolveInput
} from "../src/index";

const fixture = async (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const xInput: ResolveInput = {
  taskId: "tsk_0123456789abcdef0123456789abcdef",
  sourceUrl: "https://x.com/authorized/status/123456",
  canonicalUrl: "https://x.com/authorized/status/123456",
  platform: "x"
};

function response(body: string, url: string, init: ResponseInit = {}): Response {
  const value = new Response(body, init);
  Object.defineProperty(value, "url", { value: url });
  return value;
}

function htmlResponse(body: string, url: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/html; charset=utf-8");
  }
  return response(body, url, { ...init, headers });
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
    expect(calls.every(({ init }) => init?.redirect === "manual")).toBe(true);
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
              msg: "This URL variant is not supported."
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

  it.each([
    ["This post is private.", "content_private"],
    ["This post was deleted.", "content_not_found"],
    ["This post is not available in your country.", "geo_restricted"]
  ])("maps terminal X outcomes without allowing fallback: %s", async (message, failureCode) => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = input.toString();
      return url.endsWith("/en")
        ? response("<html></html>", url)
        : response(JSON.stringify({ status: "error", msg: message }), url, {
            headers: { "content-type": "application/json" }
          });
    };
    const provider = new TwitterSaverProvider({ enabled: true, fetchImpl });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode,
      retryable: false,
      fallbackAllowed: false
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
      taskId: "tsk_1123456789abcdef0123456789abcdef",
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
        taskId: "tsk_2123456789abcdef0123456789abcdef",
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

describe("SSSTwitterProvider", () => {
  it("submits a fresh HTMX form and maps every format to an internal candidate", async () => {
    const [landingHtml, resultHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-success.html")
    ]);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = input.toString();
      calls.push({ url, ...(init ? { init } : {}) });
      return calls.length === 1
        ? htmlResponse(landingHtml, url, {
            headers: { "set-cookie": "qualification_session=fixture; Path=/; HttpOnly" }
          })
        : htmlResponse(resultHtml, url);
    };
    const provider = new SSSTwitterProvider({ enabled: true, fetchImpl });

    const startedAt = Date.now();
    const resolution = await provider.resolve(xInput);

    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual(["720p", "360p"]);
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.candidates.map(({ formatId }) => formatId)).toEqual(
      resolution.result.formats.map(({ id }) => id)
    );
    expect(
      resolution.candidates.every(
        ({ hostPolicyId, mode, secretHeaders }) =>
          hostPolicyId === "ssstwitter-media-v1" &&
          mode === "redirect" &&
          Object.keys(secretHeaders).length === 0
      )
    ).toBe(true);
    expect(JSON.stringify(resolution.result)).not.toContain("ssscdn.io");
    expect(JSON.stringify(resolution.result)).not.toContain("token=redacted");
    expect(new Date(resolution.candidates[0]!.expiresAt).getTime()).toBeGreaterThan(startedAt);
    expect(new Date(resolution.candidates[0]!.expiresAt).getTime()).toBeLessThanOrEqual(
      Date.now() + 4 * 60 * 1000
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]?.init?.headers).toMatchObject({
      cookie: "qualification_session=fixture",
      "hx-request": "true"
    });
    expect(calls[1]?.init?.body?.toString()).toContain("tt=fixture-token");
    expect(calls[1]?.init?.body?.toString()).toContain("source=form");
    expect(provider.consumeQualificationEvidence()).toEqual({
      candidateHosts: ["ssscdn.io"]
    });
    expect(provider.consumeQualificationEvidence()).toBeNull();
  });

  it("rejects an unreviewed media host instead of broadening delivery policy", async () => {
    const [landingHtml, changedHostHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-changed-host.html")
    ]);
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(
          calls === 1 ? landingHtml : changedHostHtml,
          input.toString()
        );
      }
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "invalid_result",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("rejects an unexpected page MIME before parsing provider markup", async () => {
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) =>
        response("fixture-binary", input.toString(), {
          headers: { "content-type": "application/octet-stream" }
        })
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "invalid_result",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("rejects redirects outside the exact provider page allowlist", async () => {
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) =>
        htmlResponse("", input.toString(), {
          status: 302,
          headers: { location: "https://example.test/redirect" }
        })
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "invalid_result",
      retryable: false,
      fallbackAllowed: true
    });
  });

  it("maps empty results and rate limits to explicit fallback decisions", async () => {
    const [landingHtml, emptyHtml, rateLimitHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-empty.html"),
      fixture("ssstwitter-rate-limit.html")
    ]);
    let calls = 0;
    const emptyProvider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(
          calls === 1 ? landingHtml : emptyHtml,
          input.toString()
        );
      }
    });
    await expect(emptyProvider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false,
      fallbackAllowed: true
    });

    const rateLimitedProvider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => htmlResponse(rateLimitHtml, input.toString(), { status: 429 })
    });
    await expect(rateLimitedProvider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "provider_rate_limited",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("fails safely when the form token schema changes", async () => {
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => htmlResponse("<form data-hx-post=\"/\"></form>", input.toString())
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "provider_schema_changed",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("rejects a full page without the selected result container", async () => {
    const landingHtml = await fixture("ssstwitter-landing.html");
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(
          calls === 1
            ? landingHtml
            : '<footer><a href="https://reelsvideo.io/">Instagram Downloader</a></footer>',
          input.toString()
        );
      }
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "provider_schema_changed",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("stops on private content without attempting policy bypass", async () => {
    const [landingHtml, privateHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-private.html")
    ]);
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(
          calls === 1 ? landingHtml : privateHtml,
          input.toString()
        );
      }
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "content_private",
      retryable: false,
      fallbackAllowed: false
    });
    expect(calls).toBe(2);
  });

  it("maps access blocks to a retryable provider challenge", async () => {
    const challengeHtml = await fixture("ssstwitter-challenge.html");
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(challengeHtml, input.toString(), {
          status: 403
        });
      }
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "provider_challenge",
      retryable: true,
      fallbackAllowed: true
    });
    expect(calls).toBe(1);
  });

  it("treats removed content as terminal and unsupported variants as fallback eligible", async () => {
    const [landingHtml, removedHtml, unsupportedHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-removed.html"),
      fixture("ssstwitter-unsupported.html")
    ]);
    const providerFor = (resultHtml: string) => {
      let calls = 0;
      return new SSSTwitterProvider({
        enabled: true,
        fetchImpl: async (input) => {
          calls += 1;
          return htmlResponse(calls === 1 ? landingHtml : resultHtml, input.toString());
        }
      });
    };

    await expect(providerFor(removedHtml).resolve(xInput)).rejects.toMatchObject({
      failureCode: "content_not_found",
      retryable: false,
      fallbackAllowed: false
    });
    await expect(providerFor(unsupportedHtml).resolve(xInput)).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false,
      fallbackAllowed: true
    });
  });

  it("fails safely on an incomplete result subtree", async () => {
    const [landingHtml, malformedHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-malformed.html")
    ]);
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landingHtml : malformedHtml, input.toString());
      }
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "provider_schema_changed",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("normalizes quoted multi-video results with complete candidate parity", async () => {
    const [landingHtml, resultHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-quoted-multi-video.html")
    ]);
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landingHtml : resultHtml, input.toString());
      }
    });

    const resolution = await provider.resolve(xInput);
    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual([
      "1080p",
      "720p",
      "360p"
    ]);
    expect(resolution.candidates.map(({ formatId }) => formatId)).toEqual(
      resolution.result.formats.map(({ id }) => id)
    );
  });

  it("treats regional restrictions as terminal", async () => {
    const [landingHtml, resultHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-geo-restricted.html")
    ]);
    let calls = 0;
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landingHtml : resultHtml, input.toString());
      }
    });

    await expect(provider.resolve(xInput)).rejects.toMatchObject({
      failureCode: "geo_restricted",
      retryable: false,
      fallbackAllowed: false
    });
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
          : response(
              JSON.stringify({
                status: "error",
                statusCode: 422,
                msg: "This URL variant is not supported."
              }),
              url
            );
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

  it("falls back from TwitterSaver to SSSTwitter for X", async () => {
    const [landingHtml, resultHtml] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-success.html")
    ]);
    const twitter = new TwitterSaverProvider({
      enabled: true,
      fetchImpl: async (input) => {
        const url = input.toString();
        return url.endsWith("/en")
          ? response("<html></html>", url)
          : response(
              JSON.stringify({
                status: "error",
                statusCode: 422,
                msg: "This URL variant is not supported."
              }),
              url
            );
      }
    });
    let ssstwitterCalls = 0;
    const ssstwitter = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (input) => {
        ssstwitterCalls += 1;
        return htmlResponse(ssstwitterCalls === 1 ? landingHtml : resultHtml, input.toString());
      }
    });
    const router = new ProviderRouter([ssstwitter, twitter]);

    const routed = await router.resolve(xInput);

    expect(routed.resolution.result.provenance.provider).toBe("ssstwitter");
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["twittersaver", "failed"],
      ["ssstwitter", "succeeded"]
    ]);
  });

  it("normalizes a cancelled SSSTwitter request as a retryable timeout", async () => {
    const ssstwitter = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        })
    });
    const router = new ProviderRouter([ssstwitter]);

    await expect(
      router.resolve({ ...xInput, signal: AbortSignal.timeout(5) })
    ).rejects.toMatchObject({
      failureCode: "provider_timeout",
      retryable: true
    });
  });
});
