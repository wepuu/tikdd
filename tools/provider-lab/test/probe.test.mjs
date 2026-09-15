import assert from "node:assert/strict";
import test from "node:test";
import { MAX_REDIRECTS, RequestBudget, activeProbe, hasChallengeMarker } from "../probe.mjs";

test("request budget is bounded", async () => {
  const budget = new RequestBudget({ maxRequests: 1, minIntervalMs: 0 });
  await budget.take();
  await assert.rejects(() => budget.take(), /request_budget_exhausted/);
});

test("active probe fails closed for a private media URL", async () => {
  const provider = { id: "fixture", apiHost: "api.example.com", active: { id: "parse", platform: "instagram", method: "GET", path: "/parse", queryField: "url" } };
  const originalFetch = globalThis.fetch;
  const calls = [];
  const fetchImpl = async (input) => {
    calls.push(String(input));
    if (calls.length === 1) return new Response(JSON.stringify({ video: "https://127.0.0.1/video.mp4" }), { status: 200, headers: { "content-type": "application/json" } });
    throw new Error("media request must not be reached");
  };
  try {
    const result = await activeProbe(provider, { id: "primary", url: "https://www.instagram.com/reel/sample/" }, { budget: new RequestBudget({ minIntervalMs: 0 }), fetchImpl, dnsCheck: async (host) => host === "api.example.com" });
    assert.equal(result.result, "no_media");
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("redirect limit remains explicit", () => {
  assert.equal(MAX_REDIRECTS, 3);
});

test("active probe classifies upstream failures as deferred", async () => {
  const provider = { id: "fixture", apiHost: "api.example.com", active: { id: "parse", platform: "instagram", method: "GET", path: "/parse", queryField: "url" } };
  const result = await activeProbe(provider, { id: "primary", url: "https://www.instagram.com/reel/sample/" }, {
    budget: new RequestBudget({ minIntervalMs: 0 }),
    fetchImpl: async () => new Response("{}", { status: 500, headers: { "content-type": "application/json" } }),
    dnsCheck: async (host) => host === "api.example.com"
  });
  assert.equal(result.result, "deferred");
  assert.equal(result.failureCode, "upstream_unavailable");
});

test("active probe classifies access challenges as blocked", async () => {
  const provider = { id: "fixture", apiHost: "api.example.com", active: { id: "parse", platform: "instagram", method: "GET", path: "/parse", queryField: "url" } };
  const result = await activeProbe(provider, { id: "primary", url: "https://www.instagram.com/reel/sample/" }, {
    budget: new RequestBudget({ minIntervalMs: 0 }),
    fetchImpl: async () => new Response("challenge", { status: 403, headers: { "content-type": "text/html" } }),
    dnsCheck: async (host) => host === "api.example.com"
  });
  assert.equal(result.result, "blocked");
  assert.equal(result.failureCode, "access_challenge");
});

test("active probe classifies HTTP 419 as a session boundary", async () => {
  const provider = { id: "fixture", apiHost: "api.example.com", active: { id: "parse", platform: "facebook", method: "POST", path: "/parse", bodyField: "url" } };
  const result = await activeProbe(provider, { id: "primary", url: "https://www.facebook.com/share/r/sample/" }, {
    budget: new RequestBudget({ minIntervalMs: 0 }),
    fetchImpl: async () => new Response("{}", { status: 419, headers: { "content-type": "application/json" } }),
    dnsCheck: async (host) => host === "api.example.com"
  });
  assert.equal(result.result, "blocked");
  assert.equal(result.failureCode, "session_required");
});

test("active probe supports reviewed form encoding and bounded static body defaults", async () => {
  const provider = {
    id: "fixture",
    apiHost: "api.example.com",
    active: {
      id: "parse",
      platform: "facebook",
      method: "POST",
      path: "/parse",
      bodyField: "url",
      bodyEncoding: "form-urlencoded",
      bodyDefaults: { quality: "best" }
    }
  };
  let request;
  await activeProbe(provider, { id: "primary", url: "https://www.facebook.com/share/r/sample/" }, {
    budget: new RequestBudget({ minIntervalMs: 0 }),
    fetchImpl: async (_input, options) => {
      request = options;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    },
    dnsCheck: async (host) => host === "api.example.com"
  });
  assert.match(request.headers["content-type"], /application\/x-www-form-urlencoded/);
  assert.equal(new URLSearchParams(request.body).get("url"), "https://www.facebook.com/share/r/sample/");
  assert.equal(new URLSearchParams(request.body).get("quality"), "best");
});

test("challenge markers in bounded HTML are treated as blocked", async () => {
  assert.equal(hasChallengeMarker("<html><title>Just a moment...</title><script>turnstile.render()</script></html>"), true);
  const provider = { id: "fixture", apiHost: "api.example.com", active: { id: "parse", platform: "instagram", method: "GET", path: "/parse", queryField: "url" } };
  const result = await activeProbe(provider, { id: "primary", url: "https://www.instagram.com/reel/sample/" }, {
    budget: new RequestBudget({ minIntervalMs: 0 }),
    fetchImpl: async () => new Response("<html>verify you are human</html>", { status: 200, headers: { "content-type": "text/html" } }),
    dnsCheck: async (host) => host === "api.example.com"
  });
  assert.equal(result.result, "blocked");
  assert.equal(result.failureCode, "access_challenge");
});
