import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FDownIsuruProvider,
  ProviderRouter,
  SocialDownloaderRequestBudget,
  SocialDownloaderProvider,
  parseSocialDownloaderResponse,
  type ResolveInput
} from "../src/index";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const facebookInput: ResolveInput = {
  taskId: "tsk_7123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.facebook.com/share/r/fixture/",
  canonicalUrl: "https://www.facebook.com/share/r/fixture/",
  platform: "facebook"
};

function jsonResponse(body: string, status = 200, url = "https://www.socialdownloader.space/api/download") {
  const response = new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("SocialDownloaderProvider", () => {
  it("normalizes the observed provider stream and deduplicates duplicate fields", async () => {
    const success = await fixture("socialdownloader-success.json");
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new SocialDownloaderProvider({
      enabled: true,
      fetchImpl: async (input, init) => {
        calls.push({ url: input.toString(), ...(init ? { init } : {}) });
        return jsonResponse(success, 200, input.toString());
      }
    });

    const resolution = await provider.resolve(facebookInput);
    expect(provider.manifest).toMatchObject({ id: "socialdownloader-space", enabled: true });
    expect(provider.manifest.platforms[0]).toMatchObject({ platform: "facebook", priority: 650, deliveryModes: ["redirect"] });
    expect(provider.manifest.platforms).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "x", deliveryModes: [] }),
      expect.objectContaining({ platform: "tiktok", deliveryModes: [] }),
      expect.objectContaining({ platform: "instagram", deliveryModes: [] }),
      expect.objectContaining({ platform: "youtube", deliveryModes: [] })
    ]));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(String(calls[0]?.init?.body)).toBe(JSON.stringify({ url: facebookInput.canonicalUrl }));
    expect(resolution.result.media.title).toBe("Facebook fixture");
    expect(resolution.result.media.thumbnailUrl).toBeNull();
    expect(resolution.result.formats).toHaveLength(1);
    expect(resolution.candidates).toHaveLength(1);
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "socialdownloader-space-facebook-media-v1"
    });
    expect(JSON.stringify(resolution.result)).not.toContain("socialdownloader.space");
  });

  it("exposes independent X and TikTok delivery capabilities only when verified", async () => {
    const success = await fixture("socialdownloader-success.json");
    const input: ResolveInput = {
      ...facebookInput,
      sourceUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
      canonicalUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
      platform: "tiktok"
    };
    const labProvider = new SocialDownloaderProvider({ enabled: true, approvedPlatforms: ["facebook", "tiktok"] });
    expect(labProvider.manifest.platforms.find(({ platform }) => platform === "tiktok")).toMatchObject({
      deliveryModes: [],
      verificationStatus: "fixture_verified"
    });
    const provider = new SocialDownloaderProvider({
      enabled: true,
      approvedPlatforms: ["facebook", "tiktok"],
      deliveryVerifiedPlatforms: ["facebook", "tiktok"],
      fetchImpl: async (request) => jsonResponse(success, 200, request.toString())
    });
    const resolution = await provider.resolve(input);
    expect(provider.manifest.platforms.find(({ platform }) => platform === "tiktok")).toMatchObject({
      deliveryModes: ["redirect"],
      verificationStatus: "delivery_verified"
    });
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "socialdownloader-space-tiktok-media-v1"
    });
  });

  it("accepts only the reviewed same-host media path", () => {
    const parsed = parseSocialDownloaderResponse(JSON.stringify({
      success: true,
      downloadUrl: "https://www.socialdownloader.space/api/video?token=fixture",
      videoUrl: "https://www.socialdownloader.space/api/video?token=fixture"
    }));
    expect(parsed.formats).toHaveLength(1);

    for (const candidate of [
      "https://socialdownloader.space/api/video?token=fixture",
      "https://evil.example.test/api/video?token=fixture",
      "http://www.socialdownloader.space/api/video?token=fixture",
      "https://www.socialdownloader.space/api/download?token=fixture",
      "https://user:pass@www.socialdownloader.space/api/video?token=fixture"
    ]) {
      expect(() => parseSocialDownloaderResponse(JSON.stringify({ success: true, downloadUrl: candidate })))
        .toThrow(/no reviewed media|support this Facebook URL/i);
    }
  });

  it("treats an explicit no-media response as terminal and does not retry it", async () => {
    const unsupported = await fixture("socialdownloader-unsupported.json");
    let calls = 0;
    const provider = new SocialDownloaderProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return jsonResponse(unsupported, 422, input.toString());
      }
    });
    await expect(provider.resolve(facebookInput)).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false,
      fallbackAllowed: false
    });
    expect(calls).toBe(1);
  });

  it("emits diagnostics without provider host, URL, body, or query data", async () => {
    const events: unknown[] = [];
    const provider = new SocialDownloaderProvider({
      enabled: true,
      approvedPlatforms: ["facebook", "x"],
      diagnosticSink: (event) => events.push(event),
      fetchImpl: async (input) => jsonResponse(JSON.stringify({
        success: true,
        downloadUrl: "https://evil.example.test/api/video?secret=fixture"
      }), 200, input.toString())
    });
    await expect(provider.resolve({ ...facebookInput, platform: "x" })).rejects.toMatchObject({ failureCode: "unsupported_url" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "socialdownloader_resolution_diagnostic",
      taskId: facebookInput.taskId,
      platform: "x",
      outcome: "failure",
      failureCode: "unsupported_url"
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("socialdownloader.space");
    expect(serialized).not.toContain("evil.example.test");
    expect(serialized).not.toContain("secret");
  });

  it("is reached as a bounded Facebook secondary after FDown failure", async () => {
    const success = await fixture("socialdownloader-success.json");
    const primary = new FDownIsuruProvider({
      enabled: true,
      fetchImpl: async (input) => jsonResponse("{}", 503, input.toString())
    });
    const secondary = new SocialDownloaderProvider({
      enabled: true,
      fetchImpl: async (input) => jsonResponse(success, 200, input.toString())
    });
    const rollout = {
      async decide() {
        return { allowed: true, reason: "allowed" as const, ruleId: "wi72", snapshotRevision: 1, bucket: 0 };
      }
    };
    const routed = await new ProviderRouter([primary, secondary], {
      production: true,
      region: "nl",
      rolloutSource: rollout,
      maxAttempts: 2
    }).resolve(facebookInput);
    expect(routed.resolution.result.provenance.provider).toBe("socialdownloader-space");
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["fdown-isuru", "failed"],
      ["socialdownloader-space", "succeeded"]
    ]);
  });

  it("does not invoke a lower-priority provider after terminal SocialDownloader failure", async () => {
    const unsupported = await fixture("socialdownloader-unsupported.json");
    const calls: string[] = [];
    const primary = new SocialDownloaderProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls.push("socialdownloader");
        return jsonResponse(unsupported, 422, input.toString());
      }
    });
    const fallback = new FDownIsuruProvider({
      enabled: true,
      fetchImpl: async () => {
        calls.push("fdown");
        return jsonResponse("{}", 200);
      }
    });
    const rollout = {
      async decide() {
        return { allowed: true, reason: "allowed" as const, ruleId: "wi72", snapshotRevision: 1, bucket: 0 };
      }
    };
    await expect(new ProviderRouter([primary, fallback], {
      production: true,
      region: "nl",
      rolloutSource: rollout,
      maxAttempts: 2
    }).resolve(facebookInput)).rejects.toMatchObject({ failureCode: "unsupported_url" });
    expect(calls).toEqual(["fdown", "socialdownloader"]);
  });

  it("keeps unapproved platform capabilities out of the active adapter", async () => {
    const provider = new SocialDownloaderProvider({ enabled: true });
    await expect(provider.resolve({ ...facebookInput, platform: "x" })).rejects.toMatchObject({
      failureCode: "unsupported_url",
      fallbackAllowed: true
    });
  });

  it("shares a fail-fast budget across platform requests and honors cooldown", () => {
    let now = 1_000;
    const budget = new SocialDownloaderRequestBudget({ maxConcurrency: 1, minIntervalMs: 100, now: () => now });
    const first = budget.tryAcquire();
    expect(first).not.toBeNull();
    expect(budget.tryAcquire()).toBeNull();
    first?.release();
    expect(budget.tryAcquire()).toBeNull();
    now += 100;
    const second = budget.tryAcquire();
    expect(second).not.toBeNull();
    second?.release();
    budget.applyRetryAfter("2");
    now += 100;
    expect(budget.tryAcquire()).toBeNull();
    now += 1_900;
    expect(budget.tryAcquire()).not.toBeNull();
  });
});
