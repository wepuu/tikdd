# ADR-0011: Password-authenticated owner console

- Status: Accepted
- Date: 2026-08-12
- Trust-path clarification: 2026-08-30 (Work Item 16 Phase A.1)
- Scope: work item 12.8.1
- Supersedes: ADR-0010 section 2 identity-provider choice

## Decision

TikDD has one owner account. PostgreSQL stores the normalized username, scrypt password hash,
enabled state, and credential version. Redis stores only digests of random sessions and bounded
login-rate counters. Public Web, resolver, Worker, and delivery services do not depend on this
authentication boundary.

The browser talks only to the same-origin Admin Next application. It holds one HttpOnly,
SameSite=Strict session cookie; the raw token is forwarded only by the server-side BFF to the
loopback Admin API. Every Admin API read and command requires that session. Existing Origin, CSRF,
idempotency, expected-revision, and exact-scope checks remain mandatory.

Sessions expire after 30 minutes idle or 12 hours absolute. Password change and account disable
increment the credential version and revoke all Redis sessions. Redis failure fails authentication
closed. There is no registration, email recovery, team role, or browser bootstrap flow. A local
interactive CLI initializes or recovers the account without password arguments or environment
variables.

The local password boundary accepts 8-128 characters. Blank values, the normalized username, and
maintained common weak passwords remain invalid.

Cloudflare Tunnel and host Nginx remain transport and origin protections, not identity providers.
Nginx routes the owner hostname only to the Admin UI/BFF. The server-side Admin BFF sends the
production `ADMIN_ORIGIN_PROOF` on its fixed loopback requests to Admin API; Nginx does not generate
or inject that proof, and the browser never receives it. Admin API remains loopback-only and has no
host or public port publication.

## Consequences

- Loss of Redis logs out the owner but cannot authorize the console.
- Loss of PostgreSQL prevents login and session verification.
- Account recovery requires deployment-host database access.
- TOTP is deferred and can be added without changing the session-cookie boundary.
