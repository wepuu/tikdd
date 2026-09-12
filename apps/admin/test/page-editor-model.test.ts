import { describe, expect, it } from "vitest";
import { starterPages, type AdminPageContent, type AdminSeoFields } from "@tikdd/admin-contracts";
import { editorFieldsFromContent, emptyPageEditorFields, mergePageContent, preserveOrCreateSeo, starterPageFor } from "../lib/page-editor-model";

const fields = emptyPageEditorFields();
const updates = { template: "guide" as const, title: "新标题", summary: "新的摘要内容", geo: null, fields };

describe("page editor model", () => {
  it("preserves homepage structured fields while applying the edited heading", () => {
    const existing: AdminPageContent = { template: "homepage", heroTitle: "旧标题", heroSubtitle: "旧摘要", inputLabel: "自定义标签", inputPlaceholder: "自定义占位", primaryActionLabel: "开始", supportedPlatformsTitle: "平台", howItWorksTitle: "步骤", howItWorksSteps: [{ title: "第一步", description: "详细说明" }, { title: "第二步", description: "另一说明" }], faqTitle: "帮助", faqItems: [{ question: "问题", answerMarkdown: "回答" }] };
    const editor = editorFieldsFromContent(existing);
    const result = mergePageContent(existing, { ...updates, template: "homepage", title: "新标题", summary: "新的摘要内容", fields: editor });
    expect(result).toEqual({ ...existing, heroTitle: "新标题", heroSubtitle: "新的摘要内容" });
  });

  it("preserves platform limitations, steps, FAQ and GEO when only the title changes", () => {
    const existing: AdminPageContent = { template: "platform", eyebrow: "X BETA", title: "旧标题", introduction: "旧摘要", limitationsMarkdown: "限制", howToSteps: [{ title: "解析", description: "说明" }, { title: "下载", description: "说明" }], faqItems: [{ question: "问题", answerMarkdown: "回答" }], geo: null };
    const editor = editorFieldsFromContent(existing);
    const result = mergePageContent(existing, { ...updates, template: "platform", title: "新标题", summary: "新的摘要内容", fields: editor, geo: null });
    expect(result).toEqual({ ...existing, title: "新标题", introduction: "新的摘要内容" });
  });

  it("applies nested edits without dropping sibling entries", () => {
    const existing: AdminPageContent = { template: "faq", title: "旧标题", introduction: "旧摘要", items: [{ question: "保留的问题", answerMarkdown: "保留的回答" }, { question: "另一个问题", answerMarkdown: "另一个回答" }] };
    const editor = editorFieldsFromContent(existing);
    editor.faqItems[0] = { ...editor.faqItems[0]!, answerMarkdown: "更新后的回答" };
    const result = mergePageContent(existing, { ...updates, template: "faq", fields: editor });
    expect(result).toEqual({ ...existing, title: "新标题", introduction: "新的摘要内容", items: [{ question: "保留的问题", answerMarkdown: "更新后的回答" }, existing.items[1]] });
  });

  it("updates only the common fields for guide, FAQ and legal templates", () => {
    const guide: AdminPageContent = { template: "guide", title: "旧", introduction: "旧摘要", sections: [{ id: "start", heading: "开始", bodyMarkdown: "正文" }] };
    const faq: AdminPageContent = { template: "faq", title: "旧", introduction: "旧摘要", items: [{ question: "问题", answerMarkdown: "回答" }] };
    const legal: AdminPageContent = { template: "legal", title: "旧", summary: "旧摘要", sections: [{ id: "terms", heading: "条款", bodyMarkdown: "正文" }] };
    expect(mergePageContent(guide, { ...updates, template: "guide", fields: editorFieldsFromContent(guide) })).toEqual({ ...guide, title: "新标题", introduction: "新的摘要内容" });
    expect(mergePageContent(faq, { ...updates, template: "faq", fields: editorFieldsFromContent(faq) })).toEqual({ ...faq, title: "新标题", introduction: "新的摘要内容" });
    expect(mergePageContent(legal, { ...updates, template: "legal", fields: editorFieldsFromContent(legal) })).toEqual({ ...legal, title: "新标题", summary: "新的摘要内容" });
  });

  it("preserves SEO and copies redirect arrays instead of resetting noindex policy", () => {
    const existing: AdminSeoFields = { localPath: "/x", searchTitle: "A valid search title", searchDescription: "A sufficiently long search description that remains valid for the editorial contract.", socialTitle: "Social", socialDescription: "Description", socialImageAssetId: null, indexable: false, includeInSitemap: false, redirectFrom: ["/old-x"] };
    const result = preserveOrCreateSeo(existing, { ...existing, redirectFrom: [] });
    expect(result).toEqual(existing);
    expect(result.redirectFrom).not.toBe(existing.redirectFrom);
  });

  it("provides the exact code-owned starter path for a missing TikTok page", () => {
    const starter = starterPageFor("page_tiktok", "en");
    expect(starter).toEqual(starterPages("en").find((page) => page.pageId === "page_tiktok"));
    expect(starter?.seo).toMatchObject({ localPath: "/tiktok-downloader", indexable: true, includeInSitemap: true });

    const fields = editorFieldsFromContent(starter?.content);
    const content = mergePageContent(undefined, {
      template: "platform",
      title: starter?.content.template === "platform" ? starter.content.title : "",
      summary: starter?.content.template === "platform" ? starter.content.introduction : "",
      geo: starter?.content.template === "platform" ? starter.content.geo : null,
      fields
    });
    expect(content).toEqual(starter?.content);
    expect(preserveOrCreateSeo(undefined, starter!.seo)).toEqual(starter!.seo);
  });
});
