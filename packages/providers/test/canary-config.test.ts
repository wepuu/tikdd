import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ProviderCanaryConfigSchema,
  selectProviderCanaries,
  selectScheduledProviderCanaries
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
  it("contains the exact recurring authorized SSSTwitter/X tuple", () => {
    const checkedIn = ProviderCanaryConfigSchema.parse(JSON.parse(readFileSync(
      new URL("../../../config/provider-canaries.json", import.meta.url),
      "utf8"
    )));
    expect(selectProviderCanaries(checkedIn, {
      id: "ssstwitter-x-recurring-001",
      provider: "ssstwitter"
    })).toEqual([expect.objectContaining({
      provider: "ssstwitter",
      platform: "x",
      url: "https://x.com/SpaceX/status/2093477720638341395?s=20"
    })]);
  });

  it("selects only the explicit recurring authorization", () => {
    const checkedIn = ProviderCanaryConfigSchema.parse(JSON.parse(readFileSync(
      new URL("../../../config/provider-canaries.json", import.meta.url), "utf8"
    )));
    expect(checkedIn.scheduledCanaryIds).toEqual(["ssstwitter-x-recurring-001"]);
    expect(checkedIn.scheduledCanaryIds.every((id) => id !== "twittersaver-x-authorized-001" && id !== "dlpanda-tiktok-authorized-001")).toBe(true);
  });

  it("rejects unknown and duplicate scheduled IDs", () => {
    expect(() => ProviderCanaryConfigSchema.parse({ ...config, scheduledCanaryIds: ["missing-id"] })).toThrow(/Scheduled Canary ID/);
    expect(() => ProviderCanaryConfigSchema.parse({ ...config, scheduledCanaryIds: [config.canaries[0]!.id, config.canaries[0]!.id] })).toThrow(/unique/);
  });

  it("restricts scheduled selection to the reviewed recurring tuple", () => {
    expect(() => selectScheduledProviderCanaries({ ...config, scheduledCanaryIds: [config.canaries[0]!.id] })).toThrow(/recurring tuple/);
  });

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

  it("rejects malformed IDs and unsupported Providers", () => {
    expect(() =>
      ProviderCanaryConfigSchema.parse({
        ...config,
        canaries: [{ ...config.canaries[0], id: "SSSTwitter X" }]
      })
    ).toThrow();
    expect(() =>
      ProviderCanaryConfigSchema.parse({
        ...config,
        canaries: [{ ...config.canaries[0], provider: "unreviewed-provider" }]
      })
    ).toThrow();
  });

  it("refuses an unconfigured Provider/input selection", () => {
    expect(() =>
      selectProviderCanaries(config, {
        id: "ssstwitter-x-authorized-999",
        provider: "ssstwitter"
      })
    ).toThrow(/No canaries matched/);
  });
});
