# Work Item 81 — Pinterest schema repair and Beta status closeout

## Baseline and finding

This item starts from `main@742bd658`. Pinterest was enabled for one controlled production
verification, then disabled after the first sample produced three `provider_schema_changed`
attempts. The failure was caused by an upstream oEmbed-style response (`type: "rich"`,
`_type: "video"`, a valid `video_url`, and empty optional thumbnail fields), not by the reviewed
`v1.pinimg.com` Delivery boundary. The three attempts were caused by the generic Pinterest queue
budget of three executions.

## Implementation

- Accept the observed rich/video response and empty optional URL metadata while requiring a
  reviewed HTTPS MP4 candidate.
- Keep the exact `v1.pinimg.com` media boundary, one-use redirect Delivery, and public result
  privacy rules unchanged.
- Set Pinterest queue attempts to one and disable automatic queue replay for
  `pinterest-videodownloader`; manual resubmission remains available.
- Add a sanitized real-shape fixture and parser/retry tests.
- Remove Pinterest from the public supported-platform/Beta copy while its rollout is disabled;
  keep internal catalog status `experimental`, URL recognition, gates, and the adapter intact.
- Bind the configured swap/memory thresholds into every production stage gate without relaxing
  their values.

No database migration, new Provider, new Delivery policy, media proxy, sitemap entry, Admin
lifecycle change, or production rollout is included in this item.

## Verification and release gate

Run the targeted Provider, Worker retry, Web copy, and release-script tests, then `pnpm check`,
`git diff --check`, and Compose validation. After CI and a GitHub-image deployment, keep Pinterest
disabled while checking core health. Only after the Worker revision and all three gates are
verified may the existing unique rollout rule be CAS-enabled for two one-shot browser samples.
Any failure disables the rule first, then the three gates, with no automatic repeat.

Pinterest remains Experimental until both samples complete direct browser Delivery successfully.
Existing X, Instagram, TikTok, Facebook, Admin, and calibration state is unchanged.
