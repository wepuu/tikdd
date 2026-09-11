import {
  AdminSharedContentSchema,
  type AdminSharedContent
} from "./content-management";
import {
  AdminPageContentSchema,
  AdminSeoFieldsSchema,
  type AdminPageContent,
  type AdminSeoFields
} from "./editorial";

/**
 * The first public content set is deliberately code-owned. It is the reviewed fallback for Web
 * and the only content that the Admin bootstrap action may create. Editorial changes still go
 * through the normal structured-draft and immutable-publication pipeline.
 */
export const STARTER_LOCALES = ["en", "zh-CN"] as const;
export type StarterLocale = (typeof STARTER_LOCALES)[number];

export interface StarterPageRecord {
  pageId: string;
  locale: StarterLocale;
  pageType: "homepage" | "platform" | "guide" | "faq" | "legal";
  platform: string | null;
  content: AdminPageContent;
  seo: AdminSeoFields;
}

const shared = (locale: StarterLocale): AdminSharedContent => AdminSharedContentSchema.parse(
  locale === "en"
    ? {
        siteName: "TikDD",
        navigationLabel: "Home",
        footerTagline: "Clear formats. Controlled delivery.",
        legalNoticeMarkdown: "TikDD is an independent tool and is not affiliated with X or Instagram.",
        defaultSocialTitle: "TikDD X and Instagram video downloader Beta",
        defaultSocialDescription: "Resolve public X and Instagram posts with TikDD.",
        defaultSocialImageAssetId: null,
        siteIntegrations: { googleAnalyticsMeasurementId: null, googleAdsensePublisherId: null }
      }
    : {
        siteName: "TikDD",
        navigationLabel: "首页",
        footerTagline: "格式清晰，受控交付。",
        legalNoticeMarkdown: "TikDD 是独立工具，与 X 或 Instagram 不存在隶属关系。",
        defaultSocialTitle: "TikDD X 与 Instagram 视频下载 Beta",
        defaultSocialDescription: "使用 TikDD 解析公开的 X 与 Instagram 帖子。",
        defaultSocialImageAssetId: null,
        siteIntegrations: { googleAnalyticsMeasurementId: null, googleAdsensePublisherId: null }
      }
);

const homepageContent = (locale: StarterLocale): AdminPageContent => AdminPageContentSchema.parse(
  locale === "en"
    ? {
        template: "homepage",
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
          { question: "Which links can I use?", answerMarkdown: "The current Beta accepts public X posts, Instagram Reels, and Instagram posts." },
          { question: "Do I need an account?", answerMarkdown: "No. TikDD does not request your account, cookies, or access to private content." },
          { question: "Why can a recognized link fail?", answerMarkdown: "Private, paid, restricted, or recently changed pages may not resolve." }
        ]
      }
    : {
        template: "homepage",
        heroTitle: "下载 X 与 Instagram 的公开视频",
        heroSubtitle: "粘贴公开的 X 帖子、Instagram Reel 或帖子链接。TikDD 会解析可用格式并生成短期下载链接。",
        inputLabel: "公开视频页面链接",
        inputPlaceholder: "粘贴 x.com、twitter.com 或 instagram.com 链接",
        primaryActionLabel: "解析",
        supportedPlatformsTitle: "X 与 Instagram 公开 Beta",
        howItWorksTitle: "使用方式",
        howItWorksSteps: [
          { title: "粘贴链接", description: "将公开的视频页面链接粘贴到上方输入框。" },
          { title: "解析视频", description: "TikDD 识别平台并检查可用格式。" },
          { title: "选择格式", description: "选择格式并申请短期有效的下载链接。" }
        ],
        faqTitle: "常见问题",
        faqItems: [
          { question: "可以使用哪些链接？", answerMarkdown: "当前 Beta 接受公开的 X 帖子、Instagram Reel 和帖子链接。" },
          { question: "需要创建账号吗？", answerMarkdown: "不需要。TikDD 不会索取你的账号、Cookie，也不会访问私密内容。" },
          { question: "为什么识别后的链接仍可能失败？", answerMarkdown: "私密、付费、受限或近期结构变化的页面可能无法解析。" }
        ]
      }
);

