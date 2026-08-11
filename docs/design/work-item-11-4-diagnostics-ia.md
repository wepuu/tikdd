# Work item 11.4 protected diagnostics information architecture review

- Date: 2026-08-11
- Surface: authenticated JSON diagnostics and export only
- Consumer UI: intentionally none
- Product Design result: pass, with zero P0/P1 findings

## Product boundary

The operator's first question is answered in a fixed order: **what scope am I viewing**, **how fresh
is it**, **is the sample sufficient**, **which locked policy interprets it**, **what restriction is
active**, and **which daily aggregates support that state**. The response therefore orders its
top-level groups as `scope`, `freshness`, `sufficiency`, `policy`, `guard`, `evaluator`, then `days`.
This avoids forcing an operator to infer health from a metric dump before checking freshness or
sample sufficiency.

The export repeats the exact tuple/class/date scope before the days. It cannot merge Canary,
internal, and public observations. A 31-day maximum keeps the artifact reviewable and limits bulk
operational disclosure.

## Review findings

1. **Clear decision hierarchy — healthy.** Freshness and sufficiency precede policy and Guard
   details, matching the safe operator decision sequence.
2. **No consumer control-plane leakage — healthy.** No route, component, localized copy, sitemap,
   or public OpenAPI entry was added. The internal endpoints do not become a hidden consumer admin
   screen.
3. **Failure recovery — healthy.** Empty evidence is represented explicitly rather than as a
   successful zero-rate state; invalid or oversized ranges return one bounded error.
4. **Privacy — healthy.** The response allowlist contains aggregate tuple/day data only. Tests reject
   task, candidate, format, source/target URL, ticket, cookie, header, payload, and actor fields.
5. **Accessibility scope — not applicable to a visual UI.** There is no rendered operator interface
   to assess for keyboard, focus, contrast, zoom, or screen-reader semantics. Any future dashboard
   must receive a new screenshot-based Product Design audit rather than treating this JSON review
   as visual accessibility evidence.

## Decision

Keep the first release API-only. A dashboard would create navigation, empty/loading/error states,
role communication, responsive layout, and accessibility obligations without improving the current
single-operator pilot gate. The accepted JSON hierarchy is the contract a future protected UI may
consume, not permission to expose it in the consumer application.
