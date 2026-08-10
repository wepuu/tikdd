import { describe, expect, it } from "vitest";
import {
  ProviderCanaryConfigSchema,
  selectProviderCanaries
} from "../src/canary-config";

const config = ProviderCanaryConfigSchema.parse({
  version: 2,
  authorization: {
    assertedBy: "project-owner",
    assertedAt: "2026-08-10",
    scope: "Exact test tuples only."
  },
  canaries: [
    {
      id: "twittersaver-x-authorized-001",
      provider: "twittersaver",
      platform: "x",
      url: "https://x.com/example/status/1"
    },
    {
      id: "dlpanda-x-authorized-001",
      provider: "dlpanda",
      platform: "x",
      url: "https://x.com/example/status/1"
    },
    {
      id: "dlpanda-tiktok-authorized-001",
      provider: "dlpanda",
      platform: "tiktok",
      url: "https://www.tiktok.com/@example/video/1"
    },
    {
      id: "ssstwitter-x-authorized-001",
      provider: "ssstwitter",
      platform: "x",
      url: "https://x.com/example/status/2"
    }
  ]
});

describe("provider canary configuration", () => {
  it("selects one exact authorized tuple by canary ID", () => {
    expect(
      selectProviderCanaries(config, { id: "dlpanda-x-authorized-001" })
    ).toEqual([config.canaries[1]]);
  });

  it("intersects provider and ID filters instead of broadening authorization", () => {
    expect(() =>
      selectProviderCanaries(config, {
        id: "twittersaver-x-authorized-001",
        provider: "dlpanda"
      })
    ).toThrow(/No canaries matched/);
  });

  it("selects the authorized SSSTwitter tuple without selecting another X provider", () => {
    expect(
      selectProviderCanaries(config, {
        id: "ssstwitter-x-authorized-001",
        provider: "ssstwitter"
      })
    ).toEqual([config.canaries[3]]);
  });

  it("rejects duplicate exact provider, platform, and URL tuples", () => {
    expect(() =>
      ProviderCanaryConfigSchema.parse({
        ...config,
        canaries: [...config.canaries, { ...config.canaries[1], id: "dlpanda-x-authorized-002" }]
      })
    ).toThrow(/tuples must be unique/);
  });
});
