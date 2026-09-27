import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import {
  SnapYTProvider,
  extractSnapYTNonce,
  parseSnapYTAjaxResponse,
  parseSnapYTResultPage,
  type SnapYTDiagnosticEvent
} from "../src/index";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const input = {
  taskId: "tsk_fixture_youtube",
  sourceUrl: "https://www.youtube.com/watch?v=fixture",
  canonicalUrl: "https://www.youtube.com/watch?v=fixture",
  platform: "youtube"
} as const;

function response(body: string, url: string, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType }
  }) as Response & { url: string };
}

function withUrl(value: Response, url: string): Response {
  Object.defineProperty(value, "url", { configurable: true, value: url });
  return value;
}

describe("SnapYT YouTube adapter", () => {
  it("extracts only a bounded page nonce", () => {
    expect(extractSnapYTNonce('<script>const VD_NONCE = "fixture_nonce";</script>')).toBe("fixture_nonce");
    expect(() => extractSnapYTNonce("<html>missing</html>")).toThrow(/request nonce/);
    expect(() => extractSnapYTNonce('<script>VD_NONCE = "bad space"</script>')).toThrow(/request nonce/);
  });

  it("parses a same-origin result page and rejects an external redirect", async () => {
    expect(parseSnapYTAjaxResponse(await fixture("snapyt-success.json"))).toBe(
      "https://www.snapyt.app/result/fixture"
    );
    expect(() => parseSnapYTAjaxResponse(JSON.stringify({
      success: true,
      data: { redirect_url: "https://snapyt.app.attacker.example/result" }
    }))).toThrow(/outside its allowlist/);
    expect(parseSnapYTAjaxResponse(JSON.stringify({
      success: true,
      data: { redirect: "/result/fixture-redirect" }
    }))).toBe("https://www.snapyt.app/result/fixture-redirect");
  });

  it("maps only reviewed combined MP4 itags and deduplicates targets", async () => {
    const parsed = parseSnapYTResultPage(await fixture("snapyt-result.html"));
    expect(parsed.candidateCount).toBe(5);
    expect(parsed.formats.map(({ quality, hasAudio, hasVideo }) => ({ quality, hasAudio, hasVideo })))
      .toEqual([
        { quality: "360p", hasAudio: true, hasVideo: true },
        { quality: "720p", hasAudio: true, hasVideo: true }
      ]);
  });

  it.each([
    "http://www.snapyt.app/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=18&nonce=n",
    "https://snapyt.app/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=18&nonce=n",
    "https://evil.www.snapyt.app/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=18&nonce=n",
    "https://www.snapyt.app:8443/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=18&nonce=n",
    "https://user:pass@www.snapyt.app/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=18&nonce=n",
    "https://www.snapyt.app/other?action=snapyt_force_download&pid=a&fmt=18&nonce=n",
    "https://www.snapyt.app/wp-admin/admin-ajax.php?action=other&pid=a&fmt=18&nonce=n",
    "https://www.snapyt.app/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=137&nonce=n",
    "https://www.snapyt.app/wp-admin/admin-ajax.php?action=snapyt_force_download&pid=a&fmt=18&nonce=n&extra=1"
  ])("rejects an unreviewed force-download target: %s", (target) => {
    expect(() => parseSnapYTResultPage(`<a data-force="${target.replaceAll("&", "&amp;")}">fixture</a>`))
      .toThrowError(ProviderError);
  });

  it("classifies a private-content response as terminal", async () => {
    try {
      parseSnapYTAjaxResponse(await fixture("snapyt-private.json"));
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({
        failureCode: "content_private",
        retryable: false,
        fallbackAllowed: false
      });
    }
  });

  it("stays disabled and delivery-unverified by default", () => {
    const provider = new SnapYTProvider();
    expect(provider.manifest).toMatchObject({
      id: "snapyt-app",
      enabled: false,
      platforms: [{ platform: "youtube", deliveryModes: [], verificationStatus: "fixture_verified" }]
    });
  });

  it("resolves through the bounded nonce, AJAX and result-page sequence", async () => {
    const [landing, success, result] = await Promise.all([
      fixture("snapyt-landing.html"),
      fixture("snapyt-success.json"),
      fixture("snapyt-result.html")
    ]);
    const diagnostics: SnapYTDiagnosticEvent[] = [];
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const requestHeaders: Headers[] = [];
    const provider = new SnapYTProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      diagnosticSink: (event) => diagnostics.push(event),
      fetchImpl: async (request, init) => {
        requestHeaders.push(new Headers(init?.headers));
        requests.push({
          url: request.toString(),
          method: init?.method ?? "GET",
          body: init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "")
        });
        if (requests.length === 1) {
          return withUrl(response(landing, request.toString(), "text/html"), request.toString());
        }
        if (requests.length === 2) {
          return withUrl(response(success, request.toString(), "application/json"), request.toString());
        }
        if (requests.length === 4) {
          return withUrl(new Response(new Uint8Array([1, 2, 3]), {
            status: 206,
            headers: {
              "content-type": "video/mp4",
              "content-disposition": "attachment; filename=fixture.mp4"
            }
          }), request.toString());
        }
        return withUrl(response(result, request.toString(), "text/html"), request.toString());
      }
    });

    const resolution = await provider.resolve(input);
    expect(requests.map(({ method }) => method)).toEqual(["GET", "POST", "GET", "GET"]);
    expect(requests[1]?.body).toContain("action=process_video_url");
    expect(requests[1]?.body).toContain("security=fixture_nonce");
    expect(requestHeaders[3]?.get("range")).toBe("bytes=0-1023");
    expect(requestHeaders[3]?.get("cookie")).toBeNull();
    expect(requestHeaders[3]?.get("referer")).toBeNull();
    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual(["720p"]);
    expect(resolution.candidates).toHaveLength(1);
    expect(resolution.candidates.every(({ hostPolicyId }) =>
      hostPolicyId === "snapyt-app-youtube-media-v1"
    )).toBe(true);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        event: "snapyt_resolution_diagnostic",
        phase: "completed",
        outcome: "success",
        candidateCount: 5,
        acceptedCount: 1,
        failureCode: null
      })
    ]);
    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain(input.canonicalUrl);
    expect(serialized).not.toContain("fixture_nonce");
    expect(serialized).not.toContain("admin-ajax.php");
  });

  it("rejects an audio response and tries the next bounded candidate", async () => {
    const [landing, success, result] = await Promise.all([
      fixture("snapyt-landing.html"),
      fixture("snapyt-success.json"),
      fixture("snapyt-result.html")
    ]);
    const requests: string[] = [];
    const provider = new SnapYTProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      fetchImpl: async (request) => {
        requests.push(request.toString());
        if (requests.length === 1) return withUrl(response(landing, request.toString(), "text/html"), request.toString());
        if (requests.length === 2) return withUrl(response(success, request.toString(), "application/json"), request.toString());
        if (requests.length === 3) return withUrl(response(result, request.toString(), "text/html"), request.toString());
        if (requests.length === 4) {
          return withUrl(new Response(new Uint8Array([1]), {
            status: 206,
            headers: {
              "content-type": "audio/webm",
              "content-disposition": "attachment; filename=audio.webm"
            }
          }), request.toString());
        }
        return withUrl(new Response(new Uint8Array([1, 2]), {
          status: 206,
          headers: {
            "content-type": "video/mp4",
            "content-disposition": "attachment; filename=fixture.mp4"
          }
        }), request.toString());
      }
    });
    const resolution = await provider.resolve(input);
    expect(requests).toHaveLength(5);
    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual(["360p"]);
  });

  it("does not create a candidate when every force-download response is non-video", async () => {
    const [landing, success, result] = await Promise.all([
      fixture("snapyt-landing.html"),
      fixture("snapyt-success.json"),
      fixture("snapyt-result.html")
    ]);
    let calls = 0;
    const provider = new SnapYTProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      fetchImpl: async (request) => {
        calls += 1;
        if (calls === 1) return withUrl(response(landing, request.toString(), "text/html"), request.toString());
        if (calls === 2) return withUrl(response(success, request.toString(), "application/json"), request.toString());
        if (calls === 3) return withUrl(response(result, request.toString(), "text/html"), request.toString());
        return withUrl(new Response(new Uint8Array([1]), {
          status: 206,
          headers: {
            "content-type": "audio/webm",
            "content-disposition": "attachment; filename=audio.webm"
          }
        }), request.toString());
      }
    });
    await expect(provider.resolve(input)).rejects.toMatchObject({
      failureCode: "invalid_result",
      fallbackAllowed: true
    });
    expect(calls).toBe(5);
  });

  it("does not resolve until the browser Delivery audit is explicit", async () => {
    const provider = new SnapYTProvider({ enabled: true, deliveryVerified: false });
    await expect(provider.resolve(input)).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false
    });
  });

  it("enforces a conservative per-process request interval", async () => {
    const [landing, success, result] = await Promise.all([
      fixture("snapyt-landing.html"),
      fixture("snapyt-success.json"),
      fixture("snapyt-result.html")
    ]);
    let calls = 0;
    const bodies = [landing, success, result];
    const types = ["text/html", "application/json", "text/html"];
    const provider = new SnapYTProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 60_000,
      fetchImpl: async (request) => {
        const index = calls++;
        if (index === 3) {
          return withUrl(new Response(new Uint8Array([1]), {
            status: 206,
            headers: {
              "content-type": "video/mp4",
              "content-disposition": "attachment; filename=fixture.mp4"
            }
          }), request.toString());
        }
        return withUrl(response(bodies[index] ?? result, request.toString(), types[index] ?? "text/html"), request.toString());
      }
    });
    await provider.resolve(input);
    await expect(provider.resolve({ ...input, taskId: "tsk_fixture_youtube_2" })).rejects.toMatchObject({
      failureCode: "provider_rate_limited",
      retryable: true,
      fallbackAllowed: true
    });
    expect(calls).toBe(4);
  });
});
