import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  FDownIsuruProvider,
  ProviderError,
  parseFDownIsuruResponse,
  type ResolveInput
} from "../src/index";

const fixture = async (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const facebookInput: ResolveInput = {
  taskId: "tsk_4123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.facebook.com/share/r/fixture/",
  canonicalUrl: "https://www.facebook.com/share/r/fixture/",
  platform: "facebook"
};

function response(body: string, url: string, status = 200): Response {
  const result = new Response(body, { status, headers: { "content-type": "application/json" } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

describe("FDownIsuruProvider", () => {
  it("normalizes the observed response and creates redirect candidates", async () => {
    const success = await fixture("fdown-isuru-success.json");
    let request: RequestInit | undefined;
    const provider = new FDownIsuruProvider({
      enabled: true,
      fetchImpl: async (input, init) => {
        request = init;
        return response(success, input.toString());
      }
    });

    const resolution = await provider.resolve(facebookInput);
    expect(provider.manifest).toMatchObject({ id: "fdown-isuru", enabled: true, regions: ["nl"] });
    expect(resolution.result.media.title).toBe("Facebook fixture");
    expect(resolution.result.media.author).toBe("fixture-uploader");
    expect(resolution.result.media.thumbnailUrl).toBeNull();
    expect(resolution.result.formats.map(({ quality }) => quality)).toEqual(["Original", "720p"]);
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.candidates.every(({ hostPolicyId }) => hostPolicyId === "fdown-isuru-facebook-media-v1")).toBe(true);
    expect(request?.method).toBe("POST");
    expect(request?.headers).toMatchObject({ "content-type": "application/json" });
    expect(String(request?.body)).toContain('"quality":"best"');
    expect(String(request?.body)).toContain("https://www.facebook.com/share/r/fixture/");
    expect(JSON.stringify(resolution.result)).not.toContain("fbcdn.net");
  });

  it("allows missing optional media fields while failing closed without MP4s", async () => {
    const parsed = parseFDownIsuruResponse(JSON.stringify({
      status: "success",
      video_info: {},
      available_formats: [{ quality: "720p", ext: "mp4", url: "https://video.fna.fbcdn.net/fixture/video.mp4" }]
    }));
    expect(parsed.title).toBeNull();
    expect(parsed.author).toBeNull();
    expect(parsed.formats).toHaveLength(1);
    await expect(async () => parseFDownIsuruResponse(await fixture("fdown-isuru-no-media.json")))
      .rejects.toMatchObject({ failureCode: "invalid_result", retryable: true, fallbackAllowed: true });
  });

  it.each([
    ["fdown-isuru-private.json", 200, "content_private", false, false],
    ["fdown-isuru-not-found.json", 200, "content_not_found", false, false],
    ["fdown-isuru-rate-limit.json", 429, "provider_rate_limited", true, true],
    ["fdown-isuru-challenge.json", 403, "provider_challenge", true, true]
  ] as const)("maps %s to the expected bounded decision", async (name, status, failureCode, retryable, fallbackAllowed) => {
    const provider = new FDownIsuruProvider({
      enabled: true,
      fetchImpl: async (input) => response(await fixture(name), input.toString(), status)
    });
    await expect(provider.resolve(facebookInput)).rejects.toMatchObject({ failureCode, retryable, fallbackAllowed });
  });

  it("maps malformed payloads to schema change and rejects other platforms", async () => {
    await expect(async () => parseFDownIsuruResponse(await fixture("fdown-isuru-malformed.json")))
      .rejects.toMatchObject({ failureCode: "invalid_result" });
    const provider = new FDownIsuruProvider({ enabled: true });
    await expect(provider.resolve({ ...facebookInput, platform: "instagram" })).rejects.toMatchObject({
      failureCode: "unsupported_url",
      retryable: false,
      fallbackAllowed: true
    });
  });

  it("fails closed when the upstream host redirects outside the allowlist", async () => {
    const provider = new FDownIsuruProvider({
      enabled: true,
      fetchImpl: async (input) => response("", input.toString(), 302)
    });
    const error = await provider.resolve(facebookInput).catch((value) => value);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ failureCode: "invalid_result", fallbackAllowed: true });
  });
});
