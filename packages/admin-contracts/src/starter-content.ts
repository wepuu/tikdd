import { AdminSharedContentSchema, type AdminSharedContent } from "./content-management";
import {
  AdminPageContentSchema,
  AdminSeoFieldsSchema,
  type AdminPageContent,
  type AdminSeoFields
} from "./editorial";

/**
 * Reviewed, code-owned content pack used by Web's cold-start fallback and by the Admin editor as
 * a safe starting point. Production still publishes immutable snapshots through Admin.
 */
export const STARTER_LOCALES = ["en", "zh-CN", "es", "fr", "de", "it", "tr", "pl", "ja"] as const;
export type StarterLocale = (typeof STARTER_LOCALES)[number];

export const STARTER_LOCALE_DEFINITIONS: Readonly<Record<StarterLocale, {
  displayName: string;
  direction: "ltr" | "rtl";
  fallbackLocale: StarterLocale | null;
  isDefault: boolean;
}>> = {
  en: { displayName: "English", direction: "ltr", fallbackLocale: null, isDefault: true },
  "zh-CN": { displayName: "简体中文", direction: "ltr", fallbackLocale: "en", isDefault: false },
  es: { displayName: "Español", direction: "ltr", fallbackLocale: "en", isDefault: false },
  fr: { displayName: "Français", direction: "ltr", fallbackLocale: "en", isDefault: false },
  de: { displayName: "Deutsch", direction: "ltr", fallbackLocale: "en", isDefault: false },
  it: { displayName: "Italiano", direction: "ltr", fallbackLocale: "en", isDefault: false },
  tr: { displayName: "Türkçe", direction: "ltr", fallbackLocale: "en", isDefault: false },
  pl: { displayName: "Polski", direction: "ltr", fallbackLocale: "en", isDefault: false },
  ja: { displayName: "日本語", direction: "ltr", fallbackLocale: "en", isDefault: false }
};

export interface StarterPageRecord {
  pageId: string;
  locale: StarterLocale;
  pageType: "homepage" | "platform" | "guide" | "faq" | "legal";
  platform: string | null;
  content: AdminPageContent;
  seo: AdminSeoFields;
}

type StarterPlatform = "x" | "instagram" | "tiktok" | "facebook" | "vimeo" | "pinterest" | "xhamster";
type StarterPageKey = "home" | StarterPlatform | "faq" | "help" | "privacy" | "terms";

const PLATFORM_NAMES: Record<StarterPlatform, string> = {
  x: "X", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook",
  vimeo: "Vimeo", pinterest: "Pinterest", xhamster: "xHamster"
};

type Text = {
  home: string; footer: string; independent: string; socialTitle: string; socialDescription: string;
  heroTitle: string; heroSubtitle: string; inputLabel: string; placeholder: string; action: string;
  supportedTitle: string; howTitle: string; paste: string; pasteDescription: string;
  resolve: string; resolveDescription: string; choose: string; chooseDescription: string;
  faqTitle: string; faqIntro: string; supportedQuestion: string; supportedAnswer: string;
  accountQuestion: string; accountAnswer: string; failureQuestion: string; failureAnswer: string;
  publicOnly: string; platformLink: Record<StarterPlatform, string>; platformTitle: (name: string, stable: boolean) => string;
  platformIntro: (name: string, link: string) => string; platformSupportedQ: (name: string) => string;
  platformSupportedA: (name: string, stable: boolean, link: string) => string; accountPlatformQ: (name: string) => string;
  directAnswer: (name: string, stable: boolean, link: string) => string;
  guideTitle: string; guideIntro: string; guidePaste: string; guideChoose: string; guideDownload: string;
  privacyTitle: string; privacySummary: string; termsTitle: string; termsSummary: string;
  dataHeading: string; dataBody: string; thirdPartyHeading: string; thirdPartyBody: string;
  useHeading: string; useBody: string; availabilityHeading: string; availabilityBody: string;
  homeSeoTitle: string; homeSeoDescription: string; platformSeoTitle: (name: string, stable: boolean) => string;
  platformSeoDescription: (name: string, stable: boolean) => string;
  genericSeoTitle: Record<"faq" | "help" | "privacy" | "terms", string>;
  genericSeoDescription: Record<"faq" | "help" | "privacy" | "terms", string>;
};

