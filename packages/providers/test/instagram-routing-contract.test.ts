import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ProviderRolloutSource } from "@tikdd/rollout-control";
import { ProviderRouter, SaveFromInsProvider, type ResolveInput } from "../src/index";

const input: ResolveInput = {
  taskId: "tsk_4123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.instagram.com/reel/Fixture/?utm_source=copy",
  canonicalUrl: "https://www.instagram.com/reel/Fixture/",
  platform: "instagram"
};

const allow: ProviderRolloutSource = {
  async decide() {
    return { allowed: true, reason: "allowed", ruleId: "instagram-fixture", snapshotRevision: 1, bucket: 0 };
  }
};

function jsonResponse(body: string, url: string): Response {
  const response = new Response(body, { headers: { "content-type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

async function provider(calls: string[]): Promise<SaveFromInsProvider> {
  const fixture = await readFile(
    fileURLToPath(new URL("./fixtures/savefromins-success.json", import.meta.url)),
    "utf8"
  );
  return new SaveFromInsProvider({
    enabled: true,
    requestAuth: "fixtureauth123",
    fetchImpl: async (request) => {
      calls.push(request.toString());
      return jsonResponse(fixture, request.toString());
    }
  });
}

describe("production-shaped Instagram routing contract", () => {
  it("locks the exact platform, region and delivery capability", async () => {
    const manifest = (await provider([])).manifest;
    expect(manifest.regions).toEqual(["nl"]);
    expect(manifest.platforms).toEqual([{
      platform: "instagram",
      priority: 900,
      deliveryModes: ["redirect"],
      verificationStatus: "delivery_verified"
    }]);
  });

  it("routes only after an explicit rollout grant", async () => {
    const calls: string[] = [];
    const routed = await new ProviderRouter([await provider(calls)], {
      region: "nl",
      production: true,
      rolloutSource: allow
    }).resolve(input);
    expect(routed.resolution.result.provenance.provider).toBe("savefromins");
    expect(routed.attempts).toHaveLength(1);
    expect(routed.attempts[0]).toMatchObject({
      providerId: "savefromins",
      platform: "instagram",
      region: "nl",
      status: "succeeded"
    });
    expect(calls).toHaveLength(1);
  });

  it("does not turn Manifest eligibility into a traffic grant", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([await provider(calls)], { region: "nl", production: true });
    await expect(router.resolve(input)).rejects.toMatchObject({ failureCode: "provider_unavailable" });
    expect(calls).toEqual([]);
  });

  it("does not admit the candidate outside NL", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([await provider(calls)], {
      region: "global",
      production: true,
      rolloutSource: allow
    });
    await expect(router.resolve(input)).rejects.toMatchObject({ failureCode: "provider_unavailable" });
    expect(calls).toEqual([]);
  });
});
