# Work item 12.8.1 — Admin preview recovery and owner authentication

Status: implemented on 2026-08-12.

- Replaced the stale ad-hoc Admin preview with an owned process supervisor and matching build IDs.
- Added one PostgreSQL administrator account, scrypt password verification, Redis sessions, login
  throttling, local recovery CLI, same-origin BFF routes, and an HttpOnly cookie boundary.
- Added a private-control login experience and account security controls; runtime failures no
  longer fall back to demo metrics.
- Public Web, resolve, Worker, and delivery contracts are unchanged.
- The owner-selected local password floor is 8 characters; blank, username-equal, and maintained common weak passwords remain rejected.

## Verification

- `pnpm test:work-item-12-8-1`: 7 files / 20 tests passed.
- `pnpm test:work-item-12-8`: 9 files / 40 tests passed.
- `pnpm admin:status`: UI and API report the same build ID; recorded service PIDs match ports 3001/4100.
- Browser QA: desktop and 390×844 render without horizontal overflow; unauthenticated `/` redirects to `/login`; invalid credentials produce one generic error.
- Initialize the first account locally before testing the authenticated console: `.\admin-account.cmd init --username owner` on Windows.
