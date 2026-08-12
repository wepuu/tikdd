# TikDD public Web

The public multilingual application consumes only complete immutable published-content snapshots.
It never calls Admin API and never reads drafts or editorial heads.

Set `PUBLIC_CONTENT_DATABASE_URL` to a PostgreSQL identity with read-only access to
`admin_published_snapshot_heads` and `admin_published_snapshots`. `PUBLIC_CONTENT_DEPLOYMENT_ID`
selects the exact deployment. During an outage the process retains the last known-good snapshot;
a bundled reviewed English/Chinese seed protects cold startup.

Admin publication acknowledgement uses `PUBLIC_CONTENT_REVALIDATION_SECRET` on both Web and Admin
API. The internal endpoint accepts only current HMAC-signed commands containing a named snapshot
and bounded local paths. It does not accept arbitrary URLs or expose snapshot payloads.
