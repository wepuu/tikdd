# MVP release process

TikDD uses a small, manual production loop. GitHub builds the release; the NL host only pulls and
runs immutable images.

## Release checklist

1. Make one bounded change on a `codex/` branch.
2. Run targeted tests and `pnpm check`.
3. Open a pull request and merge only after CI passes.
4. Wait for **Release images** to publish Web, Service, and Admin images for the merge SHA. Record
   all three registry digests; never substitute a local image.
5. On the NL host, capture the current release, environment, container health, rollout revision,
   and PostgreSQL backup before deploying.
6. Deploy the exact SHA with Provider traffic still disabled. Confirm the public contract, page,
   and six continuously running containers.
7. For X Beta, update the existing `ssstwitter` / `x` / `nl` rule using its current revision, then
   enable the reviewed SSSTwitter and rollout switches. Keep Admin and calibration off.
8. Complete one real browser resolve-and-download journey and observe service health for 15
   minutes.

## Rollback

First disable the rollout rule and set its allocation to zero. Then turn off the process-level
Provider switches and restart only the affected service. If the release itself is unhealthy, use
the existing production rollback command to restore the previous release environment and images.

Do not invent successful evidence. Record the exact SHA, image digests, backup artifact, smoke URL,
task/delivery identifiers, health result, and any rollback action in the release handoff.
