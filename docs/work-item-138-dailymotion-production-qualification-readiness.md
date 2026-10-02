# Work Item 138: Dailymotion production qualification readiness

## Scope

Work Item 138 prepares a safe production-instance delivery audit for the Dailymotion Tunnel result
identified by Work Item 137. It does not add Dailymotion to the production Cobalt key, Worker
configuration, rollout table, public content or SEO publication. Those actions remain a separate
production authorization after this code is merged and deployed.

The production Cobalt runtime already serves the verified TikTok fallback. Qualification therefore
cannot require every global Cobalt gate to be false. Instead, the runner fails before contacting
Cobalt when any requested platform appears in either `COBALT_APPROVED_PLATFORMS` or
`COBALT_DELIVERY_VERIFIED_CAPABILITIES`. This permits a closed Dailymotion audit without stopping
TikTok and without making Dailymotion eligible for user traffic.

## Sensitive descriptor handoff

When a successful qualification returns a single reviewed Tunnel candidate for a sample, the
runner may write a dedicated artifact at the fixed runtime path. The artifact:

- contains at most two sample IDs and signed Tunnel descriptors;
- is validated through `cobalt-selfhosted-tunnel-media-v1` before writing;
- is owned by the non-root service identity and uses mode `0600`;
- is mounted as the only writable file inside an otherwise read-only runtime directory;
- is never included in qualification stdout, diagnostics, logs or repository fixtures;
- is deleted with the qualification input on failure or interruption;
- remains only after a successful run so it can be copied through a permission-preserving channel,
  and must be deleted from the server and each client after the short audit window.

The existing Tunnel audit accepts that artifact only with an explicit `client-direct`,
`client-proxy` or `origin-hairpin` override. It still reads at most 1 KiB, follows no redirect and
emits only sanitized status fields.

## Release boundary

The next production window must merge and deploy this tooling while Dailymotion remains absent from
the production key and Worker configuration. After separate authorization, the operator may back
up the key registry, add only `dailymotion`, force-recreate Cobalt with authenticated readiness and
run the two approved samples. A successful direct-client and proxied-client audit is still not a
rollout grant: one-time TikDD Delivery handoff and a real owner browser save remain mandatory.

Failure restores the previous key registry without changing TikTok. Success permits a later
`dailymotion:tunnel` Worker capability and unique rollout rule. Until those final gates pass,
Dailymotion remains planned, non-indexable and absent from the sitemap.
