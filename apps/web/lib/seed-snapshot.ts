import { PublishedContentSnapshotSchema, type PublishedContentSnapshot } from "@tikdd/admin-contracts";

const homepage = (locale: "en" | "zh-CN") => locale === "en" ? {
  template: "homepage" as const,
  heroTitle: "Download X videos from public posts",
  heroSubtitle: "Paste a public X post URL. TikDD resolves clear format choices and creates a short-lived download link.",
  inputLabel: "Public X post URL",
  inputPlaceholder: "Paste an x.com or twitter.com post URL",
  primaryActionLabel: "Resolve",
  supportedPlatformsTitle: "X Public Beta",
  howItWorksTitle: "How it works",
  howItWorksSteps: [
    { title: "Paste URL", description: "Copy a public video page link into the field above." },
    { title: "Resolve video", description: "TikDD identifies the platform and checks available formats." },
    { title: "Choose a format", description: "Select a format and request a short-lived delivery link." }
  ],
  faqTitle: "Frequently asked questions",
  faqItems: [
    { question: "Which links can I use?", answerMarkdown: "The current Beta accepts public x.com and twitter.com post URLs." },
    { question: "Do I need an account?", answerMarkdown: "No account is required for the current resolver flow." },
    { question: "Why can a recognized link fail?", answerMarkdown: "Private, paid, restricted, or recently changed pages may not resolve." }
  ]
} : {
  template: "homepage" as const,
  heroTitle: "从公开帖子下载 X 视频",
  heroSubtitle: "粘贴公开的 X 帖子链接，TikDD 会解析清晰的格式选项并生成短期下载链接。",
  inputLabel: "公开 X 帖子链接",
  inputPlaceholder: "粘贴 x.com 或 twitter.com 帖子链接",
  primaryActionLabel: "解析",
  supportedPlatformsTitle: "X 公开测试版",
  howItWorksTitle: "工作方式",
  howItWorksSteps: [
    { title: "粘贴链接", description: "将公开的 X 帖子链接粘贴到输入框。" },
    { title: "解析视频", description: "TikDD 识别平台并检查可用格式。" },
    { title: "选择格式", description: "选择格式并申请一个短期有效的下载链接。" }
  ],
  faqTitle: "常见问题",
  faqItems: [
    { question: "可以使用哪些链接？", answerMarkdown: "当前测试版接受公开的 x.com 和 twitter.com 帖子链接。" },
    { question: "需要创建账号吗？", answerMarkdown: "当前解析流程不需要账号。" },
    { question: "为什么已识别的链接仍可能失败？", answerMarkdown: "私密、付费、受限或页面结构近期变化的内容可能无法解析。" }
  ]
};

const seo = (locale: "en" | "zh-CN") => ({
  localPath: "/",
  searchTitle: locale === "en" ? "TikDD X video downloader Beta" : "TikDD X 视频下载 Beta",
  searchDescription: locale === "en"
    ? "Resolve public X posts and choose an available format through TikDD's multilingual download workflow."
    : "使用 TikDD 多语言下载流程解析公开的 X 帖子，查看清晰的媒体信息并选择当前可用的视频格式。",
  socialTitle: locale === "en" ? "TikDD X video downloader Beta" : "TikDD X 视频下载 Beta",
  socialDescription: locale === "en" ? "Resolve public X posts with TikDD." : "使用 TikDD 解析公开的 X 帖子。",
  socialImageAssetId: null,
  indexable: true,
  includeInSitemap: true,
  redirectFrom: []
});

export const BUNDLED_PUBLIC_CONTENT_SNAPSHOT: PublishedContentSnapshot = PublishedContentSnapshotSchema.parse({
  schemaVersion: "1",
  snapshotId: "snap_00000000000000000000000000000001",
  deployment: "tikdd",
  revision: 1,
  previousSnapshotId: null,
  contentHash: "0".repeat(64),
  locales: [
    { locale: "en", displayName: "English", direction: "ltr", fallbackLocale: null, isDefault: true },
    { locale: "zh-CN", displayName: "简体中文", direction: "ltr", fallbackLocale: "en", isDefault: false }
  ],
  pages: ["en", "zh-CN"].map((locale) => ({
    pageId: "page_home",
    locale,
    pageType: "homepage",
    platform: null,
    content: homepage(locale as "en" | "zh-CN"),
    seo: seo(locale as "en" | "zh-CN")
  })),
  sharedContent: [
    { locale: "en", siteName:"TikDD", navigationLabel: "Home", footerTagline: "Clear formats. Controlled delivery.", legalNoticeMarkdown: "TikDD is an independent tool and is not affiliated with X.",defaultSocialTitle:"TikDD X video downloader Beta",defaultSocialDescription:"Resolve public X posts with TikDD.",defaultSocialImageAssetId:null },
    { locale: "zh-CN", siteName:"TikDD", navigationLabel: "首页", footerTagline: "格式清晰，交付受控。", legalNoticeMarkdown: "TikDD 是独立工具，与 X 不存在隶属关系。",defaultSocialTitle:"TikDD X 视频下载 Beta",defaultSocialDescription:"使用 TikDD 解析公开的 X 帖子。",defaultSocialImageAssetId:null }
  ],
  generatedAt: "2026-08-12T00:00:00.000Z"
});
