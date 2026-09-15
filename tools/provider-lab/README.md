# TikDD Provider Lab

This directory is an evidence-only harness for Provider validation work (Work Items 62 through 65). It is not a production service and
must never be imported by Web, API, Worker or Delivery.

## Operating rules

- Remote probes run sequentially with a 10-second timeout, no automatic retries and a 10-second
  minimum interval. The active command allows at most two samples and six requests per Provider.
- Provider response bodies are held in memory, capped at 512 KiB and discarded after parsing.
- Media validation reads at most 1 KiB with `Range: bytes=0-1023`; it never downloads a complete file.
- Every URL is HTTPS-only, credential-free, standard-port, public-DNS validated and limited to three
  redirects. Provider hosts come from this code-owned catalog; response data cannot expand policy.
- Bounded HTML is inspected only for challenge markers (for example Turnstile/Cloudflare or human
  verification); a marker is recorded as `blocked` and the body is discarded.
- Output contains only Provider/endpoint IDs, sample references, status, content type, timing,
  counts, redirect count, media host suffixes and sanitized failure codes. It never contains source
  URLs, query strings, response bodies, cookies, tokens, titles, authors or complete CDN URLs.
- A 429, challenge, login boundary or explicit automation refusal ends that Provider's batch.

## Commands

```text
node tools/provider-lab/probe.mjs passive --all
node tools/provider-lab/probe.mjs passive prexzy ahm7_alldl
node tools/provider-lab/probe.mjs active prexzy <temporary-sample-file>
node --test tools/provider-lab/test/*.test.mjs
```

The sample file is a temporary operator-controlled JSON array with `{ "id", "url" }` entries. Keep
it outside Git, remove it immediately after the run and never print it. No `raw/` result directory
is permitted. Self-hosted candidates are evaluated only in a local Docker Desktop container with
no secrets, privileged mode, host networking or Docker socket.
