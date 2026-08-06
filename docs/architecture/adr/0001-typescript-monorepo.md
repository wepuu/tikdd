# ADR-0001: TypeScript monorepo and service boundaries

- Status: Accepted
- Date: 2026-08-03

## Context

TikDD needs one SEO website, a low-latency control API, asynchronous provider execution, and a
high-bandwidth delivery path. Shared contracts must evolve without copying types across repositories.

## Decision

Use a pnpm TypeScript monorepo with separate `web`, `api`, `worker`, and `delivery` applications.
Share only explicit packages for contracts, platform detection, providers, and persistence. Each
application remains independently deployable. Recursive pnpm tasks are sufficient for the initial
repository; a remote build cache can be introduced later if measured CI time justifies it.

The worker may invoke an isolated yt-dlp/FFmpeg container later. yt-dlp does not run inside the web or
API application image.

## Consequences

- Changes can be validated atomically and are easy for automated contributors to trace.
- The first deployment can colocate services while preserving future scaling boundaries.
- A TypeScript control plane minimizes contract drift; yt-dlp remains a process/container boundary.
- Runtime and CI must test all workspace packages together.
