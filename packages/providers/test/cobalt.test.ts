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

function response(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("Cobalt self-hosted secondary Provider", () => {
  it("keeps approved and delivery-verified platform sets independent", () => {
    expect(parseCobaltPlatformConfiguration({ approvedPlatforms: "x,instagram", deliveryVerifiedPlatforms: "" }))
      .toEqual({ approvedPlatforms: ["x", "instagram"], deliveryVerifiedPlatforms: [] });
    expect(() => parseCobaltPlatformConfiguration({ approvedPlatforms: "x", deliveryVerifiedPlatforms: "x,facebook" }))
      .toThrow(/subset/);
    expect(() => parseCobaltPlatformConfiguration({ approvedPlatforms: "x,unknown" }))
      .toThrow(/unsupported platform/);
  });

  it("normalizes redirect and picker responses while rejecting audio-only resources", () => {
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
        { type: "audio", url: "https://video.twimg.com/audio/fixture.m4a", quality: "audio" },
        { type: "video", url: "https://video.twimg.com/ext_tw_video/fixture/pu/vid/640x360/fixture.mp4", quality: "360p" },
        { type: "video", url: "https://video.twimg.com/ext_tw_video/fixture/pu/vid/640x360/fixture.mp4", quality: "360p" }
      ]
    }));
    expect(picker.formats).toHaveLength(1);
    expect(picker.formats[0]?.quality).toBe("360p");
  });

  it("rejects tunnel and local-processing results instead of proxying them", () => {
    for (const status of ["tunnel", "local-processing"] as const) {
      expect(() => parseCobaltResponse(JSON.stringify({ status, url: "https://video.twimg.com/fixture.mp4" })))
        .toThrow(/non-portable/);
    }
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
});
