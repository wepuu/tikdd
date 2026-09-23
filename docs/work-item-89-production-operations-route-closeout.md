# Work Item 89 — Production operations and route closeout

## Baseline and objective

Work Item 89 starts from deployed `main@714439be54485efb29d95868d13410447c35ee6e`.
It closes the first production acceptance pass for the Work Item 88 Admin changes, reconciles
download metrics against PostgreSQL, freezes the existing Provider order, and prepares Pinterest
for one separately authorized Beta activation. It does not call a Provider or change traffic while
the code and operational checks are prepared.

## Production acceptance findings

- The active `tikdd` content snapshot is revision 5 and propagated. Both Google Analytics and
  AdSense identifiers are present in that published snapshot; the matching draft and published
  default-locale revisions are aligned.
- Both localized home pages return HTTP 200 with the code-owned Analytics and AdSense resources.
  `/ads.txt` returns one valid Google publisher record. Google account review, Auto Ads decisions,
  consent requirements, and client-side blockers remain external to TikDD.
- The Admin download funnel matches direct PostgreSQL aggregates. User tasks are grouped by task
  creation time; Provider attempts, ticket creation, redirect validation, and browser handoff are
  grouped by their own event timestamps. Active tasks are excluded from the terminal task success
  denominator. A browser handoff is not represented as a saved file.
- The production containers use the exact GitHub image revision, are healthy, and the Worker runs
  configuration revision `wi88-admin-growth-truth-714439be`. Calibration remains off and Admin
  remains on for the owner workflow.

## Corrective implementation

- The Admin API now uses the same validated SocialDownloader platform list parser as the Worker.
  Its reviewed delivery modes therefore reflect the production `facebook,x` approval and Delivery
  boundary instead of silently falling back to the adapter constructor default.
- The Downloads workspace now renders only platforms with an observed event in the selected
  window. Zero-data capabilities remain available in the Providers workspace and no longer create
  a long wall of empty cards or misleading “Beta” labels.
- A production route matrix test freezes the intended manifest order without creating a second
  routing authority:
  - X: SSSTwitter, then SocialDownloader;
  - Instagram: SaveFromIns only;
  - TikTok: SnapTik Monster, then TikCD; SocialDownloader stays disabled for TikTok;
  - Facebook: FDown Isuru, then SocialDownloader;
  - Vimeo: VidDown only.

Runtime rollout rules, health, circuits, and bounded route policy remain authoritative. Static
priority tests do not grant traffic.

## Pinterest readiness boundary

The existing `pinterest-videodownloader / pinterest / nl` rule is unique, disabled at revision 2,
and allocated zero. All three process gates are false. The existing adapter, exact
`v1.pinimg.com` Delivery policy, one-attempt queue behavior, and rollback sequence remain unchanged.

After this PR is merged and its exact GitHub images are deployed with Pinterest still disabled, one
explicit owner authorization may enable the three gates, force-recreate only the Worker, CAS-update
revision 2 to full allocation, and run the two previously reviewed Pins once each in the owner's
browser. Any failure disables the rollout first, then the three gates. Success keeps Pinterest
Experimental/Beta; it does not add a sitemap entry or stable status.

## Production closeout

PR #125 was merged and deployed as `main@f5fc9a20b532487f432047dcc5480508f6e445a1` from exact-SHA
GitHub images after an encrypted PostgreSQL/configuration backup. The six application containers
remained healthy with zero restarts and Admin remained available.

The owner-authorized Pinterest window then applied configuration revision
`wi89-pinterest-beta-f5fc9a2`, enabled the three existing activation gates, and CAS-updated the
unique rule to revision 3 with full allocation. Two reviewed public Pins each produced exactly one
successful Provider attempt. Their Delivery tickets resolved through the reviewed redirect path to
`v1.pinimg.com`; bounded client verification received `206 video/mp4` and non-zero bytes. The
Pinterest circuit remained closed and no API or Delivery 5xx was observed during the extended
post-change check. Pinterest remains Experimental/Beta, noindex, and outside the sitemap.

## Verification

Run targeted Provider, Worker, Admin model and API tests, then `pnpm check`, `git diff --check`, and
production Compose validation. The release uses immutable GitHub SHA images, a PostgreSQL/config
backup, health checks, and no synthetic requests to existing Providers. No public API, database,
Delivery transport, media proxy, Admin audit workflow, or calibration change is included.
