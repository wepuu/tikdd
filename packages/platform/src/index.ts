import {
  PlatformSummarySchema,
  type Platform,
  type PlatformSummary,
  type PlatformSupportStatus
} from "@tikdd/contracts";

export interface PlatformHostRule {
  hostname: string;
  allowSubdomains: boolean;
}

export interface PlatformDefinition {
  id: Platform;
  displayName: string;
  status: PlatformSupportStatus;
  source: "curated" | "yt-dlp";
  hosts: readonly PlatformHostRule[];
  extractorKeys: readonly string[];
}

const host = (hostname: string, allowSubdomains = true): PlatformHostRule => ({
  hostname,
  allowSubdomains
});

export const DEFAULT_PLATFORM_CATALOG: readonly PlatformDefinition[] = [
  {
    id: "tiktok",
    displayName: "TikTok",
    status: "experimental",
    source: "yt-dlp",
    hosts: [host("tiktok.com"), host("vm.tiktok.com", false), host("vt.tiktok.com", false)],
    extractorKeys: ["TikTok", "tiktok:user", "tiktok:live"]
  },
  {
    id: "youtube",
    displayName: "YouTube",
    status: "experimental",
    source: "yt-dlp",
    hosts: [host("youtube.com"), host("youtu.be", false)],
    extractorKeys: ["Youtube", "YoutubeYtBe", "youtube:tab"]
  },
  {
    id: "x",
    displayName: "X",
    status: "experimental",
    source: "yt-dlp",
    hosts: [host("x.com"), host("twitter.com")],
    extractorKeys: ["twitter", "twitter:card", "twitter:broadcast"]
  },
  {
    id: "instagram",
    displayName: "Instagram",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("instagram.com")],
    extractorKeys: ["Instagram", "instagram:story"]
  },
  {
    id: "facebook",
    displayName: "Facebook",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("facebook.com"), host("fb.watch", false)],
    extractorKeys: ["facebook", "facebook:reel"]
  },
  {
    id: "vimeo",
    displayName: "Vimeo",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("vimeo.com")],
    extractorKeys: ["vimeo", "vimeo:channel", "vimeo:user"]
  },
  {
    id: "dailymotion",
    displayName: "Dailymotion",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("dailymotion.com"), host("dai.ly", false)],
    extractorKeys: ["dailymotion", "dailymotion:playlist"]
  },
  {
    id: "reddit",
    displayName: "Reddit",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("reddit.com"), host("redd.it", false)],
    extractorKeys: ["Reddit"]
  },
  {
    id: "twitch",
    displayName: "Twitch",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("twitch.tv"), host("clips.twitch.tv", false)],
    extractorKeys: ["twitch:clips", "twitch:stream", "twitch:vod"]
  },
  {
    id: "soundcloud",
    displayName: "SoundCloud",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("soundcloud.com"), host("on.soundcloud.com")],
    extractorKeys: ["soundcloud", "soundcloud:set", "soundcloud:user"]
  },
  {
    id: "bilibili",
    displayName: "Bilibili",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("bilibili.com"), host("b23.tv", false)],
    extractorKeys: ["BiliBili", "BiliBiliBangumi", "BiliLive"]
  },
  {
    id: "douyin",
    displayName: "Douyin",
    status: "planned",
    source: "curated",
    hosts: [host("douyin.com"), host("iesdouyin.com")],
    extractorKeys: []
  },
  {
    id: "kuaishou",
    displayName: "Kuaishou",
    status: "planned",
    source: "curated",
    hosts: [host("kuaishou.com"), host("kuaishouapp.com")],
    extractorKeys: []
  },
  {
    id: "pinterest",
    displayName: "Pinterest",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("pinterest.com"), host("pin.it", false)],
    extractorKeys: ["Pinterest", "PinterestCollection"]
  },
  {
    id: "vk",
    displayName: "VK",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("vk.com")],
    extractorKeys: ["vk", "vk:wallpost"]
  },
  {
    id: "streamable",
    displayName: "Streamable",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("streamable.com")],
    extractorKeys: ["Streamable"]
  },
  {
    id: "tumblr",
    displayName: "Tumblr",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("tumblr.com")],
    extractorKeys: ["Tumblr"]
  },
  {
    id: "weibo",
    displayName: "Weibo",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("weibo.com"), host("weibo.cn")],
    extractorKeys: ["Weibo", "WeiboVideo"]
  },
  {
    id: "xiaohongshu",
    displayName: "Xiaohongshu / RedNote",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("xiaohongshu.com"), host("xhslink.com")],
    extractorKeys: ["XiaoHongShu"]
  },
  {
    id: "snapchat",
    displayName: "Snapchat",
    status: "planned",
    source: "curated",
    hosts: [host("snapchat.com")],
    extractorKeys: []
  },
  {
    id: "xigua",
    displayName: "Xigua Video",
    status: "planned",
    source: "yt-dlp",
    hosts: [host("ixigua.com")],
    extractorKeys: ["Ixigua"]
  },
  {
    id: "oasis",
    displayName: "Oasis",
    status: "planned",
    source: "curated",
    hosts: [host("oasis.weibo.cn")],
    extractorKeys: []
  },
  { id: "9gag", displayName: "9GAG", status: "planned", source: "yt-dlp", hosts: [host("9gag.com")], extractorKeys: ["NineGag"] },
  { id: "bandcamp", displayName: "Bandcamp", status: "planned", source: "yt-dlp", hosts: [host("bandcamp.com")], extractorKeys: ["Bandcamp"] },
  { id: "bitchute", displayName: "BitChute", status: "planned", source: "yt-dlp", hosts: [host("bitchute.com")], extractorKeys: ["BitChute"] },
  { id: "blogger", displayName: "Blogger", status: "planned", source: "yt-dlp", hosts: [host("blogspot.com")], extractorKeys: ["Blogger"] },
  { id: "buzzfeed", displayName: "BuzzFeed", status: "planned", source: "yt-dlp", hosts: [host("buzzfeed.com")], extractorKeys: ["BuzzFeed"] },
  { id: "espn", displayName: "ESPN", status: "planned", source: "yt-dlp", hosts: [host("espn.com"), host("espn.com.br"), host("espn.com.pe"), host("espn.in")], extractorKeys: ["ESPN"] },
  { id: "flickr", displayName: "Flickr", status: "planned", source: "yt-dlp", hosts: [host("flickr.com"), host("flic.kr", false)], extractorKeys: ["Flickr"] },
  { id: "imdb", displayName: "IMDb", status: "planned", source: "yt-dlp", hosts: [host("imdb.com")], extractorKeys: ["Imdb"] },
  { id: "imgur", displayName: "Imgur", status: "planned", source: "yt-dlp", hosts: [host("imgur.com")], extractorKeys: ["Imgur"] },
  { id: "kickstarter", displayName: "Kickstarter", status: "planned", source: "yt-dlp", hosts: [host("kickstarter.com")], extractorKeys: ["Kickstarter"] },
  { id: "likee", displayName: "Likee", status: "planned", source: "yt-dlp", hosts: [host("likee.com"), host("likee.video"), host("like.video")], extractorKeys: ["Likee"] },
  { id: "linkedin", displayName: "LinkedIn", status: "planned", source: "yt-dlp", hosts: [host("linkedin.com")], extractorKeys: ["LinkedIn", "LinkedInLearning"] },
  { id: "loom", displayName: "Loom", status: "planned", source: "yt-dlp", hosts: [host("loom.com")], extractorKeys: ["Loom"] },
  { id: "medal", displayName: "Medal", status: "planned", source: "yt-dlp", hosts: [host("medal.tv")], extractorKeys: ["MedalTV"] },
  { id: "mixcloud", displayName: "Mixcloud", status: "planned", source: "yt-dlp", hosts: [host("mixcloud.com")], extractorKeys: ["Mixcloud"] },
  { id: "odnoklassniki", displayName: "Odnoklassniki", status: "planned", source: "yt-dlp", hosts: [host("ok.ru")], extractorKeys: ["Odnoklassniki"] },
  { id: "periscope", displayName: "Periscope", status: "planned", source: "yt-dlp", hosts: [host("periscope.tv"), host("pscp.tv")], extractorKeys: ["Periscope"] },
  { id: "puhutv", displayName: "PuhuTV", status: "planned", source: "yt-dlp", hosts: [host("puhutv.com")], extractorKeys: ["PuhuTV"] },
  { id: "rumble", displayName: "Rumble", status: "planned", source: "yt-dlp", hosts: [host("rumble.com")], extractorKeys: ["Rumble"] },
  { id: "substack", displayName: "Substack", status: "planned", source: "yt-dlp", hosts: [host("substack.com")], extractorKeys: ["Substack"] },
  { id: "ted", displayName: "TED", status: "planned", source: "yt-dlp", hosts: [host("ted.com")], extractorKeys: ["TedTalk", "TedSeries", "TedPlaylist", "TedEmbed"] },
  { id: "telegram", displayName: "Telegram", status: "planned", source: "yt-dlp", hosts: [host("t.me", false)], extractorKeys: ["TelegramEmbed"] }
];

