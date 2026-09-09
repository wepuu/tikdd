import { describe, expect, it } from "vitest";
import { SaveFromInsProvider, type ResolveInput } from "../src/index";

const input: ResolveInput = {
  taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  sourceUrl: "https://www.instagram.com/reel/Fixture/?utm_source=copy",
  canonicalUrl: "https://www.instagram.com/reel/Fixture/",
  platform: "instagram"
};

function response(body: string, status = 200, contentType = "application/json"): Response {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

describe("SaveFromIns diagnostics", () => {
  it("emits a bounded success summary with resource counts", async () => {
    const events: unknown[] = [];
    const provider = new SaveFromInsProvider({
      enabled: true,
      requestAuth: "fixtureauth123",
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async () => response(JSON.stringify({
        status: 1,
        status_code: "success",
        data: {
          title: "Private fixture title that must not be logged",
          duration: 10,
          resources: [{
            quality: "720P",
            format: "mp4",
            type: "video",
            download_mode: "direct",
            download_url: "https://scontent-iad3-1.cdninstagram.com/fixture/video.mp4"
          }]
        }
      }))
    });

    await provider.resolve(input);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "savefromins_resolution_diagnostic",
      taskId: input.taskId,
      phase: "completed",
      outcome: "success",
      httpStatus: 200,
      contentType: "json",
      resourceCount: 1,
      validDirectMp4Count: 1,
      failureCode: null
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("cdninstagram.com");
    expect(serialized).not.toContain("fixtureauth123");
    expect(serialized).not.toContain("Private fixture title");
  });

  it("records status and response class without exposing response data", async () => {
    const events: unknown[] = [];
    const provider = new SaveFromInsProvider({
      enabled: true,
      requestAuth: "fixtureauth123",
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async () => response("Too many requests; token=secret", 429, "text/plain")
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_rate_limited" });
    expect(events[0]).toMatchObject({
      phase: "payload",
      outcome: "failure",
      httpStatus: 429,
      contentType: "text",
      resourceCount: null,
      validDirectMp4Count: 0,
      failureCode: "provider_rate_limited"
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("Too many requests");
    expect(serialized).not.toContain("secret");
  });

  it("classifies an HTML response as invalid data without retrying it", async () => {
    const events: unknown[] = [];
    const provider = new SaveFromInsProvider({
      enabled: true,
      requestAuth: "fixtureauth123",
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async () => response("<html>provider changed</html>", 200, "text/html")
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "invalid_result" });
    expect(events[0]).toMatchObject({
      httpStatus: 200,
      contentType: "html",
      failureCode: "invalid_result"
    });
  });

  it("maps HTTP 408 to the bounded transient retry class", async () => {
    const events: unknown[] = [];
    const provider = new SaveFromInsProvider({
      enabled: true,
      requestAuth: "fixtureauth123",
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async () => response("request timeout", 408, "text/plain")
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_timeout" });
    expect(events[0]).toMatchObject({ httpStatus: 408, failureCode: "provider_timeout" });
  });
});
