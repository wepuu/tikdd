import { describe, expect, it } from "vitest";
import {
  CobaltProvider,
  parseCobaltPlatformConfiguration,
  parseCobaltResponse,
  type ResolveInput
} from "../src";

const input: ResolveInput = {
  taskId: "tsk_cobalt_fixture_00000000000000000000000000000000",
  sourceUrl: "https://x.com/example/status/123",
  canonicalUrl: "https://x.com/example/status/123",
  platform: "x"
};

const tiktokInput: ResolveInput = {
  taskId: "tsk_cobalt_tiktok_fixture_000000000000000000000000",
  sourceUrl: "https://www.tiktok.com/@fixture/video/1234567890123456789",
  canonicalUrl: "https://www.tiktok.com/@fixture/video/1234567890123456789",
  platform: "tiktok"
};

function response(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("Cobalt self-hosted secondary Provider", () => {
  it("keeps approved and delivery-verified platform sets independent", () => {
    expect(parseCobaltPlatformConfiguration({ approvedPlatforms: "x,instagram", deliveryVerifiedPlatforms: "" }))
      .toEqual({
        approvedPlatforms: ["x", "instagram"],
        deliveryVerifiedPlatforms: [],
        deliveryVerifiedCapabilities: {}
      });
    expect(() => parseCobaltPlatformConfiguration({ approvedPlatforms: "x", deliveryVerifiedPlatforms: "x,facebook" }))
      .toThrow(/subset/);
    expect(() => parseCobaltPlatformConfiguration({ approvedPlatforms: "x,unknown" }))
      .toThrow(/unsupported platform/);
    expect(parseCobaltPlatformConfiguration({
      approvedPlatforms: "x,tiktok",
      deliveryVerifiedCapabilities: "x:redirect|picker,tiktok:tunnel|local-processing"
    }).deliveryVerifiedCapabilities).toEqual({
      x: ["redirect", "picker"],
      tiktok: ["tunnel", "local-processing"]
    });
  });

  it("normalizes redirect and mixed picker responses", () => {
    const redirect = parseCobaltResponse(JSON.stringify({
      status: "redirect",
      url: "https://video.twimg.com/ext_tw_video/fixture/pu/vid/1280x720/fixture.mp4",
      filename: "fixture-720p.mp4"
    }));
    expect(redirect.formats).toHaveLength(1);
    expect(redirect.formats[0]).toMatchObject({ container: "mp4", hasVideo: true, hasAudio: true, quality: "720p" });

    const picker = parseCobaltResponse(JSON.stringify({
      status: "picker",
      picker: [
        { type: "photo", url: "https://pbs.twimg.com/media/fixture.jpg" },
        { type: "video", url: "https://video.twimg.com/ext_tw_video/fixture/pu/vid/640x360/fixture.mp4", quality: "360p" },
        { type: "video", url: "https://video.twimg.com/ext_tw_video/fixture/pu/vid/640x360/fixture.mp4", quality: "360p" }
      ],
      audio: "https://video.twimg.com/audio/fixture.m4a",
      audioFilename: "fixture.m4a"
    }));
    expect(picker.formats).toHaveLength(3);
    expect(picker.formats.map(({ mediaKind }) => mediaKind)).toEqual(["image", "video", "audio"]);
  });

  it("keeps a GIF picker item typed as a GIF", () => {
    const parsed = parseCobaltResponse(JSON.stringify({
      status: "picker",
      picker: [{ type: "gif", url: "https://video.twimg.com/ext_tw_video/fixture.gif" }]
    }));
    expect(parsed.formats[0]).toMatchObject({ mediaKind: "gif", container: "gif", hasVideo: false });
  });

  it("normalizes signed tunnel and local-processing results", () => {
    const exp = String(Date.now() + 120_000);
    const tunnel = `https://media.tikdd.cc/tunnel?id=${"a".repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
    expect(parseCobaltResponse(JSON.stringify({ status: "tunnel", url: tunnel }))).toMatchObject({
      responseMode: "tunnel",
      requiredModes: ["tunnel"]
    });
    const processing = parseCobaltResponse(JSON.stringify({
      status: "local-processing",
      type: "merge",
      tunnel: [tunnel, tunnel.replace("a".repeat(21), "e".repeat(21))],
      output: { type: "video/mp4", filename: "TikDD-X-merged.mp4" }
    }));
    expect(processing.formats[0]).toMatchObject({
      hostPolicyId: "cobalt-selfhosted-processing-media-v1",
      processing: {
        operation: "merge",
        inputs: [
          { url: tunnel.replace("a".repeat(21), "e".repeat(21)), role: "video" },
          { url: tunnel, role: "audio" }
        ]
      }
    });
  });

  it("allows Dailymotion only through the reviewed tunnel policy", () => {
    const exp = String(Date.now() + 120_000);
    const tunnel = `https://media.tikdd.cc/tunnel?id=${"a".repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
    expect(parseCobaltResponse(JSON.stringify({ status: "tunnel", url: tunnel }), 200, "dailymotion").formats[0])
      .toMatchObject({ mode: "proxy", hostPolicyId: "cobalt-selfhosted-tunnel-media-v1" });
    expect(() => parseCobaltResponse(JSON.stringify({
      status: "redirect",
      url: "https://unreviewed.example/video.mp4"
    }), 200, "dailymotion")).toThrow(/without a reviewed platform policy/);
  });

  it("keeps the WI137 platforms closed unless an exact mode is verified", () => {
    const configuration = parseCobaltPlatformConfiguration({
      approvedPlatforms: "dailymotion,reddit,vk",
      deliveryVerifiedCapabilities: "dailymotion:tunnel"
    });
    expect(configuration.deliveryVerifiedCapabilities).toEqual({ dailymotion: ["tunnel"] });
    const provider = new CobaltProvider({
      approvedPlatforms: configuration.approvedPlatforms,
      deliveryVerifiedCapabilities: configuration.deliveryVerifiedCapabilities
    });
    expect(provider.manifest.platforms.find(({ platform }) => platform === "dailymotion"))
      .toMatchObject({ priority: 450, deliveryModes: ["proxy"], verificationStatus: "delivery_verified" });
    expect(provider.manifest.platforms.find(({ platform }) => platform === "reddit"))
      .toMatchObject({ deliveryModes: [], verificationStatus: "fixture_verified" });
    expect(provider.manifest.platforms.find(({ platform }) => platform === "vk"))
      .toMatchObject({ deliveryModes: [], verificationStatus: "fixture_verified" });
  });

  it("calls only the private API and returns a reviewed redirect candidate", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new CobaltProvider({
      enabled: true,
      apiUrl: "http://cobalt-api:9000/",
      apiKey: "fixture-api-key",
      approvedPlatforms: ["x"],
      deliveryVerifiedPlatforms: ["x"],
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), ...(init ? { init } : {}) });
        return response(JSON.stringify({
          status: "redirect",
          url: "https://video.twimg.com/ext_tw_video/fixture/pu/vid/1280x720/fixture.mp4",
          filename: "fixture-720p.mp4"
        }));
      }
    });
    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://cobalt-api:9000/");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Api-Key fixture-api-key");
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ localProcessing: "disabled" });
    expect(JSON.stringify(resolution.result)).not.toContain("video.twimg.com");
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "cobalt-selfhosted-x-media-v1"
    });
  });

  it("stays fail-closed until the platform has a Delivery audit", async () => {
    const provider = new CobaltProvider({ enabled: true, apiKey: "fixture-api-key", approvedPlatforms: ["x"] });
    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "unsupported_url" });
    expect(provider.manifest.platforms.find(({ platform }) => platform === "x")).toMatchObject({
      deliveryModes: [],
      verificationStatus: "fixture_verified"
    });
  });

  it("adds an optional official TikTok thumbnail after Cobalt succeeds", async () => {
    const exp = String(Date.now() + 120_000);
    const tunnel = `https://media.tikdd.cc/tunnel?id=${"a".repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
    const provider = new CobaltProvider({
      enabled: true,
      apiKey: "fixture-api-key",
      approvedPlatforms: ["tiktok"],
      deliveryVerifiedCapabilities: { tiktok: ["tunnel"] },
      fetchImpl: async () => response(JSON.stringify({ status: "tunnel", url: tunnel, filename: "fixture.mp4" })),
      thumbnailFetchImpl: async () => response(JSON.stringify({
        thumbnail_url: "https://p16-common-sign.tiktokcdn-eu.com/obj/fixture-cover"
      }))
    });

    const resolution = await provider.resolve(tiktokInput);
    expect(resolution.result.media.thumbnailUrl).toBe("https://p16-common-sign.tiktokcdn-eu.com/obj/fixture-cover");
    expect(resolution.candidates[0]).toMatchObject({
      mode: "proxy",
      hostPolicyId: "cobalt-selfhosted-tunnel-media-v1"
    });
  });

  it("preserves the successful Cobalt download when thumbnail enrichment fails", async () => {
    const exp = String(Date.now() + 120_000);
    const tunnel = `https://media.tikdd.cc/tunnel?id=${"a".repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
    const provider = new CobaltProvider({
      enabled: true,
      apiKey: "fixture-api-key",
      approvedPlatforms: ["tiktok"],
      deliveryVerifiedCapabilities: { tiktok: ["tunnel"] },
      fetchImpl: async () => response(JSON.stringify({ status: "tunnel", url: tunnel, filename: "fixture.mp4" })),
      thumbnailFetchImpl: async () => response("upstream unavailable", 503)
    });

    const resolution = await provider.resolve(tiktokInput);
    expect(resolution.result.media.thumbnailUrl).toBeNull();
    expect(resolution.result.formats).toHaveLength(1);
    expect(resolution.candidates).toHaveLength(1);
  });
});