const TRACKING_PARAMETERS = new Set([
  "feature",
  "is_copy_url",
  "is_from_webapp",
  "s",
  "sender_device",
  "si",
  "source",
  "t",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export class UnsupportedPlatformError extends Error {
  constructor(message = "The URL does not belong to a supported platform.") {
    super(message);
    this.name = "UnsupportedPlatformError";
  }
}

function hostMatches(hostname: string, rule: PlatformHostRule): boolean {
  return (
    hostname === rule.hostname ||
    (rule.allowSubdomains && hostname.endsWith(`.${rule.hostname}`))
  );
}

function platformForHost(
  hostname: string,
  catalog: readonly PlatformDefinition[]
): Platform | null {
  const normalizedHost = hostname.toLowerCase().replace(/\.$/, "");
  const matches = catalog.flatMap((platform) =>
    platform.hosts
      .filter((rule) => hostMatches(normalizedHost, rule))
      .map((rule) => ({ platform: platform.id, specificity: rule.hostname.length }))
  );
  matches.sort((left, right) => right.specificity - left.specificity);
  return matches[0]?.platform ?? null;
}

function removeTrackingParameters(url: URL): void {
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key) || key.startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }
}

export function detectPlatform(
  input: string,
  catalog: readonly PlatformDefinition[] = DEFAULT_PLATFORM_CATALOG
): { platform: Platform; canonicalUrl: string } {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new UnsupportedPlatformError("Enter a valid public page URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsupportedPlatformError("Only HTTP and HTTPS URLs are accepted.");
  }
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) {
    throw new UnsupportedPlatformError("Embedded credentials and custom ports are not accepted.");
  }

  const platform = platformForHost(url.hostname, catalog);
  if (!platform) {
    throw new UnsupportedPlatformError();
  }

  url.protocol = "https:";
  url.port = "";
  url.hash = "";
  removeTrackingParameters(url);
  if (platform === "x") {
    url.hostname = "x.com";
  }

  return { platform, canonicalUrl: url.toString() };
}

export function listPlatformDefinitions(): readonly PlatformDefinition[] {
  return DEFAULT_PLATFORM_CATALOG;
}

export function listPlatformSummaries(
  providerCounts: ReadonlyMap<Platform, number> = new Map()
): PlatformSummary[] {
  return DEFAULT_PLATFORM_CATALOG.map((platform) =>
    PlatformSummarySchema.parse({
      id: platform.id,
      displayName: platform.displayName,
      status: platform.status,
      source: platform.source,
      providerCount: providerCounts.get(platform.id) ?? 0
    })
  );
}

export function isSupportedPlatformUrl(
  input: string,
  catalog: readonly PlatformDefinition[] = DEFAULT_PLATFORM_CATALOG
): boolean {
  try {
    detectPlatform(input, catalog);
    return true;
  } catch {
    return false;
  }
}
