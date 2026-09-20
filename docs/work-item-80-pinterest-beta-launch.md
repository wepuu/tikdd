# Work Item 80 — Pinterest Beta production launch and platform status alignment

## Baseline and scope

This work item starts from `main@c59dc0d201a384d4965ea85c14a86a79ac4758f0`, which contains the
Pinterest adapter and the exact `v1.pinimg.com` Delivery policy from Work Item 79. The adapter is
still disabled in production until the release sequence below is completed. Vimeo remains deferred.

The code portion aligns the platform catalog, public bilingual copy, and starter snapshot with the
reviewed Pinterest capability. It does not add a Pinterest landing page or sitemap entry, and it does
not change the public API, database schema, Delivery transport, or existing X, Instagram, TikTok, or
Facebook routes.

## Product status

- Pinterest is `experimental` and is described as a public Beta on the home page in English and
  Chinese.
- The supported-platform copy and starter metadata mention Pinterest without promising stable support.
- No Pinterest route is added to the sitemap or to indexable platform content until a separate
  natural-traffic closeout promotes it.
- Vimeo stays deferred; no adapter, rollout rule, gate, or SEO surface is created for Vimeo.
- Admin remains available for the existing owner workflow; calibration remains disabled.

## Release sequence

1. Run targeted tests, the full repository checks, and production Compose validation. Keep the three
   Pinterest gates and rollout disabled while the image is built.
2. Merge the PR and verify the Web, Service, and Admin GHCR images are built from the exact merge SHA.
3. Before deployment, back up PostgreSQL, `/etc/tikdd/production.env`, and the active release
   manifest. Deploy only the GitHub-built immutable images.
4. Verify the six core services, existing X/Instagram/TikTok/Facebook flows, Worker revision, and
   that all three Pinterest gates remain false.
5. Write a new configuration revision with these gates true:
   `ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER`,
   `PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED`, and
   `PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED`. Apply it with the official
   `worker-config-apply` operation and verify the revision inside the Worker.
6. Read the existing `pinterest-videodownloader / pinterest / nl` rule and CAS-update that unique
   rule to `enabled=true`, `allocationBps=10000`; do not create a duplicate rule.
7. Use the two reviewed public Pin samples once each in a browser. Each task must have exactly one
   Provider attempt, one-use Delivery, a 302 to `v1.pinimg.com`, and a non-zero playable MP4. The
   browser must reach the media host directly; TikDD must not proxy media bytes or expose the
   Provider page.
8. Observe the core containers, API/Delivery 5xx, Provider failures, circuit state, and Delivery
   redemption for 10 minutes. If either sample fails, disable the rollout first, then the three
   gates, and force-recreate only the Worker. Roll back to the previous immutable image if the
   release itself is at fault.

## Evidence and boundaries

The Work Item 79 adapter tests already cover the normalized Pin response, exact media-host policy,
one-use tickets, and redirect behavior. This item adds only catalog, copy, and snapshot assertions;
it does not record raw sample URLs, response bodies, CDN signatures, cookies, or tokens in the
repository. A successful release makes Pinterest an experimental Beta, not a stable platform.

