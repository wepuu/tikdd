import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NoAdsDLProvider,
  parseNoAdsJobResponse,
  parseNoAdsVideoInfo,
  reviewedNoAdsDirectUrl,
  type NoAdsDiagnosticEvent
} from "../src/index";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const input = {
  taskId: "tsk_fixture_noadsdl",
  sourceUrl: "https://www.youtube.com/watch?v=fixture",
  canonicalUrl: "https://www.youtube.com/watch?v=fixture",
  platform: "youtube"
} as const;

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

describe("NoAdsDL YouTube adapter", () => {
  it("selects a free combined MP4 and ignores adaptive/audio-only formats", async () => {
    const parsed = parseNoAdsVideoInfo(await fixture("noadsdl-video-info.json"));
    expect(parsed).toMatchObject({ formatCount: 5, formatSchema: "legacy", formatId: "22", label: "720p MP4" });
  });

  it("accepts the sparse video_formats schema used by the current service", async () => {
    const parsed = parseNoAdsVideoInfo(await fixture("noadsdl-video-info-sparse.json"));
    expect(parsed).toMatchObject({ formatCount: 3, formatSchema: "sparse", formatId: "22", label: "720p MP4" });
  });

  it("maps unsuccessful responses to terminal content errors", async () => {
    try {
      parseNoAdsVideoInfo(await fixture("noadsdl-error.json"));
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ failureCode: "content_not_found", retryable: false });
    }
  });

  it("accepts only the reviewed status and media paths", () => {
    expect(reviewedNoAdsDirectUrl("https://noadsdl.com/api/free-download/file/0123456789abcdef")).toBe(
      "https://noadsdl.com/api/free-download/file/0123456789abcdef"
    );
    for (const value of [
      "http://noadsdl.com/api/free-download/file/0123456789abcdef",
      "https://www.noadsdl.com/api/free-download/file/0123456789abcdef",
      "https://evil.noadsdl.com/api/free-download/file/0123456789abcdef",
      "https://user:pass@noadsdl.com/api/free-download/file/0123456789abcdef",
      "https://noadsdl.com:8443/api/free-download/file/0123456789abcdef",
      "https://noadsdl.com/api/free-download/file/0123456789abcdef?token=secret",
      "https://noadsdl.com/api/free-download/status/0123456789abcdef"
    ]) expect(reviewedNoAdsDirectUrl(value)).toBeNull();
  });

  it("resolves the info, job and bounded status-poll sequence", async () => {
    const [info, queued, ready] = await Promise.all([
      fixture("noadsdl-video-info.json"),
      fixture("noadsdl-job-queued.json"),
      fixture("noadsdl-status-ready.json")
    ]);
    const requests: Array<{ url: string; method: string; cookie: string }> = [];
    const diagnostics: NoAdsDiagnosticEvent[] = [];
    const provider = new NoAdsDLProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      pollIntervalMs: 0,
      diagnosticSink: (event) => diagnostics.push(event),
      fetchImpl: async (request, init) => {
        requests.push({ url: request.toString(), method: init?.method ?? "GET", cookie: String(new Headers(init?.headers).get("cookie") ?? "") });
        const body = requests.length === 1 ? info : requests.length === 2 ? queued : ready;
        const result = response(body);
        if (requests.length === 1) result.headers.set("set-cookie", "session=fixture");
        return result;
      }
    });
    const resolution = await provider.resolve(input);
    expect(requests).toHaveLength(3);
    expect(requests.map(({ method }) => method)).toEqual(["GET", "GET", "GET"]);
    expect(requests[1]?.cookie).toContain("session=fixture");
    expect(requests[2]?.cookie).toContain("session=fixture");
    expect(resolution.candidates).toHaveLength(1);
    expect(resolution.candidates[0]?.hostPolicyId).toBe("noadsdl-youtube-media-v1");
    expect(diagnostics).toEqual([expect.objectContaining({
      event: "noadsdl_resolution_diagnostic",
      phase: "completed",
      outcome: "success",
      formatCount: 5,
      formatSchema: "legacy",
      selectedFormat: true,
      jobCreated: true,
      pollCount: 1,
      jobStatusCategory: "completed",
      progressBucket: "missing",
      failureCode: null
    })]);
    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain(input.canonicalUrl);
    expect(serialized).not.toContain("free-download");
  });

  it("stays disabled and Delivery-unverified by default", async () => {
    expect(new NoAdsDLProvider().manifest).toMatchObject({
      id: "noadsdl",
      enabled: false,
      platforms: [{ platform: "youtube", deliveryModes: [], verificationStatus: "fixture_verified" }]
    });
    await expect(new NoAdsDLProvider({ enabled: true }).resolve(input)).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false
    });
  });

  it("parses an immediately ready job without polling", async () => {
    const ready = await fixture("noadsdl-status-ready.json");
    expect(parseNoAdsJobResponse(ready)).toMatchObject({ status: "ready", directUrl: expect.stringContaining("/file/") });
  });

  it("keeps the initial status URL when processing polls omit it", async () => {
    const processing = await fixture("noadsdl-status-processing.json");
    expect(parseNoAdsJobResponse(processing)).toMatchObject({ status: "processing", statusUrl: null, directUrl: null });
  });

  it("rejects a completed job that omits its reviewed media URL", () => {
    expect(() => parseNoAdsJobResponse(JSON.stringify({
      status: "completed",
      status_url: "https://noadsdl.com/api/free-download/status/0123456789abcdef"
    }))).toThrow(expect.objectContaining({ failureCode: "provider_schema_changed" }));
  });

  it("continues a job across a processing response without status_url", async () => {
    const [info, queued, processing, ready] = await Promise.all([
      fixture("noadsdl-video-info-sparse.json"),
      fixture("noadsdl-job-queued.json"),
      fixture("noadsdl-status-processing.json"),
      fixture("noadsdl-status-ready.json")
    ]);
    let requests = 0;
    const provider = new NoAdsDLProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      pollIntervalMs: 0,
      fetchImpl: async () => {
        requests += 1;
        return response(requests === 1 ? info : requests === 2 ? queued : requests === 3 ? processing : ready);
      }
    });
    const resolution = await provider.resolve(input);
    expect(requests).toBe(4);
    expect(resolution.candidates).toHaveLength(1);
  });

  it("allows a single job to complete after more than ten bounded polls", async () => {
    const [info, queued, processing, ready] = await Promise.all([
      fixture("noadsdl-video-info-sparse.json"),
      fixture("noadsdl-job-queued.json"),
      fixture("noadsdl-status-processing.json"),
      fixture("noadsdl-status-ready.json")
    ]);
    let requests = 0;
    const diagnostics: NoAdsDiagnosticEvent[] = [];
    const provider = new NoAdsDLProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      pollIntervalMs: 0,
      pollBudgetMs: 40_000,
      diagnosticSink: (event) => diagnostics.push(event),
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) return response(info);
        if (requests === 2) return response(queued);
        return response(requests < 14 ? processing : ready);
      }
    });

    const resolution = await provider.resolve(input);
    expect(requests).toBe(14);
    expect(resolution.candidates).toHaveLength(1);
    expect(diagnostics).toEqual([expect.objectContaining({
      outcome: "success",
      pollCount: 12,
      jobStatusCategory: "completed"
    })]);
  });
});
