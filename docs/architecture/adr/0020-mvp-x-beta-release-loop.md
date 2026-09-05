# ADR-0020: Lightweight X Beta release loop

Status: Accepted — 2026-09-05

## Context

TikDD is a personal project with one production region and one currently usable real-provider
route. The earlier calibration and evidence design remains useful for diagnosis, but making elapsed
three-day and seven-day windows mandatory before every public change slows feedback without
removing the need for a real end-to-end check.

The public submission contract also carried a client acknowledgement unrelated to URL or network
safety. It did not establish technical access to the media and duplicated no server-side security
property.

## Decision

- Public task creation requires only a validated URL. No user acknowledgement is collected or
  included in admission fingerprints.
- The first public Beta route is the existing `ssstwitter` / `x` / `nl` tuple at full allocation.
  X remains experimental and is presented as Beta.
- The release loop is: targeted change, `pnpm check`, pull request CI, immutable GitHub-built
  images, production backup, manual deploy, one real browser download, a short stability watch,
  then keep or roll back.
- Calendar-length calibration and evidence windows are optional diagnostic tools. Their incomplete
  state must stay truthful but does not block this Beta.
- Provider terms review, exact-host delivery policy, URL recognition, SSRF and redirect validation,
  admission controls, bounded fallback, circuit breakers, and emergency deny remain mandatory.
- Admin and the isolated calibration profile stay off unless separately started for a specific
  maintenance task.

## Consequences

This supersedes the launch-blocking interpretation of ADR-0008, ADR-0009, ADR-0017, ADR-0018, and
ADR-0019. Those records still describe available safety and evidence mechanisms; they no longer
impose elapsed-time prerequisites on the personal-site MVP. Public traffic remains explicitly
granted and can be removed immediately through the rollout rule and process-level switches.
