export const locales = ["en", "zh-CN", "es", "fr", "de", "it", "tr", "pl", "ja"] as const;
export type Locale = (typeof locales)[number];

const baseCopy = {
  en: {
    nav: { home: "Home", features: "Features", process: "How it works", supported: "Supported platforms", faq: "FAQ", language: "中文" },
    hero: {
      badge: "TikTok stable · five platforms in Public Beta",
      lead: "Download ", accent: "public videos", tail: " from six supported platforms",
      description: "Paste a public X, Instagram, TikTok, Facebook, Vimeo, or Pinterest video URL. TikDD resolves the available formats and creates a short-lived download link."
    },
    form: {
      label: "Public video page URL",
      placeholder: "Paste a public X, Instagram, TikTok, Facebook, Vimeo, or Pinterest URL",
      action: "Download", working: "Checking formats", waiting: "Waiting for a supported public link",
      recognized: "link recognized.",
      resolving: "Resolving available formats", ready: "Formats ready",
      invalid: "Paste a recognized public video page link.", clear: "Clear link", result: "Select quality",
      preview: "Preview", example: "Example result", exampleTitle: "Mountain Lake 4K",
      exampleMeta: "Format choices appear after a link is resolved.",
      resolvedTitle: "Resolved media", resolvedPreview: "resolved media preview",
      formatsAvailable: "format choices", workingMeta: "TikDD is checking the available formats.",
      workingLonger: "Still checking available formats. Some supported links take longer; you can keep this page open.",
      columns: { quality: "Quality", format: "Format", video: "Video", audio: "Audio", container: "Container", action: "Action" },
      videoAudio: "Video + audio", videoOnly: "Video only", audioOnly: "Audio only",
      download: "Download", preparingDownload: "Starting download…", downloadAgain: "Download again",
      deliveryHandedOff: "The download was handed off to your browser. If it did not start, use Download again.",
      deliveryExpired: "This download link expired or was already used.", regenerateDownload: "Download again",
      statusLabel: "Task status",
      resolveError: "This link could not be resolved. Check that it is public and try again.",
      retryableTitle: "Temporarily unavailable", retryableDescription: "TikDD could not finish this request yet. Try the same link again shortly.", retryAction: "Try again", resolveAgainAction: "Download again",
      providerRateLimitedTitle: "Capacity temporarily reached", providerRateLimitedDescription: "TikDD's current provider capacity is temporarily full. Wait a while and try the same link again.",
      unavailableTitle: "Video unavailable", unavailableDescription: "This page may be private, restricted, removed, or unsupported. Use another public link you can access.",
      expiredTitle: "Result expired", expiredDescription: "The saved formats are no longer available. Download the link again to refresh them.",
      duplicateInProgress: "This link is already being processed. Try again shortly.",
      rateLimited: "Too many requests were submitted. Wait briefly and try again.",
      concurrencyLimited: "Too many resolution tasks are active. Try again shortly.",
      idempotencyConflict: "This request key was already used. Start a new resolution.",
      admissionUnavailable: "New resolution requests are temporarily unavailable. Try again shortly.",
      timeout: "Resolution is taking longer than expected. Try again shortly.",
      deliveryError: "This format is not available for secure delivery. Resolve the link again.",
      clientDownloadError: "The browser could not save this video from the media host.",
      clientDownloadTooLarge: "This video is larger than the 200 MiB browser download limit.",
      clientDownloadTimeout: "The browser download timed out. Try again or open the video.",
      clientDownloading: "Downloading from the media host…",
      openVideo: "Open video",
      expired: "This task expired. Download the link again."
    },
    features: [
      ["TikTok stable · five platforms in Public Beta", "Recognizes public X, Instagram, TikTok, Facebook, Vimeo, and Pinterest video URLs."],
      ["Clear formats", "Normalizes quality and media details into one consistent view."],
      ["Controlled delivery", "Uses short-lived delivery links instead of exposing upstream URLs."]
    ],
    supported: { label: "Supported:", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
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
        ["Which links can I use?", "TikDD accepts public X posts, public Instagram Reels or posts, TikTok videos, Facebook videos, Vimeo videos, and Pinterest video Pins. TikTok is stable; the other five platforms remain in public Beta."],
        ["Do I need an account?", "No. TikDD does not request your account, cookies, session ID, or access to private content."],
        ["Why can a recognized link fail?", "Private, paid, restricted, or recently changed pages may not resolve."]
      ]
    },
    trust: {
      title: "Designed around safe delivery", labels: "Scoped · Expiring · One use",
      description: "TikDD sends the public page URL to a third-party processing service. When available, the preview image loads from a reviewed third-party image host. Public results never include provider download URLs or secret headers."
    },
    page: { howItWorks: "How it works", faq: "Frequently asked questions", directAnswer: "Direct answer", sources: "Sources", lastReviewed: "Last reviewed" },
    legal: "TikDD is an independent tool and is not affiliated with X, Instagram, TikTok, Facebook, Vimeo, or Pinterest."
  },
  "zh-CN": {
    nav: { home: "首页", features: "功能", process: "工作方式", supported: "支持的平台", faq: "常见问题", language: "English" },
    hero: {
      badge: "TikTok 稳定支持 · 其余五个平台公开测试",
      lead: "下载六个平台的", accent: "公开视频", tail: "",
      description: "粘贴公开的 X、Instagram、TikTok、Facebook、Vimeo 或 Pinterest 视频链接，TikDD 会解析可用格式并生成短期下载链接。"
    },
    form: {
      label: "公开视频页面链接", placeholder: "粘贴公开的 X、Instagram、TikTok、Facebook、Vimeo 或 Pinterest 链接",
      action: "下载", working: "正在检查格式",
      waiting: "等待受支持的公开链接", recognized: "链接已识别。",
      resolving: "正在解析可用格式", ready: "格式已就绪",
      invalid: "请粘贴可识别的公开视频页面链接。", clear: "清除链接", result: "选择清晰度",
      preview: "预览", example: "示例结果", exampleTitle: "山间湖泊 4K", exampleMeta: "链接解析完成后将在这里显示可用格式。",
      resolvedTitle: "已解析媒体", resolvedPreview: "已解析媒体预览",
      formatsAvailable: "种可用格式", workingMeta: "TikDD 正在检查可用格式。",
      workingLonger: "仍在检查可用格式。部分受支持链接需要更长时间，你可以保持本页打开。",
      columns: { quality: "清晰度", format: "格式", video: "视频", audio: "音频", container: "封装", action: "操作" },
      videoAudio: "视频 + 音频", videoOnly: "仅视频", audioOnly: "仅音频",
      download: "下载", preparingDownload: "正在开始下载…", downloadAgain: "再次下载",
      deliveryHandedOff: "下载已交给浏览器处理。如果没有开始，请点击“再次下载”。",
      deliveryExpired: "下载链接已过期或已使用。", regenerateDownload: "再次下载",
      statusLabel: "任务状态",
      resolveError: "无法解析该链接，请确认页面公开后重试。",
      retryableTitle: "暂时无法完成", retryableDescription: "TikDD 暂时未能完成本次请求，请稍后使用同一链接重试。", retryAction: "重试", resolveAgainAction: "再次下载",
      providerRateLimitedTitle: "当前解析额度已满", providerRateLimitedDescription: "当前第三方解析额度暂时用完，请稍后使用同一链接重试。",
      unavailableTitle: "视频不可用", unavailableDescription: "页面可能为私密、受限、已删除或暂不支持。请使用你有权访问的其他公开链接。",
      expiredTitle: "解析结果已过期", expiredDescription: "已保存的格式不再可用，请重新解析链接以刷新结果。",
      duplicateInProgress: "该链接正在处理中，请稍后重试。",
      rateLimited: "提交请求过于频繁，请稍后重试。",
      concurrencyLimited: "当前活动解析任务过多，请稍后重试。",
      idempotencyConflict: "该请求标识已被使用，请重新发起解析。",
      admissionUnavailable: "暂时无法接收新的解析请求，请稍后重试。",
      timeout: "解析时间超出预期，请稍后重试。",
      deliveryError: "该格式暂时无法安全交付，请重新解析链接。", clientDownloadError: "浏览器无法从媒体主机保存此视频。", clientDownloadTooLarge: "视频超过 200 MiB 的浏览器下载限制。", clientDownloadTimeout: "浏览器下载超时，请重试或打开视频。", clientDownloading: "正在从媒体主机下载…", openVideo: "打开视频", expired: "任务已经过期，请重新解析链接。"
    },
    features: [
      ["TikTok 稳定支持 · 其余五个平台公开测试", "识别公开的 X、Instagram、TikTok、Facebook、Vimeo 与 Pinterest 视频链接。"],
      ["格式清晰", "将清晰度和媒体信息统一为一致的选择界面。"],
      ["受控交付", "使用短期交付链接，不公开上游媒体地址。"]
    ],
    supported: { label: "支持的平台：", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
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
        ["可以使用哪些链接？", "TikDD 支持公开的 X 帖子、公开的 Instagram Reel 或帖子、TikTok 视频、Facebook 视频、Vimeo 视频与 Pinterest 视频 Pin。TikTok 已稳定支持，其余五个平台仍处于公开测试。"],
        ["需要创建账号吗？", "不需要。TikDD 不会索取你的账号、Cookie、sessionid，也不会访问私密内容。"],
        ["为什么已识别的链接仍可能失败？", "私密、付费、受限或近期结构发生变化的页面可能无法解析。"]
      ]
    },
    trust: {
      title: "围绕安全交付设计", labels: "限定范围 · 短期有效 · 单次使用",
      description: "TikDD 会将公开页面链接发送给第三方处理服务。可用时，预览图会从经过审核的第三方图片主机加载。公开结果不会包含第三方下载地址或私密请求头。"
    },
    page: { howItWorks: "使用方法", faq: "常见问题", directAnswer: "直接回答", sources: "参考来源", lastReviewed: "最近审核" },
    legal: "TikDD 是独立工具，与 X、Instagram、TikTok、Facebook、Vimeo 或 Pinterest 不存在隶属关系。"
  }
} as const;

