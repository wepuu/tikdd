# Work Item 29 — Instagram Beta positioning and free-Provider watch

Status: closed as a positioning and evidence item on `codex/wi29-instagram-provider-replacement-feasibility`.
SaveFromIns remains the usable Instagram Beta Provider. Paid replacement research is paused until
the owner supplies a free candidate. This work item does not change production traffic, public API
contracts, database schema, Delivery architecture, or process profiles.

## Trigger and current evidence

Work Item 28 is deployed from `main@bdf6543a0e3c7fced09dc7b309616251d5f111f1`. Its post-deploy
observation was clean, and the browser reached non-zero X and Instagram media transfers through the
existing one-use Delivery redirect. The remaining question is Instagram Provider reliability.

The read-only `pnpm beta:report -- --hours=168 --platforms=x,instagram` report was generated on
2026-09-09 at `2026-09-09T13:01:08Z`. It contains no URL, task identifier, Provider URL, response
body, cookie, or credential:

| Platform | Tasks (total / succeeded / failed / expired) | Provider attempts (success / total) | Delivery (success / total) |
| --- | --- | --- | --- |
| X | 18 / 9 / 0 / 9 | 18 / 19 (94.74%) | 59 / 64 (92.19%) |
| Instagram | 32 / 12 / 14 / 6 | 15 / 29 (51.72%) | 37 / 41 (90.24%) |

Instagram attempt failures were `provider_schema_changed` (10), `provider_timeout` (2),
`invalid_result` (1), and `content_not_found` (1). No 403, 429, or challenge class appears in this
aggregate. Delivery is materially healthier than resolution, so the next review focuses on the
SaveFromIns response contract and Provider-side availability rather than adding a media proxy.

The current Worker log retention exposes only two SaveFromIns diagnostic events in both the 24-hour
and seven-day log views. That is insufficient to attribute all ten schema failures to one parse
variant; the item therefore treats the failure concentration as a decision signal, not as evidence
for another parser patch.

## Bounded diagnosis

The first step is a time-boxed review of existing sanitized SaveFromIns diagnostic events. The review
may group only HTTP status class, coarse content type, parse phase, resource count, valid MP4 count,
failure code, duration, and circuit state. It must not recover or persist raw responses, submitted
URLs, request markers, cookies, headers, titles, or CDN addresses.

The current owner testing confirms that public Instagram downloads are usable for the intended Beta
scope. The seven-day aggregate remains useful for trend visibility, but it is not a release blocker
or an automatic disable trigger. SaveFromIns keeps its existing bounded retry, circuit, timeout, and
manual-resubmit behavior. No additional parser patch is justified without a deterministic, redacted
fixture.

## Candidate review

DLPanda remains a no-go because it does not provide a usable public Instagram path. ReelsVideo also
remains a no-go under the earlier review because its submission required Turnstile and returned
429 without a stable result. They are not retested unless their public contract changes materially.

At most two new candidates may be screened from the NL environment. Each candidate must support
public, non-interactive requests without login, cookies, CAPTCHA bypass, or challenge automation. A
bounded set of ten currently public Reels is used; only network, HTTP 408, and 5xx failures may be
retried once. Candidate evidence is stored as aggregate counts and typed outcomes only.

### Initial public documentation screen (paused)

The first screen identified two API-style leads, but neither is qualified or authorized for TikDD
production. They remain research notes only; no paid account or credential is created:

| Candidate | Publicly documented shape | TikDD implication | Decision |
| --- | --- | --- | --- |
| [FastSaverAPI](https://fastsaverapi.com/instagram-downloader-api/) (`api.fastsaver.io`) | One GET request, `X-Api-Key`, public Instagram URLs, and a short-lived direct CDN URL; the vendor states that no login, cookie jar, or headless browser is needed. | Potential architectural fit, but it is a paid external dependency and still requires a terms/automated-use review, a vendor secret, rate-limit testing, and exact CDN-host validation. | Paused by owner decision |
| [EasyDown](https://docs.easydown.org/en/api/instagram) | POST endpoint with bearer token and public Instagram support; its documentation explicitly warns that direct browser media can fail because of CORS/CORP/cookies and suggests backend proxying. | Backend media proxying is outside TikDD's approved Delivery boundary, so this candidate is not a fit unless a redirect-safe mode is proven separately. | Deprioritized; no integration |

[DLGram/SaveAPI](https://dlgram.org/api) is retained only as a historical research lead because its
public documentation describes a bearer-key API returning direct CDN URLs, but it is a paid external
dependency with its own rate and credit limits. No account, key, or production secret has been
created in this work item. These documentation claims are screening input only; they do not establish
reliability, automated-use permission, or a Delivery allowlist.

## Decision gate

A future free candidate is eligible for a later adapter work item only when it meets all of the following:

- at least 8 of 10 Reels resolve on the first attempt or one permitted retry;
- the result contains a directly downloadable MP4 with a finite, reviewable media-host policy;
- no authentication, user Cookie, CAPTCHA/Cloudflare bypass, or runtime host discovery is needed;
- timeout and response limits fit the existing worker budget;
- normalized errors, Provider manifest fields, and Delivery allowlist rules can be tested deterministically.

If the owner supplies a free candidate that passes, a later work item will add a disabled-by-default
adapter and fixtures. Production allocation remains zero until a separate qualification and deployment
approval. Only after a successful production comparison may SaveFromIns be demoted to a low-priority
sequential fallback.

If no candidate passes, SaveFromIns remains the experimental Instagram Beta with its current bounded
retry, circuit, and emergency-stop protections. No stable-support or indexing claim is made.

## Invariants and exit criteria

- X rollout and behavior remain unchanged.
- Instagram rollout and gates remain unchanged during feasibility review.
- Admin, calibration, and all other Providers remain stopped.
- No migration, public endpoint, media proxy, new download mode, or broad Host allowlist is added.
- The work item exits with SaveFromIns retained as the usable Beta Provider, while future free-candidate
  validation remains a separate owner-supplied decision.
