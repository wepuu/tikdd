import type { AdminPageContent, AdminSeoFields, GeoContent } from "@tikdd/admin-contracts";

export type EditorStep = { title: string; description: string };
export type EditorFaqItem = { question: string; answerMarkdown: string };
export type EditorSection = { id: string; heading: string; bodyMarkdown: string };

export type PageEditorFields = {
  inputLabel: string;
  inputPlaceholder: string;
  primaryActionLabel: string;
  supportedPlatformsTitle: string;
  howItWorksTitle: string;
  howItWorksSteps: EditorStep[];
  faqTitle: string;
  faqItems: EditorFaqItem[];
  eyebrow: string;
  limitationsMarkdown: string;
  howToSteps: EditorStep[];
  platformFaqItems: EditorFaqItem[];
  sections: EditorSection[];
};

const defaultStep: EditorStep = { title: "开始", description: "补充这一步的说明。" };
const defaultFaq: EditorFaqItem = { question: "常见问题", answerMarkdown: "补充回答。" };
const defaultSection: EditorSection = { id: "overview", heading: "说明", bodyMarkdown: "补充正文。" };

function cloneSteps(items: readonly EditorStep[]): EditorStep[] {
  return items.map((item) => ({ title: item.title, description: item.description }));
}

function cloneFaq(items: readonly EditorFaqItem[]): EditorFaqItem[] {
  return items.map((item) => ({ question: item.question, answerMarkdown: item.answerMarkdown }));
}

function cloneSections(items: readonly EditorSection[]): EditorSection[] {
  return items.map((item) => ({ id: item.id, heading: item.heading, bodyMarkdown: item.bodyMarkdown }));
}

export function emptyPageEditorFields(): PageEditorFields {
  return {
    inputLabel: "视频页面链接",
    inputPlaceholder: "粘贴公开视频页面链接",
    primaryActionLabel: "解析视频",
    supportedPlatformsTitle: "支持的平台",
    howItWorksTitle: "如何使用",
    howItWorksSteps: [{ ...defaultStep }, { title: "选择格式", description: "返回可用的下载候选。" }],
    faqTitle: "常见问题",
    faqItems: [{ ...defaultFaq }],
    eyebrow: "SUPPORTED PLATFORM",
    limitationsMarkdown: "仅支持公开且允许访问的内容。",
    howToSteps: [{ title: "复制链接", description: "从平台复制公开视频页面地址。" }, { title: "开始解析", description: "返回可用的下载候选。" }],
    platformFaqItems: [],
    sections: [{ ...defaultSection }]
  };
}

export function editorFieldsFromContent(content: AdminPageContent | undefined): PageEditorFields {
  const fields = emptyPageEditorFields();
  if (!content) return fields;
  switch (content.template) {
    case "homepage":
      return {
        ...fields,
        inputLabel: content.inputLabel,
        inputPlaceholder: content.inputPlaceholder,
        primaryActionLabel: content.primaryActionLabel,
        supportedPlatformsTitle: content.supportedPlatformsTitle,
        howItWorksTitle: content.howItWorksTitle,
        howItWorksSteps: cloneSteps(content.howItWorksSteps),
        faqTitle: content.faqTitle,
        faqItems: cloneFaq(content.faqItems)
      };
    case "platform":
      return {
        ...fields,
        eyebrow: content.eyebrow,
        limitationsMarkdown: content.limitationsMarkdown,
        howToSteps: cloneSteps(content.howToSteps),
        platformFaqItems: cloneFaq(content.faqItems)
      };
    case "guide":
      return { ...fields, sections: cloneSections(content.sections) };
    case "faq":
      return { ...fields, faqItems: cloneFaq(content.items) };
    case "legal":
      return { ...fields, sections: cloneSections(content.sections) };
  }
}

export function mergePageContent(
  existing: AdminPageContent | undefined,
  updates: { title: string; summary: string; geo: GeoContent | null; fields: PageEditorFields; template: AdminPageContent["template"] }
): AdminPageContent {
  const { title, summary, geo, fields } = updates;
  if (existing) {
    switch (existing.template) {
      case "homepage":
        return { ...existing, heroTitle: title, heroSubtitle: summary, inputLabel: fields.inputLabel, inputPlaceholder: fields.inputPlaceholder, primaryActionLabel: fields.primaryActionLabel, supportedPlatformsTitle: fields.supportedPlatformsTitle, howItWorksTitle: fields.howItWorksTitle, howItWorksSteps: cloneSteps(fields.howItWorksSteps), faqTitle: fields.faqTitle, faqItems: cloneFaq(fields.faqItems) };
      case "platform":
        return { ...existing, title, introduction: summary, eyebrow: fields.eyebrow, limitationsMarkdown: fields.limitationsMarkdown, howToSteps: cloneSteps(fields.howToSteps), faqItems: cloneFaq(fields.platformFaqItems), geo };
      case "guide":
        return { ...existing, title, introduction: summary, sections: cloneSections(fields.sections) };
      case "faq":
        return { ...existing, title, introduction: summary, items: cloneFaq(fields.faqItems) };
      case "legal":
        return { ...existing, title, summary, sections: cloneSections(fields.sections) };
    }
  }
  switch (updates.template) {
    case "homepage":
      return { template: "homepage", heroTitle: title, heroSubtitle: summary, inputLabel: fields.inputLabel, inputPlaceholder: fields.inputPlaceholder, primaryActionLabel: fields.primaryActionLabel, supportedPlatformsTitle: fields.supportedPlatformsTitle, howItWorksTitle: fields.howItWorksTitle, howItWorksSteps: cloneSteps(fields.howItWorksSteps), faqTitle: fields.faqTitle, faqItems: cloneFaq(fields.faqItems) };
    case "platform":
      return { template: "platform", eyebrow: fields.eyebrow, title, introduction: summary, limitationsMarkdown: fields.limitationsMarkdown, howToSteps: cloneSteps(fields.howToSteps), faqItems: cloneFaq(fields.platformFaqItems), geo };
    case "guide":
      return { template: "guide", title, introduction: summary, sections: cloneSections(fields.sections) };
    case "faq":
      return { template: "faq", title, introduction: summary, items: cloneFaq(fields.faqItems.length ? fields.faqItems : [defaultFaq]) };
    case "legal":
      return { template: "legal", title, summary, sections: cloneSections(fields.sections.length ? fields.sections : [defaultSection]) };
  }
}

export function preserveOrCreateSeo(existing: AdminSeoFields | undefined, fallback: AdminSeoFields): AdminSeoFields {
  return existing ? { ...existing, redirectFrom: [...existing.redirectFrom] } : fallback;
}
