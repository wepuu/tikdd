# Work Item 149: yt-dlp YouTube release qualification

## Scope

This work item closes the release gap found after Work Item 148. A private PO Token sidecar is a
runtime prerequisite for the qualification command, but starting that sidecar must not grant the
Worker YouTube traffic. NoAdsDL remains the primary YouTube Provider and SnapYT remains closed.

## Release-script correction

- The release script validates `TIKDD_YTDLP_POT_IMAGE` as an exact `@sha256` image reference for
  both YouTube activation and the closed-gate qualification operation.
- `ytdlp-youtube-qualification` explicitly starts the private sidecar before the Runner, while the
  qualification guard continues to reject a Worker configuration that already approves YouTube.
- Normal Dailymotion-only startup does not start the sidecar and remains unchanged.
- The sidecar has no published port and remains restricted to the private `provider-egress` network.

## Planned release sequence

1. Run repository checks, commit the Work Items 148/149 changes, create one PR, and wait for CI.
2. After merge, verify the exact Service, Web, Admin and yt-dlp Runner image digests and record the
   immutable PO Token sidecar digest in the release manifest.
3. Back up PostgreSQL, the production environment and the release manifest. Deploy with YouTube
   absent from `YTDLP_APPROVED_PLATFORMS`; do not create or enable a YouTube rollout rule.
4. Run the protected one-shot qualification with one ordinary public video and one Shorts sample,
   sequentially and without retries. Prefer the bounded `youtube:artifact` capability for the
   known separated-stream risk.
5. Only after both samples resolve, perform a separately authorized browser Delivery check with a
   unique `ytdlp-isolated / youtube / nl` rule. Temporarily keep NoAdsDL out of the test path,
   verify two one-use artifact downloads, then restore NoAdsDL as priority 740 and leave yt-dlp at
   priority 250 as the final fallback.

## Failure and rollback

Any rate limit, bot challenge, missing PO Token/Visitor Data, invalid artifact, ticket replay or
core-service failure closes the YouTube rule first. Remove YouTube from approved capabilities and
force-recreate the Worker. Dailymotion, NoAdsDL and all unrelated Provider traffic remain unchanged.

## Boundaries

No account cookies, browser profiles, CAPTCHA interaction, manual tokens, public sidecar port,
database migration or new public API is introduced. YouTube SEO and page status remain unchanged.
