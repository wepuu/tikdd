# Provider development

Every adapter owns a runtime-validated Manifest. For each supported platform catalog slug, declare:

- `platform`: an existing explicit-host catalog slug;
- `priority`: the platform-specific baseline priority;
- `deliveryModes`: only independently reviewed `redirect`, `proxy`, or `temporary-object` modes.

Use `deliveryModes: []` when the adapter is useful for metadata or technical validation but does not
yet have an approved production delivery boundary. Do not infer support from an adapter name and do
not copy Manifest capabilities into Web, API, Admin policy, or Redis.

An adapter result must use the detected platform, its own Manifest ID as provenance, and candidate
modes declared for that exact capability. Production formats each require one matching candidate.
Add capability, error-decision, normalized-result, candidate-host, and sequential-fallback tests for
every adapter change. New source and delivery hosts require explicit allowlists and redirect tests.

Before implementing a new free Provider, run the code-owned `qualifyFreeProviderCandidate` intake
from the package. It is offline-only and reports sanitized reject/defer reasons; an accepted result
still requires the normal adapter fixtures, Host review, Delivery verification, rollout approval,
and deployment checks.

## SocialDownloader secondary

Work Item 75 registers `socialdownloader-space` as a multi-platform manifest with independent
capabilities. Work Item 76 adds versioned X and TikTok Delivery policies, but the runtime defaults
still authorize and delivery-verify only Facebook. X and TikTok enter production only when both
`SOCIALDOWNLOADER_APPROVED_PLATFORMS` and `SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS` contain
the exact platform after its browser handoff audit. Instagram and YouTube remain Lab-only. The
adapter also applies one shared fail-fast request budget across platforms.
The production Facebook Beta route requires `ENABLE_SOCIALDOWNLOADER_PROVIDER`,
`SOCIALDOWNLOADER_TERMS_APPROVED`, and `SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED`; all three are
currently enabled only for the reviewed NL rollout. The queue performs no automatic replay for this
provider. Its browser handoff remains `navigate` until a separate CORS/browser-save audit qualifies
the existing `cors-download` mode.
## Pinterest Video Downloader Beta

Work Item 79 adds `pinterest-videodownloader` as a Pinterest-only adapter. Its delivery boundary
is the exact `v1.pinimg.com` host and the adapter is registered with three default-off activation
gates. Vimeo candidates from the same batch remain evidence-only; no adapter may infer Vimeo
support from a multi-platform Provider's landing page.

## 9xBuddy xHamster recovery

9xBuddy may intermittently return an HTTP 200 extraction envelope with no formats. Treat that
shape as a transient Provider failure, not evidence that the xHamster page is private or
unsupported. The adapter may repeat `/extract` once inside the same bounded Worker execution;
BullMQ must not replay the task. If the second response is still empty, the router may continue
sequentially to an eligible LocoLoader xHamster route. Explicit invalid, private, removed, and
unsupported responses remain terminal.

Current 9xBuddy MP4 descriptors are hex-encoded reversed Base64 ciphertext. Decode that envelope
before applying the bootstrap-derived cipher key; retain the previous binary-reversal envelope as
a bounded compatibility fallback. Retry only an empty formats array. Token, MP4, encoding,
decryption, and path failures are deterministic and must not trigger another upstream extract.

## GetXHamster xHamster primary

Work Item 105 adds `getxhamster` as a disabled-by-default xHamster adapter. It calls the anonymous
`getxhamster.com/api/video` endpoint, normalizes only progressive MP4 entries, and rejects adaptive
streams and the Provider's `/f` relay. Its versioned Delivery policy accepts only `*.xhcdn.com` and
`*.ahcdn.com` and uses the reviewed browser `cors-download` handoff. The adapter is bounded to one
in-flight request with configurable spacing and has no queue replay; 9xBuddy and LocoLoader remain
explicit sequential fallbacks until a separate rollout audit enables GetXHamster.

## SnapYT YouTube POC

Work Item 109/111/112 adds `snapyt-app` as a disabled YouTube fallback. It follows one bounded page
nonce, AJAX resolve, and result-page flow, then accepts numeric force-download descriptors through
the exact `snapyt-app-youtube-media-v1` policy. The Worker probes at most five targets and labels
verified combined, video-only, and audio-only resources from the actual MIME response. Direct
Googlevideo URLs, queue replay, Provider-page handoff, stream merging, and TikDD media proxying
remain excluded. NoAdsDL remains the priority-740 YouTube primary; SnapYT is the priority-720
sequential fallback. The manifest exposes no delivery mode until the independent browser audit
gate is explicit.

## NoAdsDL YouTube Beta POC

Work Item 110/112/113 adds `noadsdl` as a separate disabled-by-default YouTube adapter. It performs one
metadata request, one asynchronous job request and a 40-second, twenty-request maximum same-host
status-poll window, then uses
the reviewed `noadsdl-youtube-media-v1` Provider-stream policy. The parser supports both the
legacy codec-rich map and the current sparse combined-MP4 map, retaining the original status URL
when a processing response omits it. NoAdsDL is not enabled by the SnapYT gates, is not a
source-CDN redirect, and is not eligible for production until its own three gates, rollout rule
and browser Delivery audit are complete.

## OK.ru delivery compatibility

Work Items 118 and 119 record twelve OK.ru candidates as evidence-only portfolio entries. In
particular, OKGrabber can resolve native videos but
returns OK CDN resources signed to the resolver exit; a successful NL Range does not make those
resources browser-portable. The second batch found two reproducible anonymous form endpoints that
returned no media for the primary sample, plus two browser-token-dependent flows that cannot be
reproduced by the Worker. An OK.ru adapter requires two native samples, verified video Range,
cross-exit replay, and a cookie-free browser GET with either attachment semantics or reviewed CORS
download support. Provider POST streams, Provider pages, browser state, and TikDD media proxying do
not satisfy this boundary.

Work Item 120 reproduces Vidomon's fresh anonymous page token and request hash and normalizes only
progressive MP4 metadata on true `*.okcdn.ru` subdomains. Live checks resolved two samples, but the
direct media returned HTTP 400 and the Provider download wrapper required its PHP browser session.
The manifest therefore has no production delivery mode and is not registered in the Worker or
release gates. OK.ru remains planned. See ADR-0056 and ADR-0057.
