# Work Item 35 — Admin content-draft write scope

## Objective

Make the owner Admin safer to run on demand by separating read-only inspection, content proofing,
and full maintenance. The default must be safe when an environment file is incomplete: an omitted
`ADMIN_WRITE_MODE` is interpreted as `readonly`.

## Scope

`ADMIN_WRITE_MODE` is validated at Admin API startup and is exposed in the authenticated runtime
read:

| Mode | Allowed writes |
| --- | --- |
| `readonly` | None; all Admin control-plane POST commands are rejected. |
| `content-draft` | Locale, page, and shared-content draft/discard commands only. Drafts do not alter the public snapshot. |
| `full` | The existing authenticated route, platform presentation, qualification, publication, and recovery commands. |

The API checks the mode after the existing Host/Origin/session boundary and before CSRF/command
dispatch. This keeps authentication and CSRF behavior unchanged while ensuring a forged browser
request cannot widen the scope. Account password operations remain part of the authentication
surface and are not treated as content or control-plane writes.

## Admin experience

The shell shows a compact mode badge in the top bar and a clear scope notice in sections that are
not available. In `content-draft`, the structured proofing desk and SEO draft controls remain
usable; publication, propagation retry, and rollback controls are disabled or hidden. In
`readonly`, content editing and all other mutation sections are replaced by a short explanation.
The visual treatment reuses existing Admin tokens, stays legible at the 390px layout, and keeps
focusable controls and reduced-motion behavior unchanged.

## Verification

- Configuration accepts only `readonly`, `content-draft`, and `full`; missing mode defaults to
  `readonly` in both development and production.
- API tests prove content-draft/page writes are accepted while route and content-publication writes
  receive `ADMIN_WRITE_SCOPE_REJECTED`; readonly receives `ADMIN_WRITE_DISABLED`.
- Runtime contracts and Admin fixtures include the mode, so the UI cannot silently assume full
  access when the server is read-only.
- No database migration, Provider request, rollout change, public endpoint, or media-delivery
  change is introduced.

## Release boundary

This work is local until the normal PR/CI and separate deployment approvals are completed. It does
not start the Admin profile, calibration, or any Provider. Production should explicitly retain
`ADMIN_WRITE_MODE=readonly`; a temporary `content-draft` or `full` value requires a separately
approved owner maintenance window and must be reverted afterward.