const platformContent = (locale: StarterLocale, platform: "x" | "instagram"): AdminPageContent => {
  const name = platform === "x" ? "X" : "Instagram";
  if (locale === "en") {
    return AdminPageContentSchema.parse({
      template: "platform",
      eyebrow: `${name} Beta`,
      title: `${name} video downloader Beta`,
      introduction: platform === "x"
        ? "Paste a public X post link. TikDD checks the available formats and hands a short-lived download link to your browser."
        : "Paste a public Instagram Reel or post link. TikDD resolves the available formats and creates a short-lived download link.",
      limitationsMarkdown: "Public links only. Private, paid, restricted, deleted, or recently changed posts may not resolve.",
      howToSteps: [
        { title: `Paste a ${name} link`, description: "Copy a public video page link into the resolver." },
        { title: "Resolve the video", description: "TikDD checks the public page and lists the formats available for delivery." },
        { title: "Choose a format", description: "Select an MP4 option and request a short-lived browser download link." }
      ],
      faqItems: [
        { question: `Which ${name} links are supported?`, answerMarkdown: `The current Beta accepts public ${name} video page links.` },
        { question: `Do I need a ${name} account?`, answerMarkdown: "No. TikDD does not request your account, cookies, or session information." },
        { question: "Why might a recognized link fail?", answerMarkdown: "The upstream post may be private, restricted, removed, or temporarily unavailable." }
      ],
      geo: {
        directAnswer: platform === "x"
          ? "TikDD's X Beta accepts public X post links and can return a short-lived MP4 download link when the public post is accessible."
          : "TikDD's Instagram Beta accepts public Reel and post links and can return a short-lived MP4 download link when the upstream page is accessible.",
        reviewStatus: "draft",
        reviewedAt: null,
        sourceRefs: ["tikdd-workflow", platform === "x" ? "x-public-content" : "instagram-public-content"]
      }
    });
  }
  return AdminPageContentSchema.parse({
    template: "platform",
    eyebrow: `${name} Beta`,
    title: `${name} 视频下载 Beta`,
    introduction: platform === "x"
      ? "粘贴公开的 X 帖子链接。TikDD 会检查可用格式，并将短期下载链接交给浏览器。"
      : "粘贴公开的 Instagram Reel 或帖子链接。TikDD 会解析可用格式并生成短期下载链接。",
    limitationsMarkdown: "仅支持公开链接。私密、付费、受限、已删除或近期结构变化的帖子可能无法解析。",
    howToSteps: [
      { title: `粘贴 ${name} 链接`, description: "将公开的视频页面链接粘贴到解析器。" },
      { title: "解析视频", description: "TikDD 检查公开页面并列出可交付的格式。" },
      { title: "选择格式", description: "选择 MP4 格式并申请短期有效的浏览器下载链接。" }
    ],
    faqItems: [
      { question: `支持哪些 ${name} 链接？`, answerMarkdown: `当前 Beta 支持公开的 ${name} 视频页面链接。` },
      { question: `需要 ${name} 账号吗？`, answerMarkdown: "不需要。TikDD 不会要求你的账号、Cookie 或会话信息。" },
      { question: "为什么识别后仍可能失败？", answerMarkdown: "上游帖子可能私密、受限、已删除或暂时无法访问。" }
    ],
    geo: {
      directAnswer: platform === "x"
        ? "TikDD X Beta 支持公开的 X 帖子链接；当公开帖子可访问时，可返回短期有效的 MP4 下载链接。"
        : "TikDD Instagram Beta 支持公开的 Reel 和帖子链接；当上游页面可访问时，可返回短期有效的 MP4 下载链接。",
      reviewStatus: "draft",
      reviewedAt: null,
      sourceRefs: ["tikdd-workflow", platform === "x" ? "x-public-content" : "instagram-public-content"]
    }
  });
};

