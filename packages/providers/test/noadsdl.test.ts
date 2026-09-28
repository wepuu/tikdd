import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  NoAdsDLProvider,
  parseNoAdsJobResponse,
  parseNoAdsVideoInfo,
  reviewedNoAdsDirectUrl,
  reviewedNoAdsThumbnailUrl,
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
    expect(parsed).toMatchObject({
      formatCount: 5,
      formatSchema: "legacy",
      thumbnailUrl: "https://i.ytimg.com/vi/fixture/hqdefault.jpg",
      thumbnailStatus: "accepted",
      formats: [
        { formatId: "22", label: "720p MP4" },
        { formatId: "18", label: "360p MP4" }
      ]
    });
  });

  it("accepts the sparse video_formats schema used by the current service", async () => {
    const parsed = parseNoAdsVideoInfo(await fixture("noadsdl-video-info-sparse.json"));
    expect(parsed).toMatchObject({
      formatCount: 3,
      formatSchema: "sparse",
      formats: [
        { formatId: "22", label: "720p MP4" },
        { formatId: "37", label: "1080p MP4" },
        { formatId: "18", label: "480p MP4" }
      ]
    });
  });

  it("accepts only reviewed YouTube thumbnail hosts and image paths", () => {
    expect(reviewedNoAdsThumbnailUrl("https://i.ytimg.com/vi/id/hqdefault.jpg")).toBe(
      "https://i.ytimg.com/vi/id/hqdefault.jpg"
    );
    expect(reviewedNoAdsThumbnailUrl("https://i.ytimg.com/vi/id/hq720_2.jpg?sqp=fixture&rs=fixture-signature")).toBe(
      "https://i.ytimg.com/vi/id/hq720_2.jpg?sqp=fixture&rs=fixture-signature"
    );
    expect(reviewedNoAdsThumbnailUrl("https://img.youtube.com/vi/id/cover.webp")).toBe(
      "https://img.youtube.com/vi/id/cover.webp"
    );
    for (const value of [
      "http://i.ytimg.com/vi/id/cover.jpg",
      "https://evil.i.ytimg.com/vi/id/cover.jpg",
      "https://ytimg.com/vi/id/cover.jpg",
      "https://user:pass@i.ytimg.com/vi/id/cover.jpg",
      "https://i.ytimg.com:8443/vi/id/cover.jpg",
      "https://i.ytimg.com/vi/id/cover.jpg?token=secret",
      "https://i.ytimg.com/vi/id/cover.jpg?sqp=one&sqp=two",
      "https://i.ytimg.com/vi/id/cover.jpg?sqp=",
      "https://img.youtube.com/vi/id/cover.jpg?sqp=fixture",
      "https://i.ytimg.com/vi/id/cover.jpg#fragment",
      "https://i.ytimg.com/vi/id/cover.jpg#",
      "https://i.ytimg.com/vi/id/cover.svg"
    ]) expect(reviewedNoAdsThumbnailUrl(value)).toBeNull();
    expect(parseNoAdsVideoInfo(JSON.stringify({
      success: true,
      thumbnail: "https://evil.i.ytimg.com/cover.jpg",
      video_formats: { "720p MP4": { format_id: "22" } }
    }))).toMatchObject({ thumbnailUrl: null, thumbnailStatus: "rejected" });
  });

  it("accepts the reviewed Shorts thumbnail query shape", async () => {
    const parsed = parseNoAdsVideoInfo(await fixture("noadsdl-video-info-shorts.json"));
    expect(parsed).toMatchObject({
      thumbnailUrl: "https://i.ytimg.com/vi/fixture/hq720_2.jpg?sqp=fixture&rs=fixture-signature",
      thumbnailStatus: "accepted",
      formats: [{ formatId: "22", label: "720p MP4" }]
    });
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
      maxPreparedFormats: 1,
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
      eligibleFormatCount: 2,
      requestedFormatCount: 1,
      preparedFormatCount: 1,
      skippedFormatCount: 1,
      thumbnailAccepted: true,
      thumbnailStatus: "accepted",
      secondaryFailureCode: null,
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
      maxPreparedFormats: 1,
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
      maxPreparedFormats: 1,
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

  it("prepares at most two formats in preferred order", async () => {
    const [info, ready] = await Promise.all([
      fixture("noadsdl-video-info-sparse.json"),
      fixture("noadsdl-status-ready.json")
    ]);
    const requests: string[] = [];
    const diagnostics: NoAdsDiagnosticEvent[] = [];
    const provider = new NoAdsDLProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      pollIntervalMs: 0,
      maxPreparedFormats: 2,
      diagnosticSink: (event) => diagnostics.push(event),
      fetchImpl: async (request) => {
        requests.push(request.toString());
        return response(requests.length === 1 ? info : ready);
      }
    });

    const resolution = await provider.resolve(input);
    expect(requests).toHaveLength(3);
    expect(requests[1]).toContain("format_id=22");
    expect(requests[2]).toContain("format_id=37");
    expect(resolution.result.media.thumbnailUrl).toBe("https://img.youtube.com/vi/fixture/maxresdefault.webp");
    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual(["720p MP4", "1080p MP4"]);
    expect(resolution.candidates).toHaveLength(2);
    expect(diagnostics).toEqual([expect.objectContaining({
      outcome: "success",
      eligibleFormatCount: 3,
      requestedFormatCount: 2,
      preparedFormatCount: 2,
      skippedFormatCount: 1,
      thumbnailAccepted: true,
      thumbnailStatus: "accepted",
      secondaryFailureCode: null
    })]);
  });

  it("keeps the primary format when secondary preparation fails", async () => {
    const [info, ready] = await Promise.all([
      fixture("noadsdl-video-info-sparse.json"),
      fixture("noadsdl-status-ready.json")
    ]);
    let requests = 0;
    const diagnostics: NoAdsDiagnosticEvent[] = [];
    const provider = new NoAdsDLProvider({
      enabled: true,
      deliveryVerified: true,
      minIntervalMs: 0,
      pollIntervalMs: 0,
      maxPreparedFormats: 2,
      diagnosticSink: (event) => diagnostics.push(event),
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) return response(info);
        if (requests === 2) return response(ready);
        return response(JSON.stringify({ status: "error", message: "upstream unavailable" }), 503);
      }
    });

    const resolution = await provider.resolve(input);
    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual(["720p MP4"]);
    expect(resolution.candidates).toHaveLength(1);
    expect(diagnostics).toEqual([expect.objectContaining({
      outcome: "success",
      requestedFormatCount: 2,
      preparedFormatCount: 1,
      skippedFormatCount: 2,
      secondaryFailureCode: "provider_unavailable"
    })]);
  });
});
