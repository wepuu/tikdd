import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { VidomonProvider, createVidomonHash, extractVidomonToken, parseVidomonResponse } from "../src";

const input = {
  taskId: "task_fixture_vidomon",
  sourceUrl: "https://ok.ru/video/123",
  canonicalUrl: "https://ok.ru/video/123",
  platform: "odnoklassniki"
} as const;

async function fixture() {
  return readFile(new URL("./fixtures/vidomon-okru-success.json", import.meta.url), "utf8");
}

function response(body: string, type: string) {
  return new Response(body, { status: 200, headers: { "content-type": type, "set-cookie": "fixture_session=one; Path=/" } });
}

describe("Vidomon OK.ru adapter", () => {
  it("extracts the server token and matches the reviewed hash algorithm", () => {
    expect(extractVidomonToken('<input id="token" type="hidden" value="fixture-token">')).toBe("fixture-token");
    expect(extractVidomonToken('<input value="fixture-token" id="token">')).toBe("fixture-token");
    expect(extractVidomonToken('<input id="token" value="">')).toBeNull();
    expect(createVidomonHash("https://ok.ru/video/123")).toBe(
      `${Buffer.from(input.canonicalUrl).toString("base64")}${input.canonicalUrl.length + 1_000}${Buffer.from("aio-dl").toString("base64")}`
    );
  });

  it("normalizes valid MP4 resources without exposing provider fields", async () => {
    const parsed = parseVidomonResponse(await fixture());
    expect(parsed.resourceCount).toBe(5);
    expect(parsed.media.formats).toHaveLength(2);
    expect(parsed.rejectedHostCount).toBe(1);
    expect(parsed.rejectedFormatCount).toBe(1);
    expect(parsed.media.thumbnailUrl).toContain("iv.okcdn.ru");
  });

  it("replays the page token protocol and returns encrypted-candidate-ready redirects", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new VidomonProvider({
      enabled: true,
      fetchImpl: async (url, init = {}) => {
        calls.push({ url: url.toString(), init });
        if (calls.length === 1) return response('<input id="token" value="fixture-token">', "text/html");
        return response(await fixture(), "application/json");
      }
    });
    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("https://vidomon.com/");
    expect(calls[1]?.url).toBe("https://vidomon.com/wp-json/aio-dl/video-data/");
    const body = calls[1]?.init.body as URLSearchParams;
    expect([...body.keys()].sort()).toEqual(["hash", "token", "url"]);
    expect(new Headers(calls[1]?.init.headers).get("origin")).toBe("https://vidomon.com");
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.candidates.every(({ hostPolicyId }) => hostPolicyId === "vidomon-okru-media-v1")).toBe(true);
    expect(JSON.stringify(resolution.result)).not.toContain("vd1.okcdn.ru");
    expect(JSON.stringify(resolution.result)).not.toContain("vd2.okcdn.ru");
    expect(JSON.stringify(resolution.result)).not.toContain("fixture-token");
  });

  it("fails closed when the token or media boundary changes", async () => {
    const provider = new VidomonProvider({
      enabled: true,
      fetchImpl: async () => response("<html></html>", "text/html")
    });
    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_schema_changed" });
    expect(() => parseVidomonResponse(JSON.stringify({ medias: [{ url: "https://okcdn.ru/video", extension: "mp4", videoAvailable: true }] })))
      .toThrow(/no reviewed MP4/i);
  });
});
