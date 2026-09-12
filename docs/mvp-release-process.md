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

Admin is a separate owner-on-demand operation after the public release has passed. Starting Admin
requires an approved HTTPS owner route (`admin.tikdd.cc`) through the existing Tunnel/Nginx
boundary; a loopback port alone is not a production access path. Always pass the write mode expected
for the session; the release script verifies the running Admin API environment and stops Admin if it
does not match:

```sh
TIKDD_RELEASE_ENV=/etc/tikdd/production.env \
TIKDD_ADMIN_EXPECTED_WRITE_MODE=readonly \
scripts/production-release.sh admin-start
TIKDD_RELEASE_ENV=/etc/tikdd/production.env scripts/production-release.sh admin-stop
```

The first session is read-only: verify login/session behavior and the Beta health view, do not publish
content or change routing, then run `admin-stop`. Admin API port 4100 remains private and is never
published. Owner-account recovery uses the release-env-bound one-shot operation rather than a bare
Compose command:

```sh
TIKDD_RELEASE_ENV=/etc/tikdd/production.env \
scripts/production-release.sh admin-account \
pnpm admin:account reset-password --username solo
```

## Rollback

First disable the rollout rule and set its allocation to zero. Then turn off the process-level
Provider switches and restart only the affected service. If the release itself is unhealthy, use
the existing production rollback command to restore the previous release environment and images.

Do not invent successful evidence. Record the exact SHA, image digests, backup artifact, smoke URL,
task/delivery identifiers, health result, and any rollback action in the release handoff.

Public MVP deployments keep `TIKDD_INTERNAL_PREFLIGHT_REQUIRED=false`. The internal preflight is a
calibration-only diagnostic that requires an isolated queue and a current three-day authorization
window; it is not a public release gate. Backup verification, staged host checks, health checks,
rollout rules and Provider process flags remain mandatory.
