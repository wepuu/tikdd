# Work Item 83 — VidDown Vimeo Beta implementation slice

## Scope

Baseline: merged Work Item 82 on `main` (`c5e3725`). This slice implements the next-step Vimeo
adapter and its audit boundaries. It does not activate production traffic.

## Evidence used

- Two owner-supplied public Vimeo samples were each resolved once from NL through VidDown's
  anonymous page-token flow; the raw sample URLs are intentionally not stored in the repository.
- Both responses were JSON with MP4 candidates. A single 1 KiB Range check for each sample returned
  `206 video/mp4`; the media host was `player.vimeo.com`. Thumbnail resources used `i.vimeocdn.com`.
- No full media file, raw response, token, cookie, source URL or signed CDN query was stored.

## Implementation

- Add `viddown-net` Vimeo-only adapter with a bounded page/token/API sequence and tolerant parser.
- Store only a sanitized success fixture and a no-media fixture. Provider URLs remain encrypted
  Delivery candidates and never cross the public result model.
- Add exact `player.vimeo.com` redirect policy, provider registration in API/Admin/Worker and
  fail-closed three-gate activation configuration.
- Disable automatic BullMQ replay after a VidDown provider attempt; sequential router fallback stays
  bounded for any later approved Vimeo provider.
- Add release/preflight gate checks and update the provider portfolio to show implementation-ready
  evidence remains deferred pending four negative fixtures and browser handoff evidence.

## Acceptance and release boundary

- Provider, Delivery, retry, activation and preflight tests pass; `pnpm check` remains required.
- `ENABLE_VIDDOWN_PROVIDER`, both approvals and the `viddown-net/vimeo/nl` rollout rule remain false/
  allocation `0` in production. No deployment or Vimeo public page is part of this item.
- A future release must first verify browser behavior: direct Vimeo navigation may open a player and
  is not equivalent to a saved file. If it cannot save reliably, keep this route disabled or add a
  separately reviewed client handoff without introducing a media proxy.
