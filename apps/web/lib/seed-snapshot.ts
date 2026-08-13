import { PublishedContentSnapshotSchema, type PublishedContentSnapshot } from "@tikdd/admin-contracts";

const homepage = (locale: "en" | "zh-CN") => locale === "en" ? {
  template: "homepage" as const,
  heroTitle: "Download videos from public links",
  heroSubtitle: "Paste a public video page from YouTube, TikTok, X, or another recognized site. TikDD resolves clear format choices without exposing provider links.",
  inputLabel: "Public video page URL",
  inputPlaceholder: "Paste a YouTube, TikTok, X, or other public video URL",
  primaryActionLabel: "Resolve",
  supportedPlatformsTitle: "Supported platforms",
  howItWorksTitle: "How it works",
  howItWorksSteps: [
    { title: "Paste URL", description: "Copy a public video page link into the field above." },
    { title: "Resolve video", description: "TikDD identifies the platform and checks available formats." },
    { title: "Choose a format", description: "Select a format and request a short-lived delivery link." }
  ],
  faqTitle: "Frequently asked questions",
  faqItems: [
    { question: "Which links can I use?", answerMarkdown: "Use public media pages you own or have permission to download." },
    { question: "Do I need an account?", answerMarkdown: "No account is required for the current resolver flow." },
    { question: "Why can a recognized link fail?", answerMarkdown: "Private, paid, restricted, or recently changed pages may not resolve." }
  ]
} : {
  template: "homepage" as const,
  heroTitle: "从公开链接下载视频",
  heroSubtitle: "粘贴 YouTube、TikTok、X 或其他已识别网站的公开视频页面。TikDD 会解析清晰的格式选项，同时不暴露第三方直链。",
  inputLabel: "公开视频页面链接",
  inputPlaceholder: "粘贴 YouTube、TikTok、X 或其他公开视频链接",
  primaryActionLabel: "解析",
  supportedPlatformsTitle: "支持的平台",
  howItWorksTitle: "工作方式",
  howItWorksSteps: [
    { title: "粘贴链接", description: "将你有权使用的公开视频页面链接粘贴到输入框。" },
    { title: "解析视频", description: "TikDD 识别平台并检查可用格式。" },
    { title: "选择格式", description: "选择格式并申请一个短期有效的下载链接。" }
  ],
  faqTitle: "常见问题",
  faqItems: [
    { question: "可以使用哪些链接？", answerMarkdown: "仅使用你拥有或已获得下载授权的公开媒体页面。" },
    { question: "需要创建账号吗？", answerMarkdown: "当前解析流程不需要账号。" },
    { question: "为什么已识别的链接仍可能失败？", answerMarkdown: "私密、付费、受限或页面结构近期变化的内容可能无法解析。" }
  ]
};

const seo = (locale: "en" | "zh-CN") => ({
  localPath: "/",
  searchTitle: locale === "en" ? "TikDD public video downloader" : "TikDD 公共视频下载工具",
  searchDescription: locale === "en"
    ? "Resolve supported public video pages and choose an available format through TikDD's multilingual download workflow."
    : "使用 TikDD 多语言下载流程解析支持的公开视频页面，查看清晰的媒体信息，并选择当前可用的视频格式。",
  socialTitle: locale === "en" ? "TikDD public video downloader" : "TikDD 公共视频下载工具",
  socialDescription: locale === "en" ? "Resolve supported public pages with TikDD." : "使用 TikDD 解析支持的公开视频页面。",
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
    { locale: "en", siteName:"TikDD", navigationLabel: "Home", footerTagline: "Clear formats. Controlled delivery.", legalNoticeMarkdown: "Download only content you own or are authorized to use.",defaultSocialTitle:"TikDD public video downloader",defaultSocialDescription:"Resolve supported public pages with TikDD.",defaultSocialImageAssetId:null },
    { locale: "zh-CN", siteName:"TikDD", navigationLabel: "首页", footerTagline: "格式清晰，交付受控。", legalNoticeMarkdown: "仅下载你拥有或已获授权使用的内容。",defaultSocialTitle:"TikDD 公共视频下载工具",defaultSocialDescription:"使用 TikDD 解析支持的公开视频页面。",defaultSocialImageAssetId:null }
  ],
  generatedAt: "2026-08-12T00:00:00.000Z"
});
