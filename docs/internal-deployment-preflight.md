# Internal deployment preflight

Work item 11.5 provides a small, fail-closed production checklist for a personal TikDD deployment.
It is not an audit, approval workflow, compliance dashboard, or multi-role operating model.

The checked-in [`config/x-internal-preflight.json`](../config/x-internal-preflight.json) is `ready`
for deployment `tikdd`, runtime region `nl`, a trusted Cloudflare/Nginx ingress boundary, and the
single SSSTwitter Provider selected by ADR-0017. The site owner confirmed SSSTwitter production use
for this scope. This static state does not authorize traffic: the deployed runtime must still
supply current technical signals and pass every check before an attestation can be issued.

Provider page requests use direct egress by default. The trusted-proxy setting applies only to the
Cloudflare/Nginx request path into TikDD; it does not configure an outbound Provider proxy.

## Technical checks

An internal task requires:

1. an exact deployment ID, region, X Provider set, and direct/trusted-proxy mode;
2. production mode with mocks and the development rollout bypass disabled;
3. explicit Provider terms/use flags, admission control, rollout control, encryption keys, and
   protected diagnostics credentials;
4. healthy PostgreSQL, Redis, Provider egress, cleanup and evidence jobs;
5. working emergency disable, fail-closed Worker restart, delivery expiry, and manual recovery;
6. a signed attestation valid for at most 15 minutes and bound to the exact runtime configuration.

API and Worker must verify the same attestation before producing `internal` evidence. Missing or
mismatched settings block startup. The attestation does not create a rollout grant or enable traffic.

## Run

Set the deployment variables, fresh technical signals, a separate random HMAC key, and an unused
ephemeral output path:

```powershell
$env:TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON='<strict technical signal JSON>'
$env:TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL='<at least 32 random bytes, base64url>'
$env:TIKDD_INTERNAL_PREFLIGHT_ATTESTATION_OUTPUT='<ephemeral path>'
pnpm preflight:internal
```

The command prints `decision`, `summary`, `scope`, `blockers`, and `verified`. Exit code `2` means
blocked and creates no attestation. A ready result writes the attestation once; the key and secret
values are never included in the report.

Load the attestation into `TIKDD_INTERNAL_PREFLIGHT_ATTESTATION` for API and Worker without changing
the runtime settings, then remove the short-lived file after startup.

Use `pnpm verify:work-item-11-5` with local PostgreSQL and Redis to verify the implementation without
Provider network access or Pilot traffic.