const faqContent = (locale: StarterLocale): AdminPageContent => AdminPageContentSchema.parse(
  locale === "en"
    ? {
        template: "faq",
        title: "Frequently asked questions",
        introduction: "A short guide to TikDD's public X and Instagram Beta workflow.",
        items: [
          { question: "What does TikDD support?", answerMarkdown: "The first public Beta accepts public X posts and public Instagram Reels or posts." },
          { question: "Does TikDD store my video?", answerMarkdown: "TikDD keeps only the short-lived task and delivery state needed to complete a request. Your browser receives the media from the approved delivery host." },
          { question: "Why did a request fail?", answerMarkdown: "Upstream availability, privacy settings, rate limits, or a changed page can prevent a result. Try again later or use another public post." }
        ]
      }
    : {
        template: "faq",
        title: "常见问题",
        introduction: "这里介绍 TikDD 公开 X 与 Instagram Beta 的使用方式。",
        items: [
          { question: "TikDD 支持什么？", answerMarkdown: "首个公开 Beta 接受公开的 X 帖子，以及公开的 Instagram Reel 或帖子。" },
          { question: "TikDD 会保存我的视频吗？", answerMarkdown: "TikDD 只保留完成请求所需的短期任务与交付状态，浏览器会从受审交付主机接收媒体。" },
          { question: "为什么请求会失败？", answerMarkdown: "上游可用性、隐私设置、频率限制或页面结构变化都可能导致失败。可以稍后重试或更换公开帖子。" }
        ]
      }
);

const guideContent = (locale: StarterLocale): AdminPageContent => AdminPageContentSchema.parse(
  locale === "en"
    ? {
        template: "guide",
        title: "How to use TikDD",
        introduction: "Resolve a public video page in three bounded steps.",
        sections: [
          { id: "paste", heading: "1. Paste a public link", bodyMarkdown: "Copy a public X post, Instagram Reel, or Instagram post link into the home page." },
          { id: "choose", heading: "2. Choose a format", bodyMarkdown: "Review the formats returned by the resolver and select an available MP4 option." },
          { id: "download", heading: "3. Download in your browser", bodyMarkdown: "Request the short-lived delivery link. Your browser is sent to the approved media host for the file transfer." }
        ]
      }
    : {
        template: "guide",
        title: "如何使用 TikDD",
        introduction: "用三个受控步骤解析公开的视频页面。",
        sections: [
          { id: "paste", heading: "1. 粘贴公开链接", bodyMarkdown: "将公开的 X 帖子、Instagram Reel 或帖子链接复制到首页。" },
          { id: "choose", heading: "2. 选择格式", bodyMarkdown: "查看解析器返回的格式，并选择可用的 MP4 选项。" },
          { id: "download", heading: "3. 在浏览器中下载", bodyMarkdown: "申请短期有效的交付链接。浏览器会前往受审媒体主机完成文件传输。" }
        ]
      }
);

const legalContent = (locale: StarterLocale, kind: "privacy" | "terms"): AdminPageContent => AdminPageContentSchema.parse(
  locale === "en"
    ? {
        template: "legal",
        title: kind === "privacy" ? "Privacy" : "Terms of use",
        summary: kind === "privacy"
          ? "TikDD is a small, independent tool for resolving public media pages. It does not request account credentials or private content."
          : "Use TikDD only with content you are allowed to access and download. Platform terms, copyright rules, and local law continue to apply.",
        sections: kind === "privacy"
          ? [
              { id: "data", heading: "Data boundary", bodyMarkdown: "Submitted links are processed to resolve the requested public page. Short-lived task and delivery records are retained only for operational completion and expiry." },
              { id: "third-party", heading: "Third-party hosts", bodyMarkdown: "A successful download may be served by an approved media host. TikDD does not control that host's independent policies." }
            ]
          : [
              { id: "acceptable-use", heading: "Acceptable use", bodyMarkdown: "Do not use TikDD to bypass private access, paywalls, DRM, or a platform restriction. Respect the rights of creators and platform rules." },
              { id: "availability", heading: "Availability", bodyMarkdown: "The Beta is provided as-is. A public link can still fail when an upstream page is unavailable, restricted, or changed." }
            ]
      }
    : {
        template: "legal",
        title: kind === "privacy" ? "隐私说明" : "使用条款",
        summary: kind === "privacy"
          ? "TikDD 是用于解析公开媒体页面的小型独立工具，不会索取账号凭据或访问私密内容。"
          : "请仅使用你有权访问和下载的内容。平台条款、版权规则及当地法律仍然适用。",
        sections: kind === "privacy"
          ? [
              { id: "data", heading: "数据边界", bodyMarkdown: "提交的链接仅用于解析请求的公开页面。短期任务和交付记录只为完成请求及到期清理而保留。" },
              { id: "third-party", heading: "第三方主机", bodyMarkdown: "成功下载可能由受审媒体主机提供。TikDD 不控制该主机的独立政策。" }
            ]
          : [
              { id: "acceptable-use", heading: "合理使用", bodyMarkdown: "不得使用 TikDD 绕过私密访问、付费墙、DRM 或平台限制，请尊重创作者权益和平台规则。" },
              { id: "availability", heading: "服务可用性", bodyMarkdown: "Beta 按现状提供。即使链接公开，上游页面不可用、受限或发生变化时仍可能失败。" }
            ]
      }
);

