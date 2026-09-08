import { PublishedContentSnapshotSchema, type PublishedContentSnapshot } from "@tikdd/admin-contracts";

const homepage = (locale: "en" | "zh-CN") => locale === "en" ? {
  template: "homepage" as const,
  heroTitle: "Download public videos from X and Instagram",
  heroSubtitle: "Paste a public X post, Instagram Reel, or Instagram post URL. TikDD resolves clear format choices and creates a short-lived download link.",
  inputLabel: "Public video page URL",
  inputPlaceholder: "Paste an x.com, twitter.com, or instagram.com URL",
  primaryActionLabel: "Resolve",
  supportedPlatformsTitle: "X & Instagram Public Beta",
  howItWorksTitle: "How it works",
  howItWorksSteps: [
    { title: "Paste URL", description: "Copy a public video page link into the field above." },
    { title: "Resolve video", description: "TikDD identifies the platform and checks available formats." },
    { title: "Choose a format", description: "Select a format and request a short-lived delivery link." }
  ],
  faqTitle: "Frequently asked questions",
  faqItems: [
    { question: "Which links can I use?", answerMarkdown: "The current Beta accepts public x.com and twitter.com posts, plus public Instagram Reels and posts." },
    { question: "Do I need an account?", answerMarkdown: "No. TikDD does not request your account, cookies, session ID, or access to private content." },
    { question: "Why can a recognized link fail?", answerMarkdown: "Private, paid, restricted, or recently changed pages may not resolve." }
  ]
} : {
  template: "homepage" as const,
  heroTitle: "从 X 与 Instagram 下载公开视频",
  heroSubtitle: "粘贴公开的 X 帖子、Instagram Reel 或帖子链接，TikDD 会解析清晰的格式选项并生成短期下载链接。",
  inputLabel: "公开视频页面链接",
  inputPlaceholder: "粘贴 x.com、twitter.com 或 instagram.com 链接",
  primaryActionLabel: "解析",
  supportedPlatformsTitle: "X 与 Instagram 公开测试版",
  howItWorksTitle: "工作方式",
  howItWorksSteps: [
    { title: "粘贴链接", description: "将公开的 X 帖子链接粘贴到输入框。" },
    { title: "解析视频", description: "TikDD 识别平台并检查可用格式。" },
    { title: "选择格式", description: "选择格式并申请一个短期有效的下载链接。" }
  ],
  faqTitle: "常见问题",
  faqItems: [
    { question: "可以使用哪些链接？", answerMarkdown: "当前测试版接受公开的 x.com、twitter.com 帖子，以及公开的 Instagram Reel 和帖子链接。" },
    { question: "需要创建账号吗？", answerMarkdown: "不需要。TikDD 不会索取你的账号、Cookie、sessionid，也不会访问私密内容。" },
    { question: "为什么已识别的链接仍可能失败？", answerMarkdown: "私密、付费、受限或页面结构近期变化的内容可能无法解析。" }
  ]
};

const seo = (locale: "en" | "zh-CN") => ({
  localPath: "/",
  searchTitle: locale === "en" ? "TikDD X and Instagram video downloader Beta" : "TikDD X 与 Instagram 视频下载 Beta",
  searchDescription: locale === "en"
    ? "Resolve public X and Instagram posts and choose an available format through TikDD's multilingual download workflow."
    : "使用 TikDD 多语言下载流程解析公开的 X 与 Instagram 帖子，并选择当前可用的视频格式。",
  socialTitle: locale === "en" ? "TikDD X and Instagram video downloader Beta" : "TikDD X 与 Instagram 视频下载 Beta",
  socialDescription: locale === "en" ? "Resolve public X and Instagram posts with TikDD." : "使用 TikDD 解析公开的 X 与 Instagram 帖子。",
  socialImageAssetId: null,
  indexable: true,
  includeInSitemap: true,
  redirectFrom: []
});

