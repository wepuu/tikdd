# Platform catalog

The TikDD platform catalog is a curated product taxonomy, not a copy of every yt-dlp extractor. A
platform is a stable family such as `youtube`, `instagram`, or `bilibili`; an extractor is an
implementation detail that may represent a video, playlist, live stream, embed, or legacy hostname.

## Why the catalog is separate

- Product URLs, analytics, translations, provider priorities, and operational status need stable
  identifiers even when upstream extractors are renamed.
- Multiple providers can support the same platform, and one provider can support many platforms.
- Host admission must remain explicit to avoid turning a generic extractor into an SSRF surface.
- The yt-dlp supported-sites list changes frequently and explicitly does not guarantee that every
  listed site currently works. It is discovery input, not a TikDD service-level promise.

The source of truth is `DEFAULT_PLATFORM_CATALOG` in `@tikdd/platform`. Each entry contains:

- a lowercase stable slug and display name;
- product status: `stable`, `experimental`, `planned`, or `paused`;
- explicit hostname/subdomain rules;
- optional yt-dlp extractor keys for traceability;
- source: manually curated or discovered from yt-dlp.

## Product status

| Status | API recognition | Resolver eligibility | Indexable platform page |
| --- | --- | --- | --- |
| `planned` | Yes, for early validation | Only in development/internal flags | No |
| `experimental` | Yes | Yes where an enabled provider exists | No by default |
| `stable` | Yes | Yes | Yes after locale content review |
| `paused` | Recognized with an unavailable message | No | Removed from sitemap/index |

Recognition and availability are intentionally different. The public catalog endpoint reports both
status and the count of active production providers once the registry snapshot is wired to the API.

## Seed platform families

The initial catalog covers 22 families: TikTok, YouTube, X, Instagram, Facebook, Vimeo, Dailymotion,
Reddit, Twitch, SoundCloud, Bilibili, Douyin, Kuaishou, Pinterest, VK, Streamable, Tumblr, Weibo,
Xiaohongshu/RedNote, Snapchat, Xigua, and Oasis. This is a starting set for adapter research, not a
production support claim.

## Adding a platform

1. Choose one stable family slug; do not create separate product platforms for video, playlist,
   shorts, reels, live, or embed extractors unless their product behavior genuinely differs.
2. Add exact hostname rules and explicit subdomain behavior. Add short-link hosts separately.
3. Add detector tests for common, mobile, embed, and spoofed domains.
4. Map relevant extractor keys or record `curated` when no yt-dlp mapping exists.
5. Start at `planned`. Add at least one provider manifest capability and an authorized canary corpus.
6. Promote status only after the operational gate in the development roadmap is met.
7. Add localized SEO pages only after promotion to `stable` and editorial review.

## Planned yt-dlp synchronization

A build-time script will run the pinned yt-dlp image to produce a versioned extractor snapshot. A
review job will diff new, renamed, and removed extractors and propose catalog changes. It must never
automatically add host rules, publish SEO pages, or enable resolution. Unknown URLs remain rejected
until a reviewed catalog rule exists.

References:

- [yt-dlp supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- [yt-dlp plugin and extractor documentation](https://github.com/yt-dlp/yt-dlp/blob/master/README.md)
