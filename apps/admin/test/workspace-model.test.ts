import { describe, expect, it } from "vitest";
import { workspaceFromHash } from "../lib/workspace-model";

describe("admin workspace navigation", () => {
  it("defaults to overview and accepts the four workspace hashes", () => {
    expect(workspaceFromHash(undefined)).toBe("overview");
    expect(workspaceFromHash("")).toBe("overview");
    expect(workspaceFromHash("#overview")).toBe("overview");
    expect(workspaceFromHash("#content")).toBe("content");
    expect(workspaceFromHash("#providers")).toBe("providers");
    expect(workspaceFromHash("#settings")).toBe("settings");
  });

  it("maps legacy deep links without breaking bookmarks", () => {
    expect(workspaceFromHash("#operational-truth")).toBe("providers");
    expect(workspaceFromHash("#publishing")).toBe("content");
    expect(workspaceFromHash("#site-integrations")).toBe("settings");
    expect(workspaceFromHash("#unknown-section")).toBe("overview");
  });
});
