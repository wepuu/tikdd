# ADR-0018: Isolated internal calibration runtime

## Status

Accepted

## Context

The first X production evidence scope is exactly SSSTwitter/X/NL. The production API and Worker
previously shared the fixed BullMQ queue `resolve`. Changing only the global observation class or
Provider flags would either relabel public tasks as internal or allow a public Worker to consume an
internal calibration task. The existing startup attestation also described one combined runtime,
which would require API-only and Worker-only secrets to be mounted into both services.

## Decision

Internal calibration uses a default-off Compose profile with a private, un-published API and a separate
Worker. Both join the internal `calibration-data` network instead of the shared application `data`
network and use the exact queue `resolve-internal-ssstwitter-x-nl`; the public API and Worker remain
on `resolve`. Queue names are runtime validated through `@tikdd/contracts`.

The calibration API and Worker receive separate short-lived startup attestations. Each attestation
is bound to the service role, resolve queue, deployment, region, Provider set, and the role's
least-privilege control state. API preflight requires admission and diagnostics credentials;
Worker preflight requires delivery encryption and rollout cohort credentials. Neither role must
receive the other's secrets.

The `calibration` profile has `restart: "no"`, concurrency one, no API host publication, and
default-false SSSTwitter approval and rollout inputs. Merely deploying this code cannot start the
profile or grant Provider traffic. Operator submission requires Docker-authorized execution inside
the calibration API container; host loopback and shared application networks are not treated as
authorization boundaries.

## Consequences

- Public and internal jobs cannot cross-consume through BullMQ.
- An attestation issued for one role or queue cannot start the other role or another queue.
- Operators must produce two current preflight attestations after explicit calibration approval.
- The profile does not authorize calibration, a pilot, Admin, public rollout, or new Provider use.