const seo = (locale: StarterLocale, page: "home" | "x" | "instagram" | "faq" | "help" | "privacy" | "terms"): AdminSeoFields => {
  const labels = locale === "en"
    ? { home: "TikDD X and Instagram video downloader Beta", x: "TikDD X video downloader Beta", instagram: "TikDD Instagram video downloader Beta", faq: "TikDD frequently asked questions", help: "How to use TikDD", privacy: "TikDD privacy", terms: "TikDD terms of use" }
    : { home: "TikDD X 与 Instagram 视频下载 Beta", x: "TikDD X 视频下载 Beta", instagram: "TikDD Instagram 视频下载 Beta", faq: "TikDD 常见问题", help: "如何使用 TikDD", privacy: "TikDD 隐私说明", terms: "TikDD 使用条款" };
  const paths = { home: "/", x: "/x-downloader", instagram: "/instagram-downloader", faq: "/faq", help: "/help", privacy: "/privacy", terms: "/terms" } as const;
  const title = labels[page];
  return AdminSeoFieldsSchema.parse({
    localPath: paths[page],
    searchTitle: title,
    searchDescription: locale === "en"
      ? page === "home"
        ? "Resolve public X and Instagram videos through TikDD's reviewed download workflow and choose an available format."
        : `Read the reviewed TikDD ${page} content and usage guidance, including the public Beta boundaries and steps.`
      : page === "home"
        ? "使用 TikDD 解析公开的 X 与 Instagram 视频，阅读结构化说明并选择可用格式。"
        : `阅读 TikDD ${title}的结构化说明与使用指引，了解公开 Beta 的边界、步骤和注意事项。`,
    socialTitle: page === "home" ? title : null,
    socialDescription: page === "home" ? (locale === "en" ? "Resolve public X and Instagram posts with TikDD." : "使用 TikDD 解析公开的 X 与 Instagram 帖子。") : null,
    socialImageAssetId: null,
    indexable: page === "home",
    includeInSitemap: page === "home",
    redirectFrom: []
  });
};

export function starterPages(locale: StarterLocale): readonly StarterPageRecord[] {
  return [
    { pageId: "page_home", locale, pageType: "homepage", platform: null, content: homepageContent(locale), seo: seo(locale, "home") },
    { pageId: "page_faq", locale, pageType: "faq", platform: null, content: faqContent(locale), seo: seo(locale, "faq") },
    { pageId: "page_help", locale, pageType: "guide", platform: null, content: guideContent(locale), seo: seo(locale, "help") },
    { pageId: "page_privacy", locale, pageType: "legal", platform: null, content: legalContent(locale, "privacy"), seo: seo(locale, "privacy") },
    { pageId: "page_terms", locale, pageType: "legal", platform: null, content: legalContent(locale, "terms"), seo: seo(locale, "terms") },
    { pageId: "page_x", locale, pageType: "platform", platform: "x", content: platformContent(locale, "x"), seo: seo(locale, "x") },
    { pageId: "page_instagram", locale, pageType: "platform", platform: "instagram", content: platformContent(locale, "instagram"), seo: seo(locale, "instagram") }
  ];
}

export function starterSharedContent(locale: StarterLocale): AdminSharedContent {
  return shared(locale);
}

export function starterPageRecords(): readonly StarterPageRecord[] {
  return STARTER_LOCALES.flatMap((locale) => starterPages(locale));
}

export function starterSharedRecords(): readonly { locale: StarterLocale; content: AdminSharedContent }[] {
  return STARTER_LOCALES.map((locale) => ({ locale, content: starterSharedContent(locale) }));
}