const commonPlatforms = "X, Instagram, TikTok, Facebook, Vimeo, and Pinterest";
const TEXT: Record<StarterLocale, Text> = {
  en: {
    home: "Home", footer: "Clear formats. Controlled delivery.", independent: `TikDD is an independent tool and is not affiliated with ${commonPlatforms}.`,
    socialTitle: "TikDD public video downloader for supported platforms", socialDescription: `Download public videos from ${commonPlatforms} with TikDD.`,
    heroTitle: "Download public videos from six supported platforms", heroSubtitle: `Paste a public ${commonPlatforms} video URL. TikDD checks available formats and creates a short-lived download link.`,
    inputLabel: "Public video page URL", placeholder: `Paste a public ${commonPlatforms} URL`, action: "Download",
    supportedTitle: "Six supported platforms", howTitle: "How it works", paste: "Paste a link", pasteDescription: "Copy a public video page URL into the field above.",
    resolve: "Check formats", resolveDescription: "TikDD identifies the platform and checks the formats currently available.", choose: "Download", chooseDescription: "Choose an MP4 format and use the short-lived delivery link.",
    faqTitle: "Frequently asked questions", faqIntro: "Practical answers about TikDD's supported public-video workflows.", supportedQuestion: "Which links can I use?", supportedAnswer: `TikDD accepts public video pages from ${commonPlatforms}. Availability depends on the public post and the active provider route.`,
    accountQuestion: "Do I need an account?", accountAnswer: "No. TikDD does not request your platform account, cookies, or access to private content.", failureQuestion: "Why can a public link fail?", failureAnswer: "A post may be private, paid, restricted, deleted, rate-limited, or temporarily unavailable upstream.",
    publicOnly: "Public links only. Private, paid, DRM-protected, restricted, deleted, or recently changed pages may not resolve.",
    platformLink: { x: "post", instagram: "Reel or video post", tiktok: "video", facebook: "Reel or video", vimeo: "video", pinterest: "video Pin", xhamster: "public video page" },
    platformTitle: (name, stable) => `${name} video downloader${stable ? "" : " Beta"}`,
    platformIntro: (name, link) => `Paste a public ${name} ${link} URL. TikDD checks the available MP4 formats and prepares a short-lived browser download.`,
    platformSupportedQ: (name) => `Which ${name} links are supported?`, platformSupportedA: (name, stable, link) => `TikDD's ${name} ${stable ? "stable" : "Beta"} route accepts public ${link} URLs that are available without an account.`,
    accountPlatformQ: (name) => `Do I need a ${name} account?`, directAnswer: (name, stable, link) => `TikDD's ${name} ${stable ? "stable" : "Beta"} downloader accepts public ${link} URLs and returns available MP4 choices when the page and provider route are accessible.`,
    guideTitle: "How to use TikDD", guideIntro: "Download an accessible public video in three clear steps.", guidePaste: `Paste a supported public ${commonPlatforms} link.`, guideChoose: "Review the MP4 formats returned for the public page and select the one you want.", guideDownload: "Request the short-lived link; your browser receives the file from an approved media host.",
    privacyTitle: "Privacy", privacySummary: "TikDD resolves public media pages without asking for account credentials or access to private content.", termsTitle: "Terms of use", termsSummary: "Use TikDD only for content you are allowed to access and download. Platform rules, copyright, and local law still apply.",
    dataHeading: "Data boundary", dataBody: "Submitted links are processed to resolve the requested public page. Short-lived task and delivery records expire after operational use.", thirdPartyHeading: "Third-party hosts", thirdPartyBody: "An approved media host may serve a successful download. TikDD does not control that host's independent policies.",
    useHeading: "Acceptable use", useBody: "Do not use TikDD to bypass private access, paywalls, DRM, or platform restrictions. Respect creators and applicable rules.", availabilityHeading: "Availability", availabilityBody: "The service is provided as-is. Public links can fail when an upstream page or provider changes or becomes unavailable.",
    homeSeoTitle: "TikDD X, Instagram, TikTok, Facebook, Vimeo, Pinterest downloader", homeSeoDescription: `Download public videos from ${commonPlatforms}. Paste a link, choose an available MP4 format, and download in your browser.`,
    platformSeoTitle: (name, stable) => `${name} video downloader${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `Download accessible public ${name} videos with TikDD's ${stable ? "stable" : "Beta"} workflow. Paste a link, check MP4 formats, and choose a download.`,
    genericSeoTitle: { faq: "TikDD frequently asked questions", help: "How to use TikDD video downloader", privacy: "TikDD privacy information", terms: "TikDD terms of use" },
    genericSeoDescription: { faq: "Answers about supported links, public content, download delivery, privacy, and common TikDD errors.", help: "Learn how to paste a public video URL, choose an available MP4 format, and download it safely with TikDD.", privacy: "Read how TikDD processes public links, short-lived task data, and approved third-party media delivery.", terms: "Read the acceptable-use, availability, copyright, and platform-rule boundaries for using TikDD." }
  },
  "zh-CN": {
    home: "首页", footer: "格式清晰，受控交付。", independent: "TikDD 是独立工具，与 X、Instagram、TikTok、Facebook、Vimeo 或 Pinterest 不存在隶属关系。",
    socialTitle: "TikDD 多平台公开视频下载工具", socialDescription: "使用 TikDD 下载 X、Instagram、TikTok、Facebook、Vimeo 与 Pinterest 的公开视频。",
    heroTitle: "下载六个平台的公开视频", heroSubtitle: "粘贴公开的 X、Instagram、TikTok、Facebook、Vimeo 或 Pinterest 视频链接。TikDD 会检查可用格式并生成短期下载链接。",
    inputLabel: "公开视频页面链接", placeholder: "粘贴公开的 X、Instagram、TikTok、Facebook、Vimeo 或 Pinterest 链接", action: "下载",
    supportedTitle: "支持六个平台", howTitle: "使用方式", paste: "粘贴链接", pasteDescription: "将公开视频页面链接粘贴到上方输入框。", resolve: "检查格式", resolveDescription: "TikDD 识别平台并检查当前可用格式。", choose: "下载", chooseDescription: "选择 MP4 格式并使用短期有效的交付链接。",
    faqTitle: "常见问题", faqIntro: "了解 TikDD 支持的公开视频下载流程。", supportedQuestion: "可以使用哪些链接？", supportedAnswer: "TikDD 支持 X、Instagram、TikTok、Facebook、Vimeo 与 Pinterest 的公开视频页面，实际可用性取决于公开帖子和当前 Provider 路由。", accountQuestion: "需要平台账号吗？", accountAnswer: "不需要。TikDD 不会索取平台账号、Cookie，也不会访问私密内容。", failureQuestion: "为什么公开链接仍可能失败？", failureAnswer: "帖子可能为私密、付费、受限、已删除、被限流，或上游暂时不可用。",
    publicOnly: "仅支持公开链接。私密、付费、DRM 保护、受限、已删除或近期结构变化的页面可能无法解析。", platformLink: { x: "帖子", instagram: "Reel 或视频帖子", tiktok: "视频", facebook: "Reel 或视频", vimeo: "视频", pinterest: "视频 Pin", xhamster: "公开视频页面" },
    platformTitle: (name, stable) => `${name} 视频下载${stable ? "" : " Beta"}`, platformIntro: (name, link) => `粘贴公开的 ${name} ${link}链接。TikDD 会检查可用 MP4 格式，并准备短期有效的浏览器下载。`, platformSupportedQ: (name) => `支持哪些 ${name} 链接？`, platformSupportedA: (name, stable, link) => `TikDD 的 ${name}${stable ? "稳定" : " Beta"}路由支持无需账号即可访问的公开${link}链接。`, accountPlatformQ: (name) => `需要 ${name} 账号吗？`, directAnswer: (name, stable, link) => `TikDD 的 ${name}${stable ? "稳定" : " Beta"}下载工具支持公开${link}链接；页面与 Provider 路由可用时会返回 MP4 选项。`,
    guideTitle: "如何使用 TikDD", guideIntro: "用三个清晰步骤下载可访问的公开视频。", guidePaste: "粘贴支持平台的公开视频链接。", guideChoose: "查看公开页面返回的 MP4 格式并选择需要的版本。", guideDownload: "申请短期链接，浏览器将从受审媒体主机接收文件。",
    privacyTitle: "隐私说明", privacySummary: "TikDD 用于解析公开媒体页面，不会索取账号凭据或访问私密内容。", termsTitle: "使用条款", termsSummary: "请仅下载你有权访问的内容，平台规则、版权及当地法律仍然适用。", dataHeading: "数据边界", dataBody: "提交的链接仅用于解析公开页面，短期任务和交付记录会在运行用途结束后到期。", thirdPartyHeading: "第三方主机", thirdPartyBody: "成功下载可能由受审媒体主机提供，TikDD 不控制该主机的独立政策。", useHeading: "合理使用", useBody: "不得使用 TikDD 绕过私密访问、付费墙、DRM 或平台限制，请尊重创作者及适用规则。", availabilityHeading: "服务可用性", availabilityBody: "服务按现状提供；上游页面或 Provider 变化或不可用时，公开链接也可能失败。",
    homeSeoTitle: "TikDD X、Instagram、TikTok、Facebook、Vimeo 与 Pinterest 视频下载", homeSeoDescription: "下载 X、Instagram、TikTok、Facebook、Vimeo 与 Pinterest 的公开视频。粘贴链接、选择 MP4 格式并在浏览器中下载。", platformSeoTitle: (name, stable) => `TikDD ${name} 视频下载${stable ? "" : " Beta"}`, platformSeoDescription: (name, stable) => `使用 TikDD 的${stable ? "稳定" : " Beta"}流程下载可访问的公开 ${name} 视频：粘贴链接、检查 MP4 格式并选择下载。`, genericSeoTitle: { faq: "TikDD 常见问题", help: "TikDD 视频下载使用方法", privacy: "TikDD 隐私说明", terms: "TikDD 使用条款" }, genericSeoDescription: { faq: "了解支持的链接、公开内容、下载交付、隐私边界与 TikDD 常见错误。", help: "了解如何粘贴公开视频链接、选择可用 MP4 格式并使用 TikDD 完成下载。", privacy: "了解 TikDD 如何处理公开链接、短期任务数据与受审第三方媒体交付。", terms: "了解使用 TikDD 时的合理使用、可用性、版权及平台规则边界。" }
  },
  es: {
    home: "Inicio", footer: "Formatos claros. Entrega controlada.", independent: "TikDD es una herramienta independiente y no está afiliada con X, Instagram, TikTok, Facebook, Vimeo ni Pinterest.", socialTitle: "Descargador TikDD de vídeos públicos", socialDescription: "Descarga vídeos públicos de seis plataformas compatibles con TikDD.", heroTitle: "Descarga vídeos públicos de seis plataformas", heroSubtitle: "Pega una URL pública de X, Instagram, TikTok, Facebook, Vimeo o Pinterest. TikDD comprueba los formatos disponibles y crea un enlace de descarga temporal.", inputLabel: "URL de la página pública del vídeo", placeholder: "Pega una URL pública compatible", action: "Descargar", supportedTitle: "Seis plataformas compatibles", howTitle: "Cómo funciona", paste: "Pega el enlace", pasteDescription: "Copia arriba la URL pública de la página del vídeo.", resolve: "Comprueba formatos", resolveDescription: "TikDD identifica la plataforma y revisa los formatos disponibles.", choose: "Descarga", chooseDescription: "Elige un formato MP4 y usa el enlace temporal.", faqTitle: "Preguntas frecuentes", faqIntro: "Respuestas prácticas sobre las descargas de vídeos públicos con TikDD.", supportedQuestion: "¿Qué enlaces puedo usar?", supportedAnswer: "TikDD admite páginas públicas de X, Instagram, TikTok, Facebook, Vimeo y Pinterest. La disponibilidad depende de la publicación y de la ruta activa.", accountQuestion: "¿Necesito una cuenta?", accountAnswer: "No. TikDD no solicita tu cuenta, cookies ni acceso a contenido privado.", failureQuestion: "¿Por qué puede fallar un enlace público?", failureAnswer: "La publicación puede ser privada, de pago, restringida, eliminada, limitada o estar temporalmente inaccesible.", publicOnly: "Solo enlaces públicos. Las páginas privadas, de pago, con DRM, restringidas, eliminadas o modificadas pueden no resolverse.", platformLink: { x: "publicación", instagram: "Reel o vídeo", tiktok: "vídeo", facebook: "Reel o vídeo", vimeo: "vídeo", pinterest: "Pin de vídeo", xhamster: "página pública de vídeo" }, platformTitle: (name, stable) => `Descargador de vídeos de ${name}${stable ? "" : " Beta"}`, platformIntro: (name, link) => `Pega la URL de una ${link} pública de ${name}. TikDD comprueba los MP4 disponibles y prepara la descarga temporal.`, platformSupportedQ: (name) => `¿Qué enlaces de ${name} se admiten?`, platformSupportedA: (name, stable, link) => `La ruta ${stable ? "estable" : "Beta"} de ${name} admite URL públicas de ${link} accesibles sin cuenta.`, accountPlatformQ: (name) => `¿Necesito una cuenta de ${name}?`, directAnswer: (name, stable, link) => `El descargador ${stable ? "estable" : "Beta"} de ${name} acepta URL públicas de ${link} y muestra opciones MP4 cuando la página y la ruta están disponibles.`, guideTitle: "Cómo usar TikDD", guideIntro: "Descarga un vídeo público accesible en tres pasos.", guidePaste: "Pega un enlace público de una plataforma compatible.", guideChoose: "Revisa los formatos MP4 y elige el que prefieras.", guideDownload: "Solicita el enlace temporal; el navegador recibe el archivo desde un host multimedia aprobado.", privacyTitle: "Privacidad", privacySummary: "TikDD resuelve páginas multimedia públicas sin pedir credenciales ni acceso privado.", termsTitle: "Condiciones de uso", termsSummary: "Usa TikDD solo con contenido que puedas consultar y descargar legalmente.", dataHeading: "Límite de datos", dataBody: "Los enlaces se procesan para resolver la página pública solicitada; las tareas temporales caducan tras su uso.", thirdPartyHeading: "Hosts de terceros", thirdPartyBody: "Un host multimedia aprobado puede servir la descarga y mantiene sus propias políticas.", useHeading: "Uso aceptable", useBody: "No eludas accesos privados, muros de pago, DRM ni restricciones de la plataforma.", availabilityHeading: "Disponibilidad", availabilityBody: "El servicio se ofrece tal cual; los cambios o fallos del origen pueden impedir una descarga.", homeSeoTitle: "Descargador de vídeos públicos TikDD", homeSeoDescription: "Descarga vídeos públicos de X, Instagram, TikTok, Facebook, Vimeo y Pinterest. Pega un enlace, elige MP4 y descarga.", platformSeoTitle: (name, stable) => `Descargador de vídeos de ${name}${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `Descarga vídeos públicos accesibles de ${name} con el flujo ${stable ? "estable" : "Beta"} de TikDD. Pega una URL y elige un MP4.`, genericSeoTitle: { faq: "Preguntas frecuentes de TikDD", help: "Cómo usar el descargador TikDD", privacy: "Privacidad de TikDD", terms: "Condiciones de uso de TikDD" }, genericSeoDescription: { faq: "Respuestas sobre enlaces compatibles, contenido público, entrega, privacidad y errores habituales de TikDD.", help: "Aprende a pegar una URL pública, elegir un MP4 disponible y descargarlo con TikDD.", privacy: "Consulta cómo procesa TikDD los enlaces públicos, los datos temporales y la entrega multimedia.", terms: "Consulta los límites de uso, disponibilidad, derechos de autor y reglas de plataforma de TikDD." }
  },
  fr: {
    home: "Accueil", footer: "Formats clairs. Livraison contrôlée.", independent: "TikDD est un outil indépendant, sans affiliation avec X, Instagram, TikTok, Facebook, Vimeo ou Pinterest.", socialTitle: "Téléchargeur TikDD de vidéos publiques", socialDescription: "Téléchargez des vidéos publiques de six plateformes avec TikDD.", heroTitle: "Téléchargez des vidéos publiques de six plateformes", heroSubtitle: "Collez une URL publique X, Instagram, TikTok, Facebook, Vimeo ou Pinterest. TikDD vérifie les formats et crée un lien temporaire.", inputLabel: "URL de la page vidéo publique", placeholder: "Collez une URL publique compatible", action: "Télécharger", supportedTitle: "Six plateformes compatibles", howTitle: "Comment ça marche", paste: "Collez le lien", pasteDescription: "Copiez l’URL publique de la page vidéo ci-dessus.", resolve: "Vérifiez les formats", resolveDescription: "TikDD reconnaît la plateforme et vérifie les formats disponibles.", choose: "Téléchargez", chooseDescription: "Choisissez un MP4 et utilisez le lien temporaire.", faqTitle: "Questions fréquentes", faqIntro: "Réponses pratiques sur les téléchargements de vidéos publiques avec TikDD.", supportedQuestion: "Quels liens puis-je utiliser ?", supportedAnswer: "TikDD accepte les pages vidéo publiques de X, Instagram, TikTok, Facebook, Vimeo et Pinterest. La disponibilité dépend de la publication et de la route active.", accountQuestion: "Faut-il un compte ?", accountAnswer: "Non. TikDD ne demande ni compte, ni cookie, ni accès à un contenu privé.", failureQuestion: "Pourquoi un lien public peut-il échouer ?", failureAnswer: "La publication peut être privée, payante, limitée, supprimée ou temporairement indisponible.", publicOnly: "Liens publics uniquement. Les pages privées, payantes, protégées par DRM, limitées, supprimées ou modifiées peuvent échouer.", platformLink: { x: "publication", instagram: "Reel ou publication vidéo", tiktok: "vidéo", facebook: "Reel ou vidéo", vimeo: "vidéo", pinterest: "épingle vidéo", xhamster: "page vidéo publique" }, platformTitle: (name, stable) => `Téléchargeur de vidéos ${name}${stable ? "" : " Beta"}`, platformIntro: (name, link) => `Collez l’URL d’une ${link} publique ${name}. TikDD vérifie les MP4 disponibles et prépare un téléchargement temporaire.`, platformSupportedQ: (name) => `Quels liens ${name} sont compatibles ?`, platformSupportedA: (name, stable, link) => `La route ${stable ? "stable" : "Beta"} ${name} accepte les URL publiques de ${link} accessibles sans compte.`, accountPlatformQ: (name) => `Faut-il un compte ${name} ?`, directAnswer: (name, stable, link) => `Le téléchargeur ${name} ${stable ? "stable" : "Beta"} accepte les URL publiques de ${link} et propose des MP4 lorsque la page et la route sont disponibles.`, guideTitle: "Comment utiliser TikDD", guideIntro: "Téléchargez une vidéo publique accessible en trois étapes.", guidePaste: "Collez un lien public d’une plateforme compatible.", guideChoose: "Consultez les formats MP4 et choisissez celui qui vous convient.", guideDownload: "Demandez le lien temporaire ; le navigateur reçoit le fichier d’un hôte approuvé.", privacyTitle: "Confidentialité", privacySummary: "TikDD résout des pages publiques sans demander d’identifiants ni d’accès privé.", termsTitle: "Conditions d’utilisation", termsSummary: "Utilisez TikDD uniquement pour du contenu que vous êtes autorisé à consulter et télécharger.", dataHeading: "Limite des données", dataBody: "Les liens servent à résoudre la page publique demandée ; les tâches temporaires expirent après usage.", thirdPartyHeading: "Hôtes tiers", thirdPartyBody: "Un hôte média approuvé peut servir le téléchargement selon ses propres politiques.", useHeading: "Usage acceptable", useBody: "Ne contournez pas les accès privés, paiements, DRM ou restrictions de plateforme.", availabilityHeading: "Disponibilité", availabilityBody: "Le service est fourni en l’état ; un changement ou une panne en amont peut bloquer un lien.", homeSeoTitle: "Téléchargeur de vidéos publiques TikDD", homeSeoDescription: "Téléchargez des vidéos publiques de X, Instagram, TikTok, Facebook, Vimeo et Pinterest. Collez un lien, choisissez un MP4 et téléchargez.", platformSeoTitle: (name, stable) => `Téléchargeur de vidéos ${name}${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `Téléchargez des vidéos publiques ${name} avec le parcours ${stable ? "stable" : "Beta"} de TikDD. Collez une URL et choisissez un MP4.`, genericSeoTitle: { faq: "Questions fréquentes TikDD", help: "Comment utiliser TikDD", privacy: "Confidentialité TikDD", terms: "Conditions d’utilisation TikDD" }, genericSeoDescription: { faq: "Réponses sur les liens compatibles, le contenu public, la livraison, la confidentialité et les erreurs TikDD.", help: "Apprenez à coller une URL publique, choisir un MP4 et le télécharger avec TikDD.", privacy: "Découvrez le traitement des liens publics, des données temporaires et de la livraison média par TikDD.", terms: "Consultez les limites d’usage, de disponibilité, de droit d’auteur et de plateforme de TikDD." }
  },
  de: {
    home: "Startseite", footer: "Klare Formate. Kontrollierte Auslieferung.", independent: "TikDD ist ein unabhängiges Tool und nicht mit X, Instagram, TikTok, Facebook, Vimeo oder Pinterest verbunden.", socialTitle: "TikDD Downloader für öffentliche Videos", socialDescription: "Öffentliche Videos von sechs Plattformen mit TikDD herunterladen.", heroTitle: "Öffentliche Videos von sechs Plattformen herunterladen", heroSubtitle: "Füge eine öffentliche X-, Instagram-, TikTok-, Facebook-, Vimeo- oder Pinterest-URL ein. TikDD prüft Formate und erstellt einen kurzlebigen Link.", inputLabel: "URL der öffentlichen Videoseite", placeholder: "Öffentliche unterstützte URL einfügen", action: "Herunterladen", supportedTitle: "Sechs unterstützte Plattformen", howTitle: "So funktioniert es", paste: "Link einfügen", pasteDescription: "Kopiere die öffentliche Videoseiten-URL in das Feld.", resolve: "Formate prüfen", resolveDescription: "TikDD erkennt die Plattform und prüft verfügbare Formate.", choose: "Herunterladen", chooseDescription: "Wähle ein MP4-Format und nutze den kurzlebigen Link.", faqTitle: "Häufige Fragen", faqIntro: "Praktische Antworten zum Download öffentlicher Videos mit TikDD.", supportedQuestion: "Welche Links kann ich verwenden?", supportedAnswer: "TikDD akzeptiert öffentliche Videoseiten von X, Instagram, TikTok, Facebook, Vimeo und Pinterest. Die Verfügbarkeit hängt vom Beitrag und der aktiven Route ab.", accountQuestion: "Brauche ich ein Konto?", accountAnswer: "Nein. TikDD verlangt weder Konto noch Cookies oder Zugriff auf private Inhalte.", failureQuestion: "Warum kann ein öffentlicher Link fehlschlagen?", failureAnswer: "Der Beitrag kann privat, kostenpflichtig, eingeschränkt, gelöscht oder vorübergehend nicht verfügbar sein.", publicOnly: "Nur öffentliche Links. Private, kostenpflichtige, DRM-geschützte, eingeschränkte, gelöschte oder geänderte Seiten können fehlschlagen.", platformLink: { x: "Beitrag", instagram: "Reel oder Videobeitrag", tiktok: "Video", facebook: "Reel oder Video", vimeo: "Video", pinterest: "Video-Pin", xhamster: "öffentliche Videoseite" }, platformTitle: (name, stable) => `${name} Video Downloader${stable ? "" : " Beta"}`, platformIntro: (name, link) => `Füge die URL für einen öffentlichen ${name}-${link} ein. TikDD prüft MP4-Formate und bereitet den temporären Download vor.`, platformSupportedQ: (name) => `Welche ${name}-Links werden unterstützt?`, platformSupportedA: (name, stable, link) => `Die ${stable ? "stabile" : "Beta"} Route für ${name} akzeptiert öffentliche ${link}-URLs, die ohne Konto erreichbar sind.`, accountPlatformQ: (name) => `Brauche ich ein ${name}-Konto?`, directAnswer: (name, stable, link) => `Der ${stable ? "stabile" : "Beta"} ${name} Downloader akzeptiert öffentliche ${link}-URLs und zeigt MP4-Optionen, wenn Seite und Route erreichbar sind.`, guideTitle: "TikDD verwenden", guideIntro: "Ein erreichbares öffentliches Video in drei Schritten herunterladen.", guidePaste: "Füge einen öffentlichen Link einer unterstützten Plattform ein.", guideChoose: "Prüfe die MP4-Formate und wähle die gewünschte Version.", guideDownload: "Fordere den kurzlebigen Link an; der Browser lädt von einem geprüften Medienhost.", privacyTitle: "Datenschutz", privacySummary: "TikDD verarbeitet öffentliche Medienseiten ohne Zugangsdaten oder private Inhalte anzufordern.", termsTitle: "Nutzungsbedingungen", termsSummary: "Nutze TikDD nur für Inhalte, auf die du zugreifen und die du herunterladen darfst.", dataHeading: "Datengrenze", dataBody: "Links werden nur zur Auflösung der öffentlichen Seite verarbeitet; kurzlebige Aufgaben verfallen danach.", thirdPartyHeading: "Drittanbieter-Hosts", thirdPartyBody: "Ein geprüfter Medienhost kann den Download nach eigenen Richtlinien ausliefern.", useHeading: "Zulässige Nutzung", useBody: "Umgehe keine privaten Zugänge, Bezahlschranken, DRM- oder Plattformbeschränkungen.", availabilityHeading: "Verfügbarkeit", availabilityBody: "Der Dienst wird wie vorhanden angeboten; Änderungen oder Ausfälle upstream können Links blockieren.", homeSeoTitle: "TikDD Downloader für öffentliche Videos", homeSeoDescription: "Öffentliche Videos von X, Instagram, TikTok, Facebook, Vimeo und Pinterest herunterladen. Link einfügen, MP4 wählen, herunterladen.", platformSeoTitle: (name, stable) => `${name} Video Downloader${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `Öffentliche ${name}-Videos mit TikDDs ${stable ? "stabilem" : "Beta-"}Ablauf herunterladen. URL einfügen und MP4 auswählen.`, genericSeoTitle: { faq: "Häufige Fragen zu TikDD", help: "TikDD Video Downloader verwenden", privacy: "TikDD Datenschutz", terms: "TikDD Nutzungsbedingungen" }, genericSeoDescription: { faq: "Antworten zu unterstützten Links, öffentlichen Inhalten, Auslieferung, Datenschutz und TikDD-Fehlern.", help: "So fügst du eine öffentliche URL ein, wählst ein MP4 und lädst es mit TikDD herunter.", privacy: "Informationen zu öffentlichen Links, temporären Aufgabendaten und Medienauslieferung bei TikDD.", terms: "Nutzungs-, Verfügbarkeits-, Urheberrechts- und Plattformgrenzen für TikDD." }
  },
  it: {
    home: "Home", footer: "Formati chiari. Consegna controllata.", independent: "TikDD è uno strumento indipendente e non è affiliato a X, Instagram, TikTok, Facebook, Vimeo o Pinterest.", socialTitle: "Downloader TikDD per video pubblici", socialDescription: "Scarica video pubblici da sei piattaforme con TikDD.", heroTitle: "Scarica video pubblici da sei piattaforme", heroSubtitle: "Incolla un URL pubblico di X, Instagram, TikTok, Facebook, Vimeo o Pinterest. TikDD verifica i formati e crea un link temporaneo.", inputLabel: "URL della pagina video pubblica", placeholder: "Incolla un URL pubblico supportato", action: "Scarica", supportedTitle: "Sei piattaforme supportate", howTitle: "Come funziona", paste: "Incolla il link", pasteDescription: "Copia nel campo l’URL pubblico della pagina video.", resolve: "Verifica i formati", resolveDescription: "TikDD riconosce la piattaforma e controlla i formati disponibili.", choose: "Scarica", chooseDescription: "Scegli un formato MP4 e usa il link temporaneo.", faqTitle: "Domande frequenti", faqIntro: "Risposte pratiche sui download di video pubblici con TikDD.", supportedQuestion: "Quali link posso usare?", supportedAnswer: "TikDD accetta pagine video pubbliche di X, Instagram, TikTok, Facebook, Vimeo e Pinterest. La disponibilità dipende dal post e dalla rotta attiva.", accountQuestion: "Serve un account?", accountAnswer: "No. TikDD non richiede account, cookie o accesso a contenuti privati.", failureQuestion: "Perché un link pubblico può fallire?", failureAnswer: "Il post può essere privato, a pagamento, limitato, eliminato o temporaneamente non disponibile.", publicOnly: "Solo link pubblici. Pagine private, a pagamento, con DRM, limitate, eliminate o modificate potrebbero non funzionare.", platformLink: { x: "post", instagram: "Reel o post video", tiktok: "video", facebook: "Reel o video", vimeo: "video", pinterest: "Pin video", xhamster: "pagina video pubblica" }, platformTitle: (name, stable) => `Downloader video ${name}${stable ? "" : " Beta"}`, platformIntro: (name, link) => `Incolla l’URL di un ${link} pubblico di ${name}. TikDD verifica gli MP4 e prepara il download temporaneo.`, platformSupportedQ: (name) => `Quali link ${name} sono supportati?`, platformSupportedA: (name, stable, link) => `La rotta ${stable ? "stabile" : "Beta"} di ${name} accetta URL pubblici di ${link} accessibili senza account.`, accountPlatformQ: (name) => `Serve un account ${name}?`, directAnswer: (name, stable, link) => `Il downloader ${name} ${stable ? "stabile" : "Beta"} accetta URL pubblici di ${link} e mostra MP4 quando pagina e rotta sono disponibili.`, guideTitle: "Come usare TikDD", guideIntro: "Scarica un video pubblico accessibile in tre passaggi.", guidePaste: "Incolla un link pubblico di una piattaforma supportata.", guideChoose: "Controlla i formati MP4 e scegli quello desiderato.", guideDownload: "Richiedi il link temporaneo; il browser riceve il file da un host approvato.", privacyTitle: "Privacy", privacySummary: "TikDD risolve pagine pubbliche senza richiedere credenziali o accesso privato.", termsTitle: "Termini di utilizzo", termsSummary: "Usa TikDD solo per contenuti che puoi consultare e scaricare legittimamente.", dataHeading: "Confine dei dati", dataBody: "I link servono a risolvere la pagina pubblica; le attività temporanee scadono dopo l’uso.", thirdPartyHeading: "Host di terze parti", thirdPartyBody: "Un host multimediale approvato può servire il download secondo le proprie regole.", useHeading: "Uso consentito", useBody: "Non aggirare accessi privati, paywall, DRM o limitazioni della piattaforma.", availabilityHeading: "Disponibilità", availabilityBody: "Il servizio è fornito così com’è; modifiche o problemi a monte possono bloccare un link.", homeSeoTitle: "Downloader TikDD per video pubblici", homeSeoDescription: "Scarica video pubblici da X, Instagram, TikTok, Facebook, Vimeo e Pinterest. Incolla un link, scegli MP4 e scarica.", platformSeoTitle: (name, stable) => `Downloader video ${name}${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `Scarica video pubblici ${name} con il flusso ${stable ? "stabile" : "Beta"} di TikDD. Incolla un URL e scegli un MP4.`, genericSeoTitle: { faq: "Domande frequenti TikDD", help: "Come usare il downloader TikDD", privacy: "Privacy TikDD", terms: "Termini di utilizzo TikDD" }, genericSeoDescription: { faq: "Risposte su link supportati, contenuti pubblici, consegna, privacy ed errori comuni di TikDD.", help: "Scopri come incollare un URL pubblico, scegliere un MP4 e scaricarlo con TikDD.", privacy: "Scopri come TikDD tratta link pubblici, dati temporanei e consegna multimediale.", terms: "Consulta i limiti di uso, disponibilità, copyright e regole di piattaforma di TikDD." }
  },
  tr: {
    home: "Ana sayfa", footer: "Net formatlar. Kontrollü teslimat.", independent: "TikDD bağımsız bir araçtır; X, Instagram, TikTok, Facebook, Vimeo veya Pinterest ile bağlantılı değildir.", socialTitle: "TikDD herkese açık video indirici", socialDescription: "Altı platformdaki herkese açık videoları TikDD ile indirin.", heroTitle: "Altı platformdan herkese açık video indirin", heroSubtitle: "Herkese açık bir X, Instagram, TikTok, Facebook, Vimeo veya Pinterest URL'si yapıştırın. TikDD formatları denetler ve kısa süreli bağlantı oluşturur.", inputLabel: "Herkese açık video sayfası URL'si", placeholder: "Desteklenen herkese açık URL'yi yapıştırın", action: "İndir", supportedTitle: "Desteklenen altı platform", howTitle: "Nasıl çalışır", paste: "Bağlantıyı yapıştırın", pasteDescription: "Herkese açık video sayfası URL'sini alana kopyalayın.", resolve: "Formatları denetleyin", resolveDescription: "TikDD platformu tanır ve kullanılabilir formatları kontrol eder.", choose: "İndirin", chooseDescription: "Bir MP4 formatı seçin ve kısa süreli bağlantıyı kullanın.", faqTitle: "Sık sorulan sorular", faqIntro: "TikDD ile herkese açık video indirme hakkında pratik yanıtlar.", supportedQuestion: "Hangi bağlantıları kullanabilirim?", supportedAnswer: "TikDD, X, Instagram, TikTok, Facebook, Vimeo ve Pinterest'teki herkese açık video sayfalarını kabul eder. Kullanılabilirlik gönderiye ve etkin rotaya bağlıdır.", accountQuestion: "Hesap gerekir mi?", accountAnswer: "Hayır. TikDD hesabınızı, çerezlerinizi veya özel içeriğe erişimi istemez.", failureQuestion: "Herkese açık bağlantı neden başarısız olabilir?", failureAnswer: "Gönderi özel, ücretli, kısıtlı, silinmiş veya geçici olarak erişilemez olabilir.", publicOnly: "Yalnızca herkese açık bağlantılar. Özel, ücretli, DRM korumalı, kısıtlı, silinmiş veya değişmiş sayfalar çözümlenmeyebilir.", platformLink: { x: "gönderi", instagram: "Reel veya video gönderisi", tiktok: "video", facebook: "Reel veya video", vimeo: "video", pinterest: "video Pin'i", xhamster: "herkese açık video sayfası" }, platformTitle: (name, stable) => `${name} video indirici${stable ? "" : " Beta"}`, platformIntro: (name, link) => `Herkese açık bir ${name} ${link} URL'si yapıştırın. TikDD MP4 formatlarını denetler ve geçici indirmeyi hazırlar.`, platformSupportedQ: (name) => `Hangi ${name} bağlantıları desteklenir?`, platformSupportedA: (name, stable, link) => `${name} ${stable ? "kararlı" : "Beta"} rotası, hesap olmadan erişilen herkese açık ${link} URL'lerini kabul eder.`, accountPlatformQ: (name) => `${name} hesabı gerekir mi?`, directAnswer: (name, stable, link) => `${name} ${stable ? "kararlı" : "Beta"} indirici, herkese açık ${link} URL'lerini kabul eder ve sayfa ile rota erişilebilir olduğunda MP4 seçenekleri sunar.`, guideTitle: "TikDD nasıl kullanılır", guideIntro: "Erişilebilir bir herkese açık videoyu üç adımda indirin.", guidePaste: "Desteklenen bir platformun herkese açık bağlantısını yapıştırın.", guideChoose: "MP4 formatlarını inceleyin ve istediğinizi seçin.", guideDownload: "Kısa süreli bağlantıyı isteyin; tarayıcı dosyayı onaylı medya sunucusundan alır.", privacyTitle: "Gizlilik", privacySummary: "TikDD, kimlik bilgisi veya özel erişim istemeden herkese açık sayfaları çözümler.", termsTitle: "Kullanım koşulları", termsSummary: "TikDD'yi yalnızca erişme ve indirme hakkınız olan içerik için kullanın.", dataHeading: "Veri sınırı", dataBody: "Bağlantılar yalnızca istenen herkese açık sayfayı çözümlemek için işlenir; geçici görevler sona erer.", thirdPartyHeading: "Üçüncü taraf sunucular", thirdPartyBody: "Onaylı medya sunucusu indirmeyi kendi politikalarına göre sunabilir.", useHeading: "Kabul edilebilir kullanım", useBody: "Özel erişim, ödeme duvarı, DRM veya platform kısıtlamalarını aşmayın.", availabilityHeading: "Kullanılabilirlik", availabilityBody: "Hizmet olduğu gibi sunulur; kaynak değişikliği veya kesintisi bağlantıyı engelleyebilir.", homeSeoTitle: "TikDD herkese açık video indirici", homeSeoDescription: "X, Instagram, TikTok, Facebook, Vimeo ve Pinterest videolarını indirin. Bağlantı yapıştırın, MP4 seçin ve indirin.", platformSeoTitle: (name, stable) => `${name} video indirici${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `${name} herkese açık videolarını TikDD'nin ${stable ? "kararlı" : "Beta"} akışıyla indirin. URL yapıştırın ve MP4 seçin.`, genericSeoTitle: { faq: "TikDD sık sorulan sorular", help: "TikDD video indirici nasıl kullanılır", privacy: "TikDD gizlilik bilgisi", terms: "TikDD kullanım koşulları" }, genericSeoDescription: { faq: "Desteklenen bağlantılar, herkese açık içerik, teslimat, gizlilik ve TikDD hataları hakkında yanıtlar.", help: "Herkese açık URL yapıştırmayı, MP4 seçmeyi ve TikDD ile indirmeyi öğrenin.", privacy: "TikDD'nin herkese açık bağlantıları, geçici verileri ve medya teslimatını nasıl işlediğini öğrenin.", terms: "TikDD'nin kullanım, kullanılabilirlik, telif ve platform kuralları sınırlarını okuyun." }
  },
  pl: {
    home: "Strona główna", footer: "Czytelne formaty. Kontrolowane dostarczanie.", independent: "TikDD jest niezależnym narzędziem i nie jest powiązane z X, Instagramem, TikTokiem, Facebookiem, Vimeo ani Pinterestem.", socialTitle: "TikDD — pobieranie publicznych filmów", socialDescription: "Pobieraj publiczne filmy z sześciu platform za pomocą TikDD.", heroTitle: "Pobieraj publiczne filmy z sześciu platform", heroSubtitle: "Wklej publiczny adres X, Instagram, TikTok, Facebook, Vimeo lub Pinterest. TikDD sprawdzi formaty i utworzy krótkotrwały link.", inputLabel: "Adres publicznej strony filmu", placeholder: "Wklej obsługiwany publiczny adres", action: "Pobierz", supportedTitle: "Sześć obsługiwanych platform", howTitle: "Jak to działa", paste: "Wklej link", pasteDescription: "Skopiuj adres publicznej strony filmu do pola.", resolve: "Sprawdź formaty", resolveDescription: "TikDD rozpoznaje platformę i sprawdza dostępne formaty.", choose: "Pobierz", chooseDescription: "Wybierz format MP4 i użyj krótkotrwałego linku.", faqTitle: "Najczęstsze pytania", faqIntro: "Praktyczne odpowiedzi dotyczące pobierania publicznych filmów z TikDD.", supportedQuestion: "Jakich linków mogę używać?", supportedAnswer: "TikDD obsługuje publiczne strony filmów z X, Instagrama, TikToka, Facebooka, Vimeo i Pinteresta. Dostępność zależy od posta i aktywnej trasy.", accountQuestion: "Czy potrzebuję konta?", accountAnswer: "Nie. TikDD nie prosi o konto, pliki cookie ani dostęp do prywatnych treści.", failureQuestion: "Dlaczego publiczny link może nie działać?", failureAnswer: "Post może być prywatny, płatny, ograniczony, usunięty lub chwilowo niedostępny.", publicOnly: "Tylko publiczne linki. Strony prywatne, płatne, chronione DRM, ograniczone, usunięte lub zmienione mogą nie działać.", platformLink: { x: "post", instagram: "Reel lub post wideo", tiktok: "film", facebook: "Reel lub film", vimeo: "film", pinterest: "Pin wideo", xhamster: "publiczna strona filmu" }, platformTitle: (name, stable) => `Pobieranie filmów z ${name}${stable ? "" : " Beta"}`, platformIntro: (name, link) => `Wklej adres publicznego elementu ${link} z ${name}. TikDD sprawdzi MP4 i przygotuje tymczasowe pobieranie.`, platformSupportedQ: (name) => `Jakie linki ${name} są obsługiwane?`, platformSupportedA: (name, stable, link) => `${stable ? "Stabilna" : "Testowa"} trasa ${name} akceptuje publiczne adresy typu ${link}, dostępne bez konta.`, accountPlatformQ: (name) => `Czy potrzebuję konta ${name}?`, directAnswer: (name, stable, link) => `${stable ? "Stabilny" : "Testowy"} downloader ${name} przyjmuje publiczne adresy typu ${link} i pokazuje MP4, gdy strona i trasa są dostępne.`, guideTitle: "Jak używać TikDD", guideIntro: "Pobierz dostępny publiczny film w trzech krokach.", guidePaste: "Wklej publiczny link z obsługiwanej platformy.", guideChoose: "Sprawdź formaty MP4 i wybierz odpowiedni.", guideDownload: "Poproś o krótkotrwały link; przeglądarka pobierze plik z zatwierdzonego hosta.", privacyTitle: "Prywatność", privacySummary: "TikDD rozpoznaje publiczne strony bez żądania danych konta lub dostępu prywatnego.", termsTitle: "Warunki użytkowania", termsSummary: "Używaj TikDD tylko do treści, do których masz prawo dostępu i pobierania.", dataHeading: "Zakres danych", dataBody: "Linki są przetwarzane tylko w celu rozpoznania publicznej strony; tymczasowe zadania wygasają.", thirdPartyHeading: "Hosty zewnętrzne", thirdPartyBody: "Zatwierdzony host mediów może dostarczyć plik według własnych zasad.", useHeading: "Dozwolone użycie", useBody: "Nie omijaj prywatnego dostępu, opłat, DRM ani ograniczeń platformy.", availabilityHeading: "Dostępność", availabilityBody: "Usługa jest dostępna w obecnej formie; zmiana lub awaria źródła może zablokować link.", homeSeoTitle: "TikDD — pobieranie publicznych filmów", homeSeoDescription: "Pobieraj publiczne filmy z X, Instagrama, TikToka, Facebooka, Vimeo i Pinteresta. Wklej link, wybierz MP4 i pobierz.", platformSeoTitle: (name, stable) => `Pobieranie filmów z ${name}${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `Pobieraj publiczne filmy z ${name} przez ${stable ? "stabilny" : "testowy"} proces TikDD. Wklej URL i wybierz MP4.`, genericSeoTitle: { faq: "Najczęstsze pytania TikDD", help: "Jak używać TikDD", privacy: "Prywatność TikDD", terms: "Warunki użytkowania TikDD" }, genericSeoDescription: { faq: "Odpowiedzi o obsługiwanych linkach, publicznych treściach, dostarczaniu, prywatności i błędach TikDD.", help: "Dowiedz się, jak wkleić publiczny URL, wybrać MP4 i pobrać go z TikDD.", privacy: "Dowiedz się, jak TikDD przetwarza publiczne linki, dane tymczasowe i dostarczanie mediów.", terms: "Przeczytaj zasady użycia, dostępności, praw autorskich i platform dla TikDD." }
  },
  ja: {
    home: "ホーム", footer: "明確な形式、安全性を確認した配信。", independent: "TikDD は独立したツールであり、X、Instagram、TikTok、Facebook、Vimeo、Pinterest とは提携していません。", socialTitle: "TikDD 公開動画ダウンローダー", socialDescription: "6つの対応プラットフォームの公開動画を TikDD でダウンロードできます。", heroTitle: "6つのプラットフォームから公開動画をダウンロード", heroSubtitle: "公開されている X、Instagram、TikTok、Facebook、Vimeo、Pinterest の URL を貼り付けてください。TikDD が形式を確認し、短時間有効なリンクを作成します。", inputLabel: "公開動画ページの URL", placeholder: "対応する公開 URL を貼り付け", action: "ダウンロード", supportedTitle: "6つの対応プラットフォーム", howTitle: "使い方", paste: "リンクを貼り付ける", pasteDescription: "公開動画ページの URL を上の欄に貼り付けます。", resolve: "形式を確認", resolveDescription: "TikDD がプラットフォームを識別し、利用可能な形式を確認します。", choose: "ダウンロード", chooseDescription: "MP4 形式を選び、短時間有効なリンクを使用します。", faqTitle: "よくある質問", faqIntro: "TikDD の公開動画ダウンロードに関する実用的な回答です。", supportedQuestion: "どのリンクを使用できますか？", supportedAnswer: "TikDD は X、Instagram、TikTok、Facebook、Vimeo、Pinterest の公開動画ページに対応します。利用可否は投稿と有効な Provider ルートによります。", accountQuestion: "アカウントは必要ですか？", accountAnswer: "不要です。TikDD はアカウント、Cookie、非公開コンテンツへのアクセスを要求しません。", failureQuestion: "公開リンクでも失敗するのはなぜですか？", failureAnswer: "投稿が非公開、有料、制限中、削除済み、レート制限中、または一時的に利用できない場合があります。", publicOnly: "公開リンクのみ対応します。非公開、有料、DRM 保護、制限、削除、または仕様変更されたページは解析できない場合があります。", platformLink: { x: "投稿", instagram: "リールまたは動画投稿", tiktok: "動画", facebook: "リールまたは動画", vimeo: "動画", pinterest: "動画ピン", xhamster: "公開動画ページ" }, platformTitle: (name, stable) => `${name} 動画ダウンローダー${stable ? "" : " Beta"}`, platformIntro: (name, link) => `公開されている ${name} の${link} URL を貼り付けてください。TikDD が MP4 を確認し、一時的なダウンロードを準備します。`, platformSupportedQ: (name) => `どの ${name} リンクに対応していますか？`, platformSupportedA: (name, stable, link) => `${name} の${stable ? "安定版" : "Beta"}ルートは、アカウントなしで開ける公開${link} URL に対応します。`, accountPlatformQ: (name) => `${name} アカウントは必要ですか？`, directAnswer: (name, stable, link) => `${name} ${stable ? "安定版" : "Beta"}ダウンローダーは公開${link} URL を受け付け、ページとルートが利用可能な場合に MP4 を表示します。`, guideTitle: "TikDD の使い方", guideIntro: "アクセス可能な公開動画を3つの手順でダウンロードします。", guidePaste: "対応プラットフォームの公開リンクを貼り付けます。", guideChoose: "表示された MP4 形式を確認して選択します。", guideDownload: "短時間有効なリンクを取得し、承認済みメディアホストからブラウザで受信します。", privacyTitle: "プライバシー", privacySummary: "TikDD はアカウント情報や非公開アクセスを求めず、公開メディアページを解析します。", termsTitle: "利用規約", termsSummary: "閲覧およびダウンロードする権利があるコンテンツにのみ TikDD を使用してください。", dataHeading: "データの範囲", dataBody: "リンクは指定された公開ページの解析にのみ使われ、短期タスクは運用後に期限切れになります。", thirdPartyHeading: "第三者ホスト", thirdPartyBody: "承認済みメディアホストが独自のポリシーに従ってファイルを配信する場合があります。", useHeading: "適切な利用", useBody: "非公開アクセス、ペイウォール、DRM、プラットフォーム制限を回避しないでください。", availabilityHeading: "可用性", availabilityBody: "サービスは現状のまま提供され、上流の変更や停止により公開リンクでも失敗する場合があります。", homeSeoTitle: "TikDD 公開動画ダウンローダー", homeSeoDescription: "X、Instagram、TikTok、Facebook、Vimeo、Pinterest の公開動画をダウンロード。リンクを貼り、MP4 を選んで保存できます。", platformSeoTitle: (name, stable) => `${name} 動画ダウンローダー${stable ? "" : " Beta"} | TikDD`, platformSeoDescription: (name, stable) => `TikDD の${stable ? "安定版" : "Beta"}手順で公開 ${name} 動画をダウンロード。URL を貼り付けて MP4 を選択できます。`, genericSeoTitle: { faq: "TikDD よくある質問", help: "TikDD 動画ダウンローダーの使い方", privacy: "TikDD プライバシー", terms: "TikDD 利用規約" }, genericSeoDescription: { faq: "対応リンク、公開コンテンツ、配信、プライバシー、TikDD の一般的なエラーについて説明します。", help: "公開 URL の貼り付け、MP4 の選択、TikDD でのダウンロード方法を説明します。", privacy: "TikDD における公開リンク、短期データ、メディア配信の扱いを説明します。", terms: "TikDD の利用、可用性、著作権、プラットフォーム規則の範囲を説明します。" }
  }
};

const shared = (locale: StarterLocale): AdminSharedContent => {
  const text = TEXT[locale];
  return AdminSharedContentSchema.parse({
    siteName: "TikDD", navigationLabel: text.home, footerTagline: text.footer,
    legalNoticeMarkdown: text.independent, defaultSocialTitle: text.socialTitle,
    defaultSocialDescription: text.socialDescription, defaultSocialImageAssetId: null,
    siteIntegrations: { googleAnalyticsMeasurementId: null, googleAdsensePublisherId: null }
  });
};

const homepageContent = (locale: StarterLocale): AdminPageContent => {
  const text = TEXT[locale];
  return AdminPageContentSchema.parse({
    template: "homepage", heroTitle: text.heroTitle, heroSubtitle: text.heroSubtitle,
    inputLabel: text.inputLabel, inputPlaceholder: text.placeholder, primaryActionLabel: text.action,
    supportedPlatformsTitle: text.supportedTitle, howItWorksTitle: text.howTitle,
    howItWorksSteps: [
      { title: text.paste, description: text.pasteDescription },
      { title: text.resolve, description: text.resolveDescription },
      { title: text.choose, description: text.chooseDescription }
    ],
    faqTitle: text.faqTitle,
    faqItems: [
      { question: text.supportedQuestion, answerMarkdown: text.supportedAnswer },
      { question: text.accountQuestion, answerMarkdown: text.accountAnswer },
      { question: text.failureQuestion, answerMarkdown: text.failureAnswer }
    ]
  });
};

const platformContent = (locale: StarterLocale, platform: StarterPlatform): AdminPageContent => {
  const text = TEXT[locale];
  const name = PLATFORM_NAMES[platform];
  const stable = platform === "tiktok";
  const link = text.platformLink[platform];
  return AdminPageContentSchema.parse({
    template: "platform", eyebrow: `${name} ${stable ? "Stable" : "Beta"}`,
    title: text.platformTitle(name, stable), introduction: text.platformIntro(name, link),
    limitationsMarkdown: text.publicOnly,
    howToSteps: [
      { title: text.paste, description: `${text.pasteDescription} (${name})` },
      { title: text.resolve, description: text.resolveDescription },
      { title: text.choose, description: text.chooseDescription }
    ],
    faqItems: [
      { question: text.platformSupportedQ(name), answerMarkdown: text.platformSupportedA(name, stable, link) },
      { question: text.accountPlatformQ(name), answerMarkdown: text.accountAnswer },
      { question: text.failureQuestion, answerMarkdown: text.failureAnswer }
    ],
    geo: {
      directAnswer: text.directAnswer(name, stable, link), reviewStatus: "reviewed",
      reviewedAt: "2026-09-26T00:00:00.000Z",
      sourceRefs: platform === "x" ? ["tikdd-workflow", "x-public-content"]
        : platform === "instagram" ? ["tikdd-workflow", "instagram-public-content"]
          : platform === "tiktok" ? ["tikdd-workflow", "tiktok-public-content"] : ["tikdd-workflow"]
    }
  });
};

const faqContent = (locale: StarterLocale): AdminPageContent => {
  const text = TEXT[locale];
  return AdminPageContentSchema.parse({ template: "faq", title: text.faqTitle, introduction: text.faqIntro,
    items: [
      { question: text.supportedQuestion, answerMarkdown: text.supportedAnswer },
      { question: text.accountQuestion, answerMarkdown: text.accountAnswer },
      { question: text.failureQuestion, answerMarkdown: text.failureAnswer }
    ] });
};

const guideContent = (locale: StarterLocale): AdminPageContent => {
  const text = TEXT[locale];
  return AdminPageContentSchema.parse({ template: "guide", title: text.guideTitle, introduction: text.guideIntro,
    sections: [
      { id: "paste", heading: `1. ${text.paste}`, bodyMarkdown: text.guidePaste },
      { id: "choose", heading: `2. ${text.resolve}`, bodyMarkdown: text.guideChoose },
      { id: "download", heading: `3. ${text.choose}`, bodyMarkdown: text.guideDownload }
    ] });
};

const legalContent = (locale: StarterLocale, kind: "privacy" | "terms"): AdminPageContent => {
  const text = TEXT[locale];
  return AdminPageContentSchema.parse({
    template: "legal", title: kind === "privacy" ? text.privacyTitle : text.termsTitle,
    summary: kind === "privacy" ? text.privacySummary : text.termsSummary,
    sections: kind === "privacy"
      ? [{ id: "data", heading: text.dataHeading, bodyMarkdown: text.dataBody }, { id: "third-party", heading: text.thirdPartyHeading, bodyMarkdown: text.thirdPartyBody }]
      : [{ id: "acceptable-use", heading: text.useHeading, bodyMarkdown: text.useBody }, { id: "availability", heading: text.availabilityHeading, bodyMarkdown: text.availabilityBody }]
  });
};

const PATHS: Record<StarterPageKey, string> = {
  home: "/", x: "/x-downloader", instagram: "/instagram-downloader", tiktok: "/tiktok-downloader",
  facebook: "/facebook-downloader", vimeo: "/vimeo-downloader", pinterest: "/pinterest-downloader",
  xhamster: "/xhamster-downloader", faq: "/faq", help: "/help", privacy: "/privacy", terms: "/terms"
};

const seo = (locale: StarterLocale, page: StarterPageKey): AdminSeoFields => {
  const text = TEXT[locale];
  const isPlatform = page in PLATFORM_NAMES;
  const stable = page === "tiktok";
  const title = page === "home" ? text.homeSeoTitle
    : isPlatform ? text.platformSeoTitle(PLATFORM_NAMES[page as StarterPlatform], stable)
      : text.genericSeoTitle[page as "faq" | "help" | "privacy" | "terms"];
  const description = page === "home" ? text.homeSeoDescription
    : isPlatform ? text.platformSeoDescription(PLATFORM_NAMES[page as StarterPlatform], stable)
      : text.genericSeoDescription[page as "faq" | "help" | "privacy" | "terms"];
  const reviewedDescription = (description.length < 40
    ? `${description} ${text.footer} ${text.failureAnswer}`
    : description).slice(0, 180);
  const publicSearchPage = page === "home" || isPlatform;
  return AdminSeoFieldsSchema.parse({
    localPath: PATHS[page], searchTitle: title, searchDescription: reviewedDescription,
    socialTitle: page === "home" ? title : null, socialDescription: page === "home" ? reviewedDescription : null,
    socialImageAssetId: null, indexable: publicSearchPage, includeInSitemap: publicSearchPage, redirectFrom: []
  });
};

export function starterPages(locale: StarterLocale): readonly StarterPageRecord[] {
  return [
    { pageId: "page_home", locale, pageType: "homepage", platform: null, content: homepageContent(locale), seo: seo(locale, "home") },
    { pageId: "page_faq", locale, pageType: "faq", platform: null, content: faqContent(locale), seo: seo(locale, "faq") },
    { pageId: "page_help", locale, pageType: "guide", platform: null, content: guideContent(locale), seo: seo(locale, "help") },
    { pageId: "page_privacy", locale, pageType: "legal", platform: null, content: legalContent(locale, "privacy"), seo: seo(locale, "privacy") },
    { pageId: "page_terms", locale, pageType: "legal", platform: null, content: legalContent(locale, "terms"), seo: seo(locale, "terms") },
    ...Object.keys(PLATFORM_NAMES).map((platform) => ({
      pageId: `page_${platform}`, locale, pageType: "platform" as const, platform,
      content: platformContent(locale, platform as StarterPlatform), seo: seo(locale, platform as StarterPlatform)
    }))
  ];
}

export function starterSharedContent(locale: StarterLocale): AdminSharedContent { return shared(locale); }
export function starterPageRecords(): readonly StarterPageRecord[] { return STARTER_LOCALES.flatMap((locale) => starterPages(locale)); }
export function starterSharedRecords(): readonly { locale: StarterLocale; content: AdminSharedContent }[] {
  return STARTER_LOCALES.map((locale) => ({ locale, content: starterSharedContent(locale) }));
}
