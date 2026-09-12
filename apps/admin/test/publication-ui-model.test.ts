import { describe, expect, it } from "vitest";
import type { AdminContentPublicationView } from "@tikdd/admin-contracts";
import { canPublishSnapshot, publicationGuidance, publicationStepLabel } from "../lib/publication-ui-model";

const publication = {
  deployment: "tikdd",
  blockers: [],
  propagationState: "idle",
  diff: [{ targetId: "page_home/en" }]
} as unknown as AdminContentPublicationView;

describe("publication UI state model", () => {
  it("keeps the publish action disabled outside full mode and explains why", () => {
    expect(canPublishSnapshot({ writeMode: "content-draft", publication, confirmation: "tikdd" })).toBe(false);
    expect(publicationGuidance({ writeMode: "content-draft", publication, confirmation: "tikdd" })).toContain("full");
  });

  it("requires the deployment confirmation and reports each propagation state", () => {
    expect(canPublishSnapshot({ writeMode: "full", publication, confirmation: "wrong" })).toBe(false);
    expect(publicationGuidance({ writeMode: "full", publication, confirmation: "wrong" })).toContain("tikdd");
    expect(canPublishSnapshot({ writeMode: "full", publication, confirmation: "tikdd" })).toBe(true);
    const propagating = { ...publication, propagationState: "propagating" } as AdminContentPublicationView;
    expect(canPublishSnapshot({ writeMode: "full", publication: propagating, confirmation: "tikdd" })).toBe(false);
    expect(publicationGuidance({ writeMode: "full", publication: propagating, confirmation: "tikdd" })).toContain("传播");
    expect(publicationStepLabel("idle")).toBe("尚未发布");
    expect(publicationStepLabel("propagating")).toBe("传播中");
    expect(publicationStepLabel("propagated")).toBe("已确认");
    expect(publicationStepLabel("propagation_failed")).toBe("确认失败");
  });

  it("blocks duplicate publication after a propagated snapshot has no diff", () => {
    const published = { ...publication, propagationState: "propagated", diff: [] } as AdminContentPublicationView;
    expect(canPublishSnapshot({ writeMode: "full", publication: published, confirmation: "tikdd" })).toBe(false);
    expect(publicationGuidance({ writeMode: "full", publication: published, confirmation: "tikdd" })).toContain("没有待发布差异");
  });
});
