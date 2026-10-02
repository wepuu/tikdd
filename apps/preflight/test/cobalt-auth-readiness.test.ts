import { describe, expect, it, vi } from "vitest";
import { parseCobaltKeyRegistry, verifyCobaltAuthReadiness } from "../src/cobalt-auth-readiness";

const key = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const registry = {
  [key]: {
    name: "tikdd-cobalt-secondary",
    limit: 10,
    userAgents: ["TikDD/cobalt-secondary"],
    allowedServices: ["ok", "tiktok"]
  }
};

describe("Cobalt authentication readiness", () => {
  it("accepts the exact Worker key and Cobalt 11 registry schema", () => {
    expect(parseCobaltKeyRegistry(registry, key)).toEqual({
      allowedServices: ["ok", "tiktok"],
      userAgents: ["TikDD/cobalt-secondary"]
    });
  });

  it("rejects the singular userAgent field that Cobalt ignores as an invalid registry", () => {
    expect(() => parseCobaltKeyRegistry({
      [key]: { limit: 10, userAgent: "TikDD/cobalt-secondary", allowedServices: ["tiktok"] }
    }, key)).toThrow(/unsupported detail field: userAgent/);
  });

  it("rejects a mismatched key without placing either key in the error", () => {
    const other = "11111111-2222-4333-8444-555555555555";
    let message = "";
    try {
      parseCobaltKeyRegistry(registry, other);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/does not match/);
    expect(message).not.toContain(key);
    expect(message).not.toContain(other);
  });

  it("rejects a non-canonical uppercase API key", () => {
    expect(() => parseCobaltKeyRegistry(registry, key.toUpperCase()))
      .toThrow(/lowercase UUID/);
  });

  it("proves POST authentication by reaching URL validation without an upstream request", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Api-Key ${key}`);
      expect(JSON.parse(String(init?.body))).toEqual({ url: "https://example.invalid/" });
      return new Response(JSON.stringify({ status: "error", error: { code: "error.api.link.unsupported" } }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    });
    await expect(verifyCobaltAuthReadiness({ apiUrl: "http://cobalt-api:9000/", apiKey: key, fetchImpl }))
      .resolves.toEqual({ httpStatus: 400, errorCode: "error.api.link.unsupported" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("fails closed on the stale in-memory key response without leaking its body", async () => {
    const secretMarker = "response-secret-marker";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: "error",
      error: { code: "error.api.auth.key.not_found", context: { marker: secretMarker } }
    }), { status: 400 }));
    let message = "";
    try {
      await verifyCobaltAuthReadiness({ apiUrl: "http://cobalt-api:9000/", apiKey: key, fetchImpl });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/did not reach post-authentication URL validation/);
    expect(message).not.toContain(secretMarker);
    expect(message).not.toContain(key);
  });

  it("rejects public or ambiguous API origins", async () => {
    await expect(verifyCobaltAuthReadiness({ apiUrl: "https://api.example.com/", apiKey: key }))
      .rejects.toThrow(/exact private Cobalt service origin/);
  });
});