type Widen<T> = T extends string ? string : T extends readonly (infer Item)[] ? Widen<Item>[] : T extends object ? { -readonly [Key in keyof T]: Widen<T[Key]> } : T;
export type SiteCopy = Widen<(typeof baseCopy)["en"]>;

type LocaleOverride = {
  nav: SiteCopy["nav"];
  hero: SiteCopy["hero"];
  form: Partial<SiteCopy["form"]>;
  features: SiteCopy["features"];
  supported: SiteCopy["supported"];
  process: SiteCopy["process"];
  faq: SiteCopy["faq"];
  trust: SiteCopy["trust"];
  page: SiteCopy["page"];
  legal: string;
};

const additionalCopy: Record<Exclude<Locale, "en" | "zh-CN">, LocaleOverride> = {
  es: {
    nav: { home: "Inicio", features: "Funciones", process: "Cómo funciona", supported: "Plataformas", faq: "Preguntas", language: "Idioma" },
    hero: { badge: "Seis plataformas compatibles", lead: "Descarga ", accent: "vídeos públicos", tail: " de seis plataformas", description: "Pega una URL pública de X, Instagram, TikTok, Facebook, Vimeo o Pinterest. TikDD comprueba los formatos y prepara una descarga temporal." },
    form: { label: "URL de la página pública del vídeo", placeholder: "Pega una URL pública compatible", action: "Descargar", working: "Comprobando formatos", waiting: "Esperando un enlace público compatible", recognized: "enlace reconocido.", resolving: "Comprobando formatos disponibles", ready: "Formatos listos", invalid: "Pega un enlace público de vídeo reconocido.", clear: "Borrar enlace", result: "Selecciona la calidad", preview: "Vista previa", formatsAvailable: "formatos disponibles", download: "Descargar", preparingDownload: "Iniciando descarga…", downloadAgain: "Descargar de nuevo", retryAction: "Reintentar", resolveAgainAction: "Descargar de nuevo", statusLabel: "Estado de la tarea" },
    features: [["Seis plataformas compatibles", "Reconoce vídeos públicos de X, Instagram, TikTok, Facebook, Vimeo y Pinterest."], ["Formatos claros", "Presenta la calidad y los datos multimedia de forma coherente."], ["Entrega controlada", "Usa enlaces temporales sin revelar URL del proveedor."]],
    supported: { label: "Compatibles:", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "Cómo funciona", steps: [["Pega la URL", "Copia arriba un enlace público."], ["Comprueba formatos", "TikDD identifica la plataforma y revisa los formatos."], ["Descarga", "Elige un formato y solicita el enlace temporal."]] },
    faq: { title: "Preguntas frecuentes", items: [["¿Qué enlaces puedo usar?", "Páginas públicas de vídeo de las seis plataformas compatibles."], ["¿Necesito una cuenta?", "No. TikDD no solicita cuentas, cookies ni contenido privado."], ["¿Por qué puede fallar?", "El contenido privado, limitado, eliminado o modificado puede no resolverse."]] },
    trust: { title: "Diseñado para una entrega segura", labels: "Limitado · Temporal · Un solo uso", description: "TikDD procesa el enlace público y entrega el archivo mediante hosts multimedia revisados." },
    page: { howItWorks: "Cómo funciona", faq: "Preguntas frecuentes", directAnswer: "Respuesta directa", sources: "Fuentes", lastReviewed: "Última revisión" },
    legal: "TikDD es una herramienta independiente y no está afiliada con las plataformas compatibles."
  },
  fr: {
    nav: { home: "Accueil", features: "Fonctions", process: "Fonctionnement", supported: "Plateformes", faq: "FAQ", language: "Langue" },
    hero: { badge: "Six plateformes compatibles", lead: "Téléchargez des ", accent: "vidéos publiques", tail: " depuis six plateformes", description: "Collez une URL publique X, Instagram, TikTok, Facebook, Vimeo ou Pinterest. TikDD vérifie les formats et prépare un téléchargement temporaire." },
    form: { label: "URL de la page vidéo publique", placeholder: "Collez une URL publique compatible", action: "Télécharger", working: "Vérification des formats", waiting: "En attente d’un lien public compatible", recognized: "lien reconnu.", resolving: "Vérification des formats disponibles", ready: "Formats prêts", invalid: "Collez un lien vidéo public reconnu.", clear: "Effacer", result: "Choisir la qualité", preview: "Aperçu", formatsAvailable: "formats disponibles", download: "Télécharger", preparingDownload: "Démarrage du téléchargement…", downloadAgain: "Télécharger à nouveau", retryAction: "Réessayer", resolveAgainAction: "Télécharger à nouveau", statusLabel: "État de la tâche" },
    features: [["Six plateformes compatibles", "Reconnaît les vidéos publiques de X, Instagram, TikTok, Facebook, Vimeo et Pinterest."], ["Formats clairs", "Présente la qualité et les détails média de façon cohérente."], ["Livraison contrôlée", "Utilise des liens temporaires sans exposer les URL fournisseur."]],
    supported: { label: "Compatibles :", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "Comment ça marche", steps: [["Collez l’URL", "Copiez un lien vidéo public."], ["Vérifiez les formats", "TikDD identifie la plateforme et les formats."], ["Téléchargez", "Choisissez un format et demandez le lien temporaire."]] },
    faq: { title: "Questions fréquentes", items: [["Quels liens puis-je utiliser ?", "Les pages vidéo publiques des six plateformes compatibles."], ["Faut-il un compte ?", "Non. TikDD ne demande ni compte, ni cookie, ni contenu privé."], ["Pourquoi un échec ?", "Un contenu privé, limité, supprimé ou modifié peut échouer."]] },
    trust: { title: "Conçu pour une livraison sûre", labels: "Limité · Temporaire · Usage unique", description: "TikDD traite le lien public et livre le fichier via des hôtes média vérifiés." },
    page: { howItWorks: "Comment ça marche", faq: "Questions fréquentes", directAnswer: "Réponse directe", sources: "Sources", lastReviewed: "Dernière vérification" },
    legal: "TikDD est un outil indépendant, sans affiliation avec les plateformes compatibles."
  },
  de: {
    nav: { home: "Startseite", features: "Funktionen", process: "Ablauf", supported: "Plattformen", faq: "FAQ", language: "Sprache" },
    hero: { badge: "Sechs unterstützte Plattformen", lead: "Öffentliche ", accent: "Videos herunterladen", tail: " – von sechs Plattformen", description: "Füge eine öffentliche X-, Instagram-, TikTok-, Facebook-, Vimeo- oder Pinterest-URL ein. TikDD prüft Formate und bereitet den Download vor." },
    form: { label: "URL der öffentlichen Videoseite", placeholder: "Unterstützte öffentliche URL einfügen", action: "Herunterladen", working: "Formate werden geprüft", waiting: "Warten auf einen unterstützten Link", recognized: "Link erkannt.", resolving: "Verfügbare Formate werden geprüft", ready: "Formate bereit", invalid: "Füge einen erkannten öffentlichen Videolink ein.", clear: "Link löschen", result: "Qualität wählen", preview: "Vorschau", formatsAvailable: "verfügbare Formate", download: "Herunterladen", preparingDownload: "Download startet…", downloadAgain: "Erneut herunterladen", retryAction: "Erneut versuchen", resolveAgainAction: "Erneut herunterladen", statusLabel: "Aufgabenstatus" },
    features: [["Sechs unterstützte Plattformen", "Erkennt öffentliche Videos von X, Instagram, TikTok, Facebook, Vimeo und Pinterest."], ["Klare Formate", "Zeigt Qualität und Mediendetails einheitlich an."], ["Kontrollierte Auslieferung", "Verwendet kurzlebige Links ohne Provider-URLs offenzulegen."]],
    supported: { label: "Unterstützt:", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "So funktioniert es", steps: [["URL einfügen", "Kopiere einen öffentlichen Videolink."], ["Formate prüfen", "TikDD erkennt Plattform und Formate."], ["Herunterladen", "Wähle ein Format und fordere den Link an."]] },
    faq: { title: "Häufige Fragen", items: [["Welche Links kann ich verwenden?", "Öffentliche Videoseiten der sechs unterstützten Plattformen."], ["Brauche ich ein Konto?", "Nein. TikDD verlangt keine Konten, Cookies oder privaten Inhalte."], ["Warum kann es scheitern?", "Private, eingeschränkte, gelöschte oder geänderte Inhalte können fehlschlagen."]] },
    trust: { title: "Für sichere Auslieferung entwickelt", labels: "Begrenzt · Kurzlebig · Einmalig", description: "TikDD verarbeitet den öffentlichen Link und liefert über geprüfte Medienhosts aus." },
    page: { howItWorks: "So funktioniert es", faq: "Häufige Fragen", directAnswer: "Direkte Antwort", sources: "Quellen", lastReviewed: "Zuletzt geprüft" },
    legal: "TikDD ist unabhängig und nicht mit den unterstützten Plattformen verbunden."
  },
  it: {
    nav: { home: "Home", features: "Funzioni", process: "Come funziona", supported: "Piattaforme", faq: "FAQ", language: "Lingua" },
    hero: { badge: "Sei piattaforme supportate", lead: "Scarica ", accent: "video pubblici", tail: " da sei piattaforme", description: "Incolla un URL pubblico di X, Instagram, TikTok, Facebook, Vimeo o Pinterest. TikDD verifica i formati e prepara un download temporaneo." },
    form: { label: "URL della pagina video pubblica", placeholder: "Incolla un URL pubblico supportato", action: "Scarica", working: "Verifica dei formati", waiting: "In attesa di un link pubblico supportato", recognized: "link riconosciuto.", resolving: "Verifica dei formati disponibili", ready: "Formati pronti", invalid: "Incolla un link video pubblico riconosciuto.", clear: "Cancella link", result: "Scegli la qualità", preview: "Anteprima", formatsAvailable: "formati disponibili", download: "Scarica", preparingDownload: "Avvio download…", downloadAgain: "Scarica di nuovo", retryAction: "Riprova", resolveAgainAction: "Scarica di nuovo", statusLabel: "Stato attività" },
    features: [["Sei piattaforme supportate", "Riconosce video pubblici di X, Instagram, TikTok, Facebook, Vimeo e Pinterest."], ["Formati chiari", "Mostra qualità e dettagli multimediali in modo coerente."], ["Consegna controllata", "Usa link temporanei senza esporre gli URL del provider."]],
    supported: { label: "Supportate:", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "Come funziona", steps: [["Incolla l’URL", "Copia un link video pubblico."], ["Verifica i formati", "TikDD identifica piattaforma e formati."], ["Scarica", "Scegli un formato e richiedi il link temporaneo."]] },
    faq: { title: "Domande frequenti", items: [["Quali link posso usare?", "Pagine video pubbliche delle sei piattaforme supportate."], ["Serve un account?", "No. TikDD non richiede account, cookie o contenuti privati."], ["Perché può fallire?", "I contenuti privati, limitati, eliminati o modificati possono fallire."]] },
    trust: { title: "Progettato per una consegna sicura", labels: "Limitato · Temporaneo · Monouso", description: "TikDD elabora il link pubblico e consegna tramite host multimediali verificati." },
    page: { howItWorks: "Come funziona", faq: "Domande frequenti", directAnswer: "Risposta diretta", sources: "Fonti", lastReviewed: "Ultima revisione" },
    legal: "TikDD è indipendente e non è affiliato alle piattaforme supportate."
  },
  tr: {
    nav: { home: "Ana sayfa", features: "Özellikler", process: "Nasıl çalışır", supported: "Platformlar", faq: "SSS", language: "Dil" },
    hero: { badge: "Desteklenen altı platform", lead: "Altı platformdan ", accent: "herkese açık video", tail: " indirin", description: "Herkese açık X, Instagram, TikTok, Facebook, Vimeo veya Pinterest URL'si yapıştırın. TikDD formatları denetler ve geçici indirme hazırlar." },
    form: { label: "Herkese açık video sayfası URL'si", placeholder: "Desteklenen herkese açık URL'yi yapıştırın", action: "İndir", working: "Formatlar denetleniyor", waiting: "Desteklenen bağlantı bekleniyor", recognized: "bağlantı tanındı.", resolving: "Kullanılabilir formatlar denetleniyor", ready: "Formatlar hazır", invalid: "Tanınan bir herkese açık video bağlantısı yapıştırın.", clear: "Bağlantıyı temizle", result: "Kalite seçin", preview: "Önizleme", formatsAvailable: "kullanılabilir format", download: "İndir", preparingDownload: "İndirme başlatılıyor…", downloadAgain: "Yeniden indir", retryAction: "Yeniden dene", resolveAgainAction: "Yeniden indir", statusLabel: "Görev durumu" },
    features: [["Desteklenen altı platform", "X, Instagram, TikTok, Facebook, Vimeo ve Pinterest videolarını tanır."], ["Net formatlar", "Kalite ve medya ayrıntılarını tutarlı gösterir."], ["Kontrollü teslimat", "Provider URL'lerini göstermeden geçici bağlantılar kullanır."]],
    supported: { label: "Desteklenen:", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "Nasıl çalışır", steps: [["URL'yi yapıştırın", "Herkese açık video bağlantısını kopyalayın."], ["Formatları denetleyin", "TikDD platformu ve formatları belirler."], ["İndirin", "Formatı seçip geçici bağlantıyı isteyin."]] },
    faq: { title: "Sık sorulan sorular", items: [["Hangi bağlantıları kullanabilirim?", "Desteklenen altı platformun herkese açık video sayfaları."], ["Hesap gerekir mi?", "Hayır. TikDD hesap, çerez veya özel içerik istemez."], ["Neden başarısız olabilir?", "Özel, kısıtlı, silinmiş veya değişmiş içerik başarısız olabilir."]] },
    trust: { title: "Güvenli teslimat için tasarlandı", labels: "Sınırlı · Geçici · Tek kullanımlık", description: "TikDD herkese açık bağlantıyı işler ve incelenmiş medya sunucularından teslim eder." },
    page: { howItWorks: "Nasıl çalışır", faq: "Sık sorulan sorular", directAnswer: "Kısa yanıt", sources: "Kaynaklar", lastReviewed: "Son inceleme" },
    legal: "TikDD bağımsızdır ve desteklenen platformlarla bağlantılı değildir."
  },
  pl: {
    nav: { home: "Strona główna", features: "Funkcje", process: "Jak to działa", supported: "Platformy", faq: "FAQ", language: "Język" },
    hero: { badge: "Sześć obsługiwanych platform", lead: "Pobieraj ", accent: "publiczne filmy", tail: " z sześciu platform", description: "Wklej publiczny adres X, Instagram, TikTok, Facebook, Vimeo lub Pinterest. TikDD sprawdzi formaty i przygotuje tymczasowe pobieranie." },
    form: { label: "Adres publicznej strony filmu", placeholder: "Wklej obsługiwany publiczny adres", action: "Pobierz", working: "Sprawdzanie formatów", waiting: "Oczekiwanie na obsługiwany link", recognized: "link rozpoznany.", resolving: "Sprawdzanie dostępnych formatów", ready: "Formaty gotowe", invalid: "Wklej rozpoznany publiczny link do filmu.", clear: "Wyczyść link", result: "Wybierz jakość", preview: "Podgląd", formatsAvailable: "dostępne formaty", download: "Pobierz", preparingDownload: "Rozpoczynanie pobierania…", downloadAgain: "Pobierz ponownie", retryAction: "Spróbuj ponownie", resolveAgainAction: "Pobierz ponownie", statusLabel: "Stan zadania" },
    features: [["Sześć obsługiwanych platform", "Rozpoznaje publiczne filmy z X, Instagrama, TikToka, Facebooka, Vimeo i Pinteresta."], ["Czytelne formaty", "Pokazuje jakość i informacje o mediach w spójny sposób."], ["Kontrolowane dostarczanie", "Używa krótkotrwałych linków bez ujawniania adresów providera."]],
    supported: { label: "Obsługiwane:", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "Jak to działa", steps: [["Wklej URL", "Skopiuj publiczny link do filmu."], ["Sprawdź formaty", "TikDD rozpoznaje platformę i formaty."], ["Pobierz", "Wybierz format i poproś o tymczasowy link."]] },
    faq: { title: "Najczęstsze pytania", items: [["Jakich linków mogę używać?", "Publicznych stron filmów z sześciu obsługiwanych platform."], ["Czy potrzebuję konta?", "Nie. TikDD nie wymaga kont, plików cookie ani prywatnych treści."], ["Dlaczego może nie działać?", "Treści prywatne, ograniczone, usunięte lub zmienione mogą nie działać."]] },
    trust: { title: "Zaprojektowane z myślą o bezpiecznym pobieraniu", labels: "Ograniczone · Tymczasowe · Jednorazowe", description: "TikDD przetwarza publiczny link i dostarcza plik przez sprawdzone hosty mediów." },
    page: { howItWorks: "Jak to działa", faq: "Najczęstsze pytania", directAnswer: "Krótka odpowiedź", sources: "Źródła", lastReviewed: "Ostatnia weryfikacja" },
    legal: "TikDD jest niezależne i nie jest powiązane z obsługiwanymi platformami."
  },
  ja: {
    nav: { home: "ホーム", features: "機能", process: "使い方", supported: "対応サイト", faq: "よくある質問", language: "言語" },
    hero: { badge: "6つの対応プラットフォーム", lead: "6つのサイトから", accent: "公開動画", tail: "をダウンロード", description: "公開されている X、Instagram、TikTok、Facebook、Vimeo、Pinterest の URL を貼り付けると、TikDD が形式を確認して一時的なダウンロードを準備します。" },
    form: { label: "公開動画ページの URL", placeholder: "対応する公開 URL を貼り付け", action: "ダウンロード", working: "形式を確認中", waiting: "対応する公開リンクを待っています", recognized: "リンクを認識しました。", resolving: "利用可能な形式を確認中", ready: "形式を選択できます", invalid: "認識可能な公開動画リンクを貼り付けてください。", clear: "リンクを消去", result: "画質を選択", preview: "プレビュー", formatsAvailable: "件の形式", download: "ダウンロード", preparingDownload: "ダウンロードを開始中…", downloadAgain: "もう一度ダウンロード", retryAction: "再試行", resolveAgainAction: "もう一度ダウンロード", statusLabel: "タスクの状態" },
    features: [["6つの対応プラットフォーム", "X、Instagram、TikTok、Facebook、Vimeo、Pinterest の公開動画を認識します。"], ["明確な形式", "画質とメディア情報を統一して表示します。"], ["安全性を確認した配信", "上流 URL を公開せず、短時間有効なリンクを使用します。"]],
    supported: { label: "対応：", platforms: ["X", "Instagram", "TikTok", "Facebook", "Vimeo", "Pinterest"] },
    process: { title: "使い方", steps: [["URL を貼り付ける", "公開動画ページのリンクをコピーします。"], ["形式を確認する", "TikDD がサイトと利用可能な形式を確認します。"], ["ダウンロードする", "形式を選び、一時的なリンクを取得します。"]] },
    faq: { title: "よくある質問", items: [["どのリンクを使用できますか？", "6つの対応プラットフォームの公開動画ページです。"], ["アカウントは必要ですか？", "不要です。TikDD はアカウント、Cookie、非公開コンテンツを要求しません。"], ["失敗するのはなぜですか？", "非公開、制限、削除、仕様変更されたコンテンツは失敗する場合があります。"]] },
    trust: { title: "安全な配信を重視した設計", labels: "範囲限定 · 短時間 · 1回限り", description: "TikDD は公開リンクを処理し、確認済みのメディアホストからファイルを配信します。" },
    page: { howItWorks: "使い方", faq: "よくある質問", directAnswer: "要点", sources: "参照元", lastReviewed: "最終確認" },
    legal: "TikDD は独立したツールであり、対応プラットフォームとは提携していません。"
  }
};

const copy = Object.fromEntries(locales.map((locale) => {
  if (locale === "en" || locale === "zh-CN") return [locale, baseCopy[locale]];
  const extra = additionalCopy[locale];
  return [locale, { ...baseCopy.en, ...extra, form: { ...baseCopy.en.form, ...extra.form } }];
})) as Record<Locale, SiteCopy>;

export function isLocale(value: string): value is Locale { return locales.includes(value as Locale); }
export function getCopy(locale: Locale): SiteCopy { return copy[locale]; }
