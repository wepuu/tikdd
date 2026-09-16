# Work Item 69 — FDown 缩略图与客户端保存修复

## Scope

FDown Facebook remains Experimental/Beta. This item restores its reviewed
`video_info.thumbnail` and adds a browser-owned CORS Blob save for the v2
`*.fbcdn.net` Delivery policy. Media continues to flow from the user's browser
to Meta CDN; TikDD Delivery only issues a one-use ticket and audited 302.

## Implementation

- Review only credential-free HTTPS image URLs on `*.xx.fbcdn.net`; image load
  errors use the existing Facebook icon fallback.
- Add optional `browserHandoff` to Delivery contracts and OpenAPI. Static host
  policy metadata selects `cors-download` for FDown v2 and `navigate` elsewhere.
- Browser saves use a 200 MiB cap, 120 second timeout, `credentials: omit`,
  `video/mp4` validation, bounded streaming, and a sanitized TikDD filename.
- Failed CORS, MIME, timeout, empty, or oversized responses show an explicit
  error and an `Open video` fallback that requests a new ticket without
  replaying FDown.

## Verification and release boundary

Tests cover thumbnail host/path validation, handoff compatibility, policy
selection, bounded Blob saves, and fallback behavior. No database migration,
media proxy, Service Worker, File System Access API, Provider-page handoff, or
production configuration change is included. Production rollout remains
unchanged until a separately authorized deployment and one real Facebook
browser verification.
