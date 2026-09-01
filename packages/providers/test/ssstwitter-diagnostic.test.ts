import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SSSTwitterDiagnosticTrace,
  SSSTwitterProvider,
  loadSSSTwitterDiagnosticTraceConfiguration,
  type ResolveInput,
  type SSSTwitterDiagnosticTraceConfiguration,
  type SSSTwitterDiagnosticTraceEvent
} from "../src/index";

const fixture = async (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const input: ResolveInput = {
  taskId: "tsk_0123456789abcdef0123456789abcdef",
  sourceUrl: "https://x.com/authorized/status/123456?s=20",
  canonicalUrl: "https://x.com/authorized/status/123456",
  platform: "x"
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function response(body: string, url: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
  const value = new Response(body, { ...init, headers });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

function enabledConfiguration(overrides: Partial<SSSTwitterDiagnosticTraceConfiguration> = {}): SSSTwitterDiagnosticTraceConfiguration {
  return {
    enabled: true,
    canonicalSha256: digest(input.canonicalUrl),
    authorizationId: "p0-x-worker-trace-01",
    maximumInvocations: 2,
    region: "nl",
    ...overrides
  };
}

async function providerFixture() {
  const [landing, result] = await Promise.all([
    fixture("ssstwitter-landing.html"),
    fixture("ssstwitter-success.html")
  ]);
  let calls = 0;
  return {
    fetchImpl: (async (request) => {
      calls += 1;
      return response(calls % 2 === 1 ? landing : result, request.toString(),
        calls % 2 === 1
          ? { headers: { "set-cookie": "qualification_session=fixture; Path=/; HttpOnly" } }
          : {});
    }) as typeof fetch,
    get calls() { return calls; }
  };
}

afterEach(() => vi.useRealTimers());

describe("SSSTwitter task-scoped diagnostic trace", () => {
  it("is default-off and emits no events", async () => {
    const events: SSSTwitterDiagnosticTraceEvent[] = [];
    const trace = new SSSTwitterDiagnosticTrace(
      loadSSSTwitterDiagnosticTraceConfiguration({}, { production: true, region: "nl" }),
      (event) => events.push(event)
    );
    const fixtureFetch = await providerFixture();
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: fixtureFetch.fetchImpl,
      diagnosticTrace: trace,
      region: "nl"
    });

    await provider.resolve(input);

    expect(events).toEqual([]);
    expect(fixtureFetch.calls).toBe(2);
  });

  it("emits nothing when the exact canonical URL hash does not match", async () => {
    const events: SSSTwitterDiagnosticTraceEvent[] = [];
    const trace = new SSSTwitterDiagnosticTrace(
      enabledConfiguration({ canonicalSha256: digest("https://x.com/other/status/1") }),
      (event) => events.push(event)
    );
    const fixtureFetch = await providerFixture();
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: fixtureFetch.fetchImpl,
      diagnosticTrace: trace,
      region: "nl"
    });

    await provider.resolve(input);

    expect(events).toEqual([]);
  });

  it("emits the exact sanitized stage and HTTP transition sequence", async () => {
    const events: SSSTwitterDiagnosticTraceEvent[] = [];
    const trace = new SSSTwitterDiagnosticTrace(enabledConfiguration(), (event) => events.push(event));
    const fixtureFetch = await providerFixture();
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: fixtureFetch.fetchImpl,
      diagnosticTrace: trace,
      region: "nl"
    });

    await provider.resolve(input);

    expect(events.filter(({ kind }) => kind === "stage").map(({ stage }) => stage)).toEqual([
      "resolve_start",
      "landing_request_start",
      "landing_response_complete",
      "form_parse_start",
      "form_parse_success",
      "post_request_start",
      "result_response_complete",
      "result_parse_start",
      "result_parse_success",
      "resolution_create_start",
      "resolution_create_success",
      "resolve_success"
    ]);
    expect(events.filter(({ kind }) => kind === "http_request").map(({ requestOrdinal, method }) => [requestOrdinal, method]))
      .toEqual([[1, "GET"], [2, "POST"]]);
    expect(events.filter(({ kind }) => kind === "http_response").map(({ status }) => status))
      .toEqual([200, 200]);
    const post = events.find(({ kind, requestOrdinal }) => kind === "http_request" && requestOrdinal === 2);
    expect(post).toMatchObject({
      hostname: "ssstwitter.com",
      pathname: "/",
      bodyFieldNames: ["id", "locale", "source", "ts", "tt"],
      cookieNames: ["qualification_session"],
      cookieCount: 1,
      userAgentPresent: true,
      hxRequest: "true",
      hxTarget: "target"
    });
    expect(events.find(({ kind, stage }) => kind === "stage" && stage === "resolve_success"))
      .toMatchObject({ formatCount: 2, candidateCount: 2, candidateHostnames: ["ssscdn.io"] });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("fixture-token");
    expect(serialized).not.toContain("1785771900");
    expect(serialized).not.toContain("qualification_session=fixture");
    expect(serialized).not.toContain("https://ssscdn.io/fixture/");
    expect(serialized).not.toContain("token=redacted");
    expect(serialized).not.toContain("Authorized SSSTwitter fixture clip");
    expect(serialized).not.toContain("<section");
  });

  it("observes a manual redirect without consuming or cancelling its body", async () => {
    const [landing, result] = await Promise.all([
      fixture("ssstwitter-landing.html"),
      fixture("ssstwitter-success.html")
    ]);
    const redirect = response("redirect-body-must-remain-unread", "https://ssstwitter.com/", {
      status: 301,
      headers: { location: "/result_normal?en" }
    });
    const cancel = vi.spyOn(redirect.body!, "cancel");
    let calls = 0;
    const events: SSSTwitterDiagnosticTraceEvent[] = [];
    const provider = new SSSTwitterProvider({
      enabled: true,
      region: "nl",
      diagnosticTrace: new SSSTwitterDiagnosticTrace(enabledConfiguration(), (event) => events.push(event)),
      fetchImpl: async (request) => {
        calls += 1;
        if (calls === 1) return response(landing, request.toString());
        if (calls === 2) return redirect;
        return response(result, request.toString());
      }
    });

    await provider.resolve(input);

    expect(events.filter(({ kind }) => kind === "http_request").map(({ method }) => method))
      .toEqual(["GET", "POST", "GET"]);
    expect(events.filter(({ kind }) => kind === "http_response").map(({ status }) => status))
      .toEqual([200, 301, 200]);
    expect(events.find(({ kind, status }) => kind === "http_response" && status === 301))
      .toMatchObject({
        requestOrdinal: 2,
        locationPresent: true,
        locationHostname: "ssstwitter.com",
        locationPathname: "/result_normal"
      });
    expect(redirect.bodyUsed).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("hard-caps trace emission at two Provider invocations", async () => {
    const events: SSSTwitterDiagnosticTraceEvent[] = [];
    const trace = new SSSTwitterDiagnosticTrace(
      enabledConfiguration({ maximumInvocations: 2 }),
      (event) => events.push(event)
    );
    const fixtureFetch = await providerFixture();
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: fixtureFetch.fetchImpl,
      diagnosticTrace: trace,
      region: "nl"
    });

    await provider.resolve(input);
    await provider.resolve(input);
    await provider.resolve(input);

    expect(events.filter(({ kind, stage }) => kind === "stage" && stage === "resolve_start"))
      .toHaveLength(2);
    expect(new Set(events.map(({ invocationOrdinal }) => invocationOrdinal))).toEqual(new Set([1, 2]));
    expect(fixtureFetch.calls).toBe(6);
  });

  it("records the exact failed stage and sanitized ProviderError message", async () => {
    const landing = await fixture("ssstwitter-landing.html");
    let calls = 0;
    const events: SSSTwitterDiagnosticTraceEvent[] = [];
    const trace = new SSSTwitterDiagnosticTrace(enabledConfiguration(), (event) => events.push(event));
    const provider = new SSSTwitterProvider({
      enabled: true,
      region: "nl",
      diagnosticTrace: trace,
      fetchImpl: async (request) => {
        calls += 1;
        return response(calls === 1 ? landing : "<main>no result</main>", request.toString());
      }
    });

    await expect(provider.resolve(input)).rejects.toMatchObject({
      failureCode: "provider_schema_changed"
    });

    expect(events.at(-1)).toMatchObject({
      kind: "stage",
      stage: "resolve_failure",
      failedAtStage: "result_parse_start",
      failureCode: "provider_schema_changed",
      retryable: true,
      fallbackAllowed: true,
      message: "SSSTwitter did not return its result container."
    });
  });

  it("is behaviorally equivalent when tracing is enabled or disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
    const disabledFixture = await providerFixture();
    const enabledFixture = await providerFixture();
    const disabledProvider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: disabledFixture.fetchImpl,
      region: "nl"
    });
    const enabledProvider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: enabledFixture.fetchImpl,
      region: "nl",
      diagnosticTrace: new SSSTwitterDiagnosticTrace(enabledConfiguration(), () => undefined)
    });

    const [disabledResult, enabledResult] = await Promise.all([
      disabledProvider.resolve(input),
      enabledProvider.resolve(input)
    ]);

    expect(enabledResult).toEqual(disabledResult);
    expect(enabledFixture.calls).toBe(disabledFixture.calls);
  });

  it("fails closed on an invalid enabled production configuration", () => {
    expect(() => loadSSSTwitterDiagnosticTraceConfiguration({
      SSSTWITTER_DIAGNOSTIC_TRACE_ENABLED: "true",
      SSSTWITTER_DIAGNOSTIC_CANONICAL_SHA256: digest(input.canonicalUrl),
      SSSTWITTER_DIAGNOSTIC_AUTHORIZATION_ID: "p0-x-worker-trace-01",
      SSSTWITTER_DIAGNOSTIC_MAX_INVOCATIONS: "3"
    }, { production: true, region: "nl" })).toThrow(/must be 1 or 2/);
    expect(() => loadSSSTwitterDiagnosticTraceConfiguration({
      SSSTWITTER_DIAGNOSTIC_TRACE_ENABLED: "true",
      SSSTWITTER_DIAGNOSTIC_CANONICAL_SHA256: digest(input.canonicalUrl),
      SSSTWITTER_DIAGNOSTIC_AUTHORIZATION_ID: "p0-x-worker-trace-01"
    }, { production: false, region: "nl" })).toThrow(/NL production Worker/);
  });

  it("ignores diagnostic sink failures without changing Provider behavior", async () => {
    const fixtureFetch = await providerFixture();
    const provider = new SSSTwitterProvider({
      enabled: true,
      fetchImpl: fixtureFetch.fetchImpl,
      region: "nl",
      diagnosticTrace: new SSSTwitterDiagnosticTrace(enabledConfiguration(), () => {
        throw new Error("diagnostic sink failed");
      })
    });

    await expect(provider.resolve(input)).resolves.toMatchObject({
      result: { provenance: { provider: "ssstwitter" } }
    });
  });
});
