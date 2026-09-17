# Work Item 74 — Facebook Beta productization and bounded dual routing

Status: completed and deployed from `main@023160b0973c4b715abd429e1a4129a14e8da27b`.

## Scope

Facebook is now a public Beta capability. FDown Isuru remains the primary Provider and
SocialDownloader.space is the bounded secondary route in NL. The route is limited to Facebook;
SocialDownloader X, TikTok, Instagram and YouTube capabilities remain out of production scope.

The public homepage and starter content identify Facebook as Beta. Facebook is not added to the
sitemap or a stable platform landing page. Analytics accepts the coarse `facebook` platform label
without sending URLs, task IDs, Provider names or media metadata. The Admin route workspace already
projects the exact provider/platform/region tuple, rollout allocation, gates, circuit and fallback
order; no new persistence or audit model is introduced.

## Delivery decision

SocialDownloader remains on `socialdownloader-space-facebook-media-v1` with `browserHandoff:
"navigate"`. A fresh low-frequency NL probe did not return a verifiable media response, so this
release does not claim CORS or automatic browser-save support. The one-use Delivery ticket and
reviewed `/api/video` redirect remain unchanged; TikDD never proxies media bytes or sends users to
the Provider homepage. If the browser opens a media stream/player, the UI describes that as the
Beta handoff. A future `cors-download` policy requires a new protocol and browser-save audit.

## Tests and release

- Keep the SocialDownloader parser, exact host/path policy, one-request boundary and bounded
  FDown → SocialDownloader fallback tests.
- Add Facebook to Web copy, platform icon/analytics coverage and starter SEO metadata while keeping
  Facebook out of sitemap/stable-page tests.
- Run targeted Web/provider/delivery/Admin tests, `pnpm check`, and `git diff --check`.
- After CI and merge, deploy the GitHub SHA image with the existing SocialDownloader gates and
  rollout unchanged. Perform one FDown primary and one controlled SocialDownloader fallback browser
  check, then observe for ten minutes. Any failure first disables the SocialDownloader rollout and
  then its three gates; FDown remains the recovery route.

## Explicit non-goals

No new Provider adapter, public CDN URL, media proxy, database migration, Admin lifecycle change,
calibration, sitemap entry, or SocialDownloader platform expansion is included.

## Production closeout

After deployment, the owner manually verified four public Facebook samples covering Reel and shared
video links. All four completed a browser download successfully. The evidence is recorded as a
count only; raw sample URLs and upstream media addresses are not stored in the repository.
