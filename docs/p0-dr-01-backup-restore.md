# P0-DR-01 — encrypted off-host PostgreSQL backup and restore drill

Status: **complete (manual drill verified 2026-09-03)**

This record closes the deferred PostgreSQL disaster-recovery gate without changing database
topology, restarting production PostgreSQL, enabling Provider traffic, or starting Work Item 17.
The execution baseline was `main@4fc51aa176ce097c751df69537989648bdf7e65b` and the implementation
branch is `codex/p0-dr-01-backup-restore`.

The machine-readable sanitized receipt is [`p0-dr-01-backup-metadata.json`](p0-dr-01-backup-metadata.json).

## Evidence record

| Item | Observed value |
| --- | --- |
| Production database | `tikdd` |
| Production PostgreSQL | 17.6 (`postgres:17.6-alpine`) |
| Production `pg_dump` | 17.6 |
| Backup timestamp | `20260903T131045Z` |
| Raw custom dump bytes | 146,789 |
| Encrypted artifact | `tikdd-prod-20260903T131045Z.dump.gpg` |
| Encrypted bytes | 38,228 |
| Encryption | GnuPG 2.4.4, dedicated RSA recipient; fingerprint `DD42F764EAADACCB2F83175EB6D179FAC2BB4313` |
| Production-host SHA-256 | `5537f439eecbb18f00c09e1b3980c4dcb3f606690f40baabec017bad7c78c73b` |
| Off-host destination | Operator workstation local filesystem, Git-ignored `tmp/p0-dr-01-20260903/` (not the NL VPS) |
| Transfer | Pageant-authenticated PSCP over SSH to the workstation |
| Off-host SHA-256 | `5537f439eecbb18f00c09e1b3980c4dcb3f606690f40baabec017bad7c78c73b` |
| Checksum match | **PASS** |
| Plaintext production artifact | Removed; no `.dump` or `.partial` remained in `/var/backups/tikdd/p0-dr-01` |

The production database remained online and healthy. The dump used PostgreSQL custom format with
`--no-owner --no-privileges`, and was first checked with `pg_restore --list` in a network-isolated
container. Only the public recipient was present on production; the private identity was retained
in the local restore keyring and was never copied to the VPS.

## Restore drill

The restore started from the copied off-host encrypted artifact, not the production-host file. A
temporary Docker PostgreSQL 17.6 instance ran on an internal-only network with a disposable named
volume and no published port. The restore helper used `pg_restore` 17.11 and streamed GPG output
directly into `pg_restore`; no decrypted dump was persisted.

Measured restore execution was approximately 1.763 seconds (`2026-09-03T13:18:02.0037644Z` to
`2026-09-03T13:18:03.7667255Z`). The initial manual transfer and backup commands were completed in
the same operator session but were not independently timed; they are observations, not an RPO/RTO
promise. Future scheduled operations must measure those intervals explicitly.

Schema validation found all required tables:

`resolve_tasks`, `provider_attempts`, `delivery_candidates`, `active_source_admissions`,
`delivery_tickets`, `provider_delivery_outcomes`, and `provider_daily_evidence`.

Production-safe aggregate counts matched the restored snapshot:

| Relation | Production | Restored | Match |
| --- | ---: | ---: | --- |
| `resolve_tasks` | 102 | 102 | yes |
| `provider_attempts` | 9 | 9 | yes |
| `delivery_candidates` | 8 | 8 | yes |
| `delivery_tickets` | 1 | 1 | yes |

Relational integrity checks all returned zero: no candidate referenced a missing task, no delivery
ticket referenced a missing candidate, and no provider attempt referenced a missing task. Expected
indexes and foreign keys were present. Repository migrations `0001` through `0020` were then run
idempotently against the isolated database and the current persistence smoke returned
`persistence_read=true`.

The disposable restore container, network, volume, tools container, and decrypted stream were
removed after validation. The encrypted artifact and checksum sidecar are retained at
`tmp/p0-dr-01-20260903/` for the operator; the private restore identity remains outside Git in the
operator restore keyring. No credentials, URLs, tokens, task payloads, or private key material are
recorded here.

Production health checks before and after the drill showed Web, API, Worker, Delivery, PostgreSQL,
and TikDD Redis healthy with zero restarts. The shared-host Stage Gate returned `PASS`. Provider,
Delivery, CDN, Canary, and rollout requests were all zero.

## Repeatable procedure

The scripts are deliberately one-shot and do not schedule or choose a destination:

1. On the NL host, set `TIKDD_BACKUP_RECIPIENT` to the dedicated public fingerprint and run
   `scripts/production-backup-postgres.sh`. The existing PostgreSQL secret is read only inside the
   container from `/run/secrets/postgres_password`.
2. Copy the `.dump.gpg` file and its `.sha256` sidecar to independent storage over an authenticated
   SSH/SFTP path. Never copy the plaintext partial file.
3. In the off-host restore environment, set `TIKDD_BACKUP_GPG_HOME` and run
   `scripts/verify-postgres-backup.sh /absolute/offhost/tikdd-prod-...dump.gpg`.
4. For a disposable drill, provide `TIKDD_RESTORE_GPG_HOME` and a local-only
   `TIKDD_RESTORE_DB_PASSWORD_FILE`, then run `scripts/restore-postgres-drill.sh` with the same
   off-host path. The script verifies required tables and core orphan invariants, and removes its
   temporary PostgreSQL resources on exit.
5. After a VPS loss, provision a clean private PostgreSQL instance, restore from the retained
   encrypted off-host copy, run the repository migrations only against that isolated instance, and
   perform the persistence/readiness smoke before any controlled application recovery. Production
   credentials are recreated through the normal secret bootstrap; they are never recovered from
   this document or embedded in a backup command.

The private decryption identity is intentionally **not** stored on the production VPS, in Git, in
the backup directory, or in the GitHub repository. Scheduling, retention policy, and periodic drill
cadence remain a separate reviewed operational decision.
