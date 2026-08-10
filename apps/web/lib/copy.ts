export const locales = ["en", "zh-CN"] as const;
export type Locale = (typeof locales)[number];

const copy = {
  en: {
    nav: { home: "Home", features: "Features", process: "How it works", supported: "Supported sites", faq: "FAQ", language: "中文" },
    hero: {
      badge: "One link. Clear format choices.",
      lead: "Download ", accent: "Videos", tail: " from URL",
      description: "Paste a public video page from YouTube, TikTok, X, or another recognized site. TikDD resolves the available choices without exposing provider links."
    },
    form: {
      label: "Public video page URL",
      placeholder: "Paste a YouTube, TikTok, X, or other public video URL",
      rights: "I own this content or have permission to download it.",
      action: "Resolve", working: "Resolving", waiting: "Waiting for a supported public link",
      recognized: "link recognized.", confirmRights: "Confirm your download permission to continue.",
      resolving: "Resolving available formats", ready: "Formats ready",
      invalid: "Paste a recognized public video page link.", clear: "Clear link", result: "Select quality",
      preview: "Preview", example: "Example result", exampleTitle: "Mountain Lake 4K",
      exampleMeta: "Format choices appear after a link is resolved.",
      resolvedTitle: "Resolved media", resolvedPreview: "resolved media preview",
      formatsAvailable: "format choices", workingMeta: "TikDD is checking the available formats.",
      workingLonger: "Still checking available formats. Some supported links take longer; you can keep this page open.",
      columns: { quality: "Quality", format: "Format", video: "Video", audio: "Audio", container: "Container", action: "Action" },
      videoAudio: "Video + audio", videoOnly: "Video only", audioOnly: "Audio only",
      download: "Prepare download", preparingDownload: "Preparing",
      deliveryReady: "Your short-lived download link is ready.", startDownload: "Start download",
      deliveryExpired: "This download link expired or was already used.", regenerateDownload: "Create a new link",
      statusLabel: "Task status",
      resolveError: "This link could not be resolved. Check that it is public and try again.",
      retryableTitle: "Temporarily unavailable", retryableDescription: "TikDD could not finish this request. Try the same link again shortly.",
      unavailableTitle: "Video unavailable", unavailableDescription: "This page may be private, restricted, removed, or unsupported. Use another public link you can access.",
      expiredTitle: "Resolution expired", expiredDescription: "The saved formats are no longer available. Resolve the link again to refresh them.",
      duplicateInProgress: "This link is already being processed. Try again shortly.",
      rateLimited: "Too many requests were submitted. Wait briefly and try again.",
      concurrencyLimited: "Too many resolution tasks are active. Try again shortly.",
      idempotencyConflict: "This request key was already used. Start a new resolution.",
      admissionUnavailable: "New resolution requests are temporarily unavailable. Try again shortly.",
      timeout: "Resolution is taking longer than expected. Try again shortly.",
      deliveryError: "This format is not available for secure delivery. Resolve the link again.",
      expired: "This task expired. Resolve the link again."
    },
    features: [
      ["Broad recognition", "Recognizes public pages across a growing platform catalog."],
      ["Clear formats", "Normalizes quality and media details into one consistent view."],
      ["Controlled delivery", "Uses short-lived delivery links instead of exposing upstream URLs."]
    ],
    supported: { label: "Supports:", platforms: ["YouTube", "TikTok", "X", "More"] },
    process: {
      title: "How it works",
      steps: [
        ["Paste URL", "Copy a public video page link into the field above."],
        ["Resolve video", "TikDD identifies the platform and checks available formats."],
        ["Choose a format", "Select an available format and request a short-lived delivery link."]
      ]
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        ["Which links can I use?", "Use public media pages you own or have permission to download."],
        ["Do I need an account?", "No account is required for the current resolver flow."],
        ["Why can a recognized link fail?", "Private, paid, restricted, or recently changed pages may not resolve."]
      ]
    },
    trust: {
      title: "Designed around safe delivery", labels: "Scoped · Expiring · One use",
      description: "Public results never include provider download URLs or secret headers."
    },
    legal: "TikDD is not affiliated with the platforms listed here. Download only content you own or are authorized to use."
  },
  "zh-CN": {
    nav: { home: "首页", features: "功能", process: "工作方式", supported: "支持网站", faq: "常见问题", language: "English" },
    hero: {
      badge: "一个链接，清晰的格式选择",
      lead: "从链接下载", accent: "视频", tail: "",
      description: "粘贴 YouTube、TikTok、X 或其他已识别网站的公开视频页面。TikDD 解析可用格式，同时不向浏览器暴露第三方直链。"
    },
    form: {
      label: "公开视频页面链接", placeholder: "粘贴 YouTube、TikTok、X 或其他公开视频链接",
      rights: "我拥有该内容，或已获得下载授权。", action: "解析", working: "解析中",
      waiting: "等待支持的公开视频链接", recognized: "链接已识别。", confirmRights: "请确认下载授权后继续。",
      resolving: "正在解析可用格式", ready: "格式已就绪",
      invalid: "请粘贴可识别的公开视频页面链接。", clear: "清除链接", result: "选择清晰度",
      preview: "预览", example: "示例结果", exampleTitle: "山间湖泊 4K", exampleMeta: "链接解析完成后将在这里显示可用格式。",
      resolvedTitle: "已解析媒体", resolvedPreview: "已解析媒体预览",
      formatsAvailable: "种可用格式", workingMeta: "TikDD 正在检查可用格式。",
      workingLonger: "仍在检查可用格式。部分受支持链接需要更长时间，你可以保持本页打开。",
      columns: { quality: "清晰度", format: "格式", video: "视频", audio: "音频", container: "封装", action: "操作" },
      videoAudio: "视频 + 音频", videoOnly: "仅视频", audioOnly: "仅音频",
      download: "准备下载", preparingDownload: "准备中",
      deliveryReady: "短期下载链接已准备好。", startDownload: "开始下载",
      deliveryExpired: "下载链接已过期或已使用。", regenerateDownload: "创建新链接",
      statusLabel: "任务状态",
      resolveError: "无法解析该链接，请确认页面公开后重试。",
      retryableTitle: "暂时无法完成", retryableDescription: "TikDD 未能完成本次请求，请稍后使用同一链接重试。",
      unavailableTitle: "视频不可用", unavailableDescription: "页面可能为私密、受限、已删除或暂不支持。请使用你有权访问的其他公开链接。",
      expiredTitle: "解析结果已过期", expiredDescription: "已保存的格式不再可用，请重新解析链接以刷新结果。",
      duplicateInProgress: "该链接正在处理中，请稍后重试。",
      rateLimited: "提交请求过于频繁，请稍后重试。",
      concurrencyLimited: "当前活动解析任务过多，请稍后重试。",
      idempotencyConflict: "该请求标识已被使用，请重新发起解析。",
      admissionUnavailable: "暂时无法接收新的解析请求，请稍后重试。",
      timeout: "解析时间超出预期，请稍后重试。",
      deliveryError: "该格式暂时无法安全交付，请重新解析链接。", expired: "任务已经过期，请重新解析链接。"
    },
    features: [
      ["广泛识别", "识别持续扩展的平台目录中的公开视频页面。"],
      ["格式清晰", "将清晰度和媒体信息统一为一致的选择界面。"],
      ["受控交付", "使用短期交付链接，不公开上游媒体地址。"]
    ],
    supported: { label: "支持：", platforms: ["YouTube", "TikTok", "X", "更多"] },
    process: {
      title: "工作方式",
      steps: [
        ["粘贴链接", "将公开视频页面链接粘贴到上方输入框。"],
        ["解析视频", "TikDD 识别平台并检查可用格式。"],
        ["选择格式", "选择可用格式并申请短期交付链接。"]
      ]
    },
    faq: {
      title: "常见问题",
      items: [
        ["可以使用哪些链接？", "仅使用你拥有或已获得下载授权的公开媒体页面。"],
        ["需要创建账号吗？", "当前解析流程不需要账号。"],
        ["为什么已识别的链接仍可能失败？", "私密、付费、受限或近期结构发生变化的页面可能无法解析。"]
      ]
    },
    trust: {
      title: "围绕安全交付设计", labels: "限定范围 · 短期有效 · 单次使用",
      description: "公开结果不会包含第三方下载地址或私密请求头。"
    },
    legal: "TikDD 与页面中列出的平台不存在隶属关系。仅下载你拥有或已获授权使用的内容。"
  }
} as const;

export type SiteCopy = (typeof copy)[Locale];
export function isLocale(value: string): value is Locale { return locales.includes(value as Locale); }
export function getCopy(locale: Locale): SiteCopy { return copy[locale]; }
