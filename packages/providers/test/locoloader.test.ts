import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LocoLoaderProvider,
  createLocoLoaderKey,
  parseLocoLoaderResponse,
  MemoryLocoLoaderRequestBudget,
  type ResolveInput
} from "../src/index";

const fixture = (name: string) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://xhamster.com/videos/fixture-video",
  canonicalUrl: "https://xhamster.com/videos/fixture-video",
  platform: "xhamster"
};

function response(body: string, contentType = "application/json", url = "https://www.locoloader.com/api-extract/") {
  const value = new Response(body, { status: 200, headers: { "content-type": contentType } });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

describe("LocoLoader xHamster adapter", () => {
  it("uses the dynamic form key and returns deduplicated reviewed MP4 candidates", async () => {
    const body = await fixture("locoloader-xhamster-success.json");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new LocoLoaderProvider({
      enabled: true,
      now: () => 1_700_000_000_123,
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), init: init ?? {} });
        return calls.length === 1 ? response("<html>fixture</html>", "text/html", url.toString()) : response(body, "application/json", url.toString());
      }
    });
    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(2);
    const form = calls[1]?.init.body as URLSearchParams;
    expect(form.get("url")).toBe(input.canonicalUrl);
    expect(form.get("key")).toBe(createLocoLoaderKey(input.canonicalUrl, 1_700_000_000_123));
    expect(resolution.result.formats).toHaveLength(2);
    expect(resolution.candidates[0]).toMatchObject({ hostPolicyId: "locoloader-xhamster-media-v1", mode: "redirect" });
    expect(JSON.stringify(resolution.result)).not.toContain("xhcdn.com");
    expect(JSON.stringify(resolution.result)).not.toContain("redacted");
    expect(JSON.stringify(resolution.candidates)).toContain("xhcdn.com");
  });

  it("accepts missing optional metadata but rejects unsafe or non-MP4 links", () => {
    const parsed = parseLocoLoaderResponse(JSON.stringify({ err: 0, final_urls: [{ links: [{ url: "https://video7.xhcdn.com/fixture/video.mp4" }] }] }));
    expect(parsed.title).toBe("xHamster video");
    expect(parsed.thumbnailUrl).toBeNull();
    expect(parsed.formats).toHaveLength(1);
    expect(() => parseLocoLoaderResponse(JSON.stringify({ err: 0, final_urls: [{ links: [
      { url: "https://xhcdn.com/fixture/video.mp4" },
      { url: "http://video7.xhcdn.com/fixture/video.mp4" },
      { url: "https://video7.xhcdn.com:8443/fixture/video.mp4" },
      { url: "https://video7.xhcdn.com/fixture/video.webm" }
    ] }] }))).toThrow(/no reviewed MP4/i);
  });

  it.each([1, 6, 7, 9])("maps transient upstream error %s without changing its typed boundary", (code) => {
    expect(() => parseLocoLoaderResponse(JSON.stringify({ err: true, err_num: code }))).toThrow(/temporarily unavailable/i);
  });

  it("maps challenge and terminal errors without leaking the upstream response", () => {
    expect(() => parseLocoLoaderResponse(JSON.stringify({ err: true, err_num: 13 }))).toThrow(/challenge/i);
    expect(() => parseLocoLoaderResponse(JSON.stringify({ err: true, err_num: 14 }))).toThrow(/supported/i);
  });

  it("enforces a shared extraction budget before the upstream POST", async () => {
    let now = 1_700_000_000_000;
    const budget = new MemoryLocoLoaderRequestBudget({ maxExtractions: 2, minIntervalMs: 0, now: () => now });
    let posts = 0;
    const provider = new LocoLoaderProvider({
      enabled: true,
      requestBudget: budget,
      fetchImpl: async (url, init) => {
        if (init?.method === "POST") posts += 1;
        return init?.method === "POST"
          ? response(JSON.stringify({ err: 0, final_urls: [{ links: [{ url: "https://video7.xhcdn.com/fixture/video.mp4" }] }] }))
          : response("<html>fixture</html>", "text/html", url.toString());
      }
    });
    await provider.resolve(input);
    now += 1_000;
    await provider.resolve(input);
    now += 1_000;
    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_rate_limited" });
    expect(posts).toBe(2);
  });

  it("exposes non-xHamster capabilities without granting an unreviewed Delivery policy", () => {
    const provider = new LocoLoaderProvider({ enabled: true, approvedPlatforms: ["xhamster", "tiktok"] });
    expect(provider.manifest.platforms).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "xhamster", deliveryModes: ["redirect"] }),
      expect.objectContaining({ platform: "tiktok", deliveryModes: [] })
    ]));
  });
});
