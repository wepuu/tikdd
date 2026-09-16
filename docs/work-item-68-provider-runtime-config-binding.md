# Work Item 68 — FDown runtime configuration binding

## Finding

The first Work Item 67 browser verification did not reach FDown. The recent Facebook tasks had
zero Provider attempts, the FDown circuit was closed with insufficient data, and the running Worker
still exposed the previous configuration revision with all three FDown gates disabled.

The operator edited `/etc/tikdd/production.env` and then invoked Compose without binding
`TIKDD_PRODUCTION_ENV_FILE`. That file still selected an older versioned environment file, so the
Worker was not recreated with the requested gates. This is a runtime configuration failure, not a
FDown response or Delivery-policy failure.

## Repair

`scripts/production-release.sh worker-config-apply` is the single supported operation for applying
Provider gate changes. It binds Compose to the selected `TIKDD_RELEASE_ENV`, force-recreates only
the Worker, waits for its health check, and verifies the container's configuration revision and
FDown gate values without printing secrets. The active environment file keeps
`TIKDD_PRODUCTION_ENV_FILE=/etc/tikdd/production.env` so ad-hoc Compose invocations cannot silently
select the previous release configuration.

The operation does not alter API, Web, Delivery, Admin, PostgreSQL or Redis. Rollout remains a
separate CAS operation and must stay disabled until the Worker runtime check passes.

## Reverification boundary

After a backup, apply the new configuration with the rollout rule still disabled, verify the
Worker's actual environment, then enable the existing FDown Facebook rule by CAS. Each of the two
existing public Facebook samples is submitted at most once. A successful sample must produce one
`fdown-isuru` attempt, an encrypted one-use Delivery ticket, an audited `302`, and a non-zero final
`*.fbcdn.net` video response. If the first sample fails, disable the rule first, turn off the three
gates, reapply the Worker configuration, and stop the batch.

If a real FDown attempt fails, use only its metadata-only diagnostic (HTTP status, phase, candidate
and rejection counts, typed failure and duration) for a follow-up parser decision. If attempts are
zero, diagnose runtime binding or rollout control instead. No public contract, database schema,
Delivery transport, Host policy boundary or other Provider state changes are part of this item.