const instagramPageContent = (locale: "en" | "zh-CN") => locale === "en" ? {
  template: "platform" as const,
  eyebrow: "Instagram Beta",
  title: "Instagram video downloader Beta",
  introduction: "Paste a public Instagram Reel or post link. TikDD resolves the available formats and creates a short-lived download link.",
  limitationsMarkdown: "Public links only. Private, paid, restricted, or removed posts may not resolve.",
  howToSteps: [
    { title: "Paste an Instagram link", description: "Copy a public Instagram Reel or post link into the resolver." },
    { title: "Resolve the video", description: "TikDD checks the public page and lists the formats available for delivery." },
    { title: "Choose a format", description: "Select an MP4 option and request a short-lived download link." }
  ],
  faqItems: [
    { question: "Which Instagram links are supported?", answerMarkdown: "The current Beta accepts public Instagram Reels and post links." },
    { question: "Do I need an Instagram account?", answerMarkdown: "No. TikDD does not request your account, cookies, or session information." },
    { question: "Why might a recognized link fail?", answerMarkdown: "The upstream post may be private, restricted, removed, or temporarily unavailable." }
  ]
} : {
  template: "platform" as const,
  eyebrow: "Instagram Beta",
  title: "Instagram \u89c6\u9891\u4e0b\u8f7d Beta",
  introduction: "\u7c98\u8d34\u516c\u5f00\u7684 Instagram Reel \u6216\u5e16\u5b50\u94fe\u63a5\u3002TikDD \u4f1a\u89e3\u6790\u53ef\u7528\u683c\u5f0f\u5e76\u751f\u6210\u77ed\u671f\u4e0b\u8f7d\u94fe\u63a5\u3002",
  limitationsMarkdown: "\u4ec5\u652f\u6301\u4f60\u53ef\u516c\u5f00\u8bbf\u95ee\u7684\u5185\u5bb9\u3002\u79c1\u5bc6\u3001\u4ed8\u8d39\u3001\u53d7\u9650\u6216\u5df2\u5220\u9664\u7684\u5e16\u5b50\u53ef\u80fd\u65e0\u6cd5\u89e3\u6790\u3002",
  howToSteps: [
    { title: "\u7c98\u8d34 Instagram \u94fe\u63a5", description: "\u5c06\u516c\u5f00\u7684 Instagram Reel \u6216\u5e16\u5b50\u94fe\u63a5\u7c98\u8d34\u5230\u89e3\u6790\u5668\u3002" },
    { title: "\u89e3\u6790\u89c6\u9891", description: "TikDD \u68c0\u67e5\u516c\u5f00\u9875\u9762\u5e76\u5217\u51fa\u53ef\u4ea4\u4ed8\u7684\u683c\u5f0f\u3002" },
    { title: "\u9009\u62e9\u683c\u5f0f", description: "\u9009\u62e9 MP4 \u683c\u5f0f\u5e76\u7533\u8bf7\u77ed\u671f\u6709\u6548\u7684\u4e0b\u8f7d\u94fe\u63a5\u3002" }
  ],
  faqItems: [
    { question: "\u652f\u6301\u54ea\u4e9b Instagram \u94fe\u63a5\uff1f", answerMarkdown: "\u5f53\u524d Beta \u652f\u6301\u516c\u5f00\u7684 Instagram Reel \u548c\u5e16\u5b50\u94fe\u63a5\u3002" },
    { question: "\u9700\u8981 Instagram \u8d26\u53f7\u5417\uff1f", answerMarkdown: "\u4e0d\u9700\u8981\u3002TikDD \u4e0d\u4f1a\u8981\u6c42\u4f60\u7684\u8d26\u53f7\u3001Cookie \u6216\u4f1a\u8bdd\u4fe1\u606f\u3002" },
    { question: "\u4e3a\u4ec0\u4e48\u8bc6\u522b\u540e\u4ecd\u53ef\u80fd\u5931\u8d25\uff1f", answerMarkdown: "\u4e0a\u6e38\u5e16\u5b50\u53ef\u80fd\u79c1\u5bc6\u3001\u53d7\u9650\u3001\u5df2\u5220\u9664\u6216\u6682\u65f6\u65e0\u6cd5\u8bbf\u95ee\u3002" }
  ]
};

const instagramSeo = (locale: "en" | "zh-CN") => ({
  localPath: "/instagram-downloader",
  searchTitle: locale === "en" ? "TikDD Instagram video downloader Beta" : "TikDD Instagram \u89c6\u9891\u4e0b\u8f7d Beta",
  searchDescription: locale === "en"
    ? "Resolve public Instagram Reels and posts through TikDD's reviewed Beta download workflow."
    : "\u4f7f\u7528 TikDD \u7684 Beta \u4e0b\u8f7d\u6d41\u7a0b\u89e3\u6790\u516c\u5f00 Instagram Reel \u548c\u5e16\u5b50\u3002",
  socialTitle: null,
  socialDescription: null,
  socialImageAssetId: null,
  indexable: false,
  includeInSitemap: false,
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
  pages: [
    ...(["en", "zh-CN"] as const).map((locale) => ({
      pageId: "page_home",
      locale,
      pageType: "homepage" as const,
      platform: null,
      content: homepage(locale),
      seo: seo(locale)
    })),
    ...(["en", "zh-CN"] as const).map((locale) => ({
      pageId: "page_instagram",
      locale,
      pageType: "platform" as const,
      platform: "instagram",
      content: instagramPageContent(locale),
      seo: instagramSeo(locale)
    }))
  ],
  sharedContent: [
    { locale: "en", siteName:"TikDD", navigationLabel: "Home", footerTagline: "Clear formats. Controlled delivery.", legalNoticeMarkdown: "TikDD is an independent tool and is not affiliated with X or Instagram.",defaultSocialTitle:"TikDD X and Instagram video downloader Beta",defaultSocialDescription:"Resolve public X and Instagram posts with TikDD.",defaultSocialImageAssetId:null },
    { locale: "zh-CN", siteName:"TikDD", navigationLabel: "首页", footerTagline: "格式清晰，交付受控。", legalNoticeMarkdown: "TikDD 是独立工具，与 X 或 Instagram 不存在隶属关系。",defaultSocialTitle:"TikDD X 与 Instagram 视频下载 Beta",defaultSocialDescription:"使用 TikDD 解析公开的 X 与 Instagram 帖子。",defaultSocialImageAssetId:null }
  ],
  generatedAt: "2026-08-12T00:00:00.000Z"
});
