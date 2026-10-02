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

### Cobalt OK.ru qualification

The self-hosted Cobalt adapter remains fixture-verified for OK.ru. Work Item 125's authenticated
runtime probe passed, but the first native sample returned a Cobalt error envelope with no media;
the second sample and all delivery checks were therefore skipped. The qualification module records
that sanitized `no-media` result and never promotes a platform or writes production configuration.
The existing `cobalt-selfhosted-okru-media-v1` policy remains closed behind the three Cobalt gates.

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

## Cobalt self-hosted secondary

Work Item 121 adds `cobalt-selfhosted` as an isolated Docker-backed multi-platform adapter for OK.ru,
X, Instagram, TikTok, Facebook, Pinterest, and Vimeo. The Worker calls only the private
`cobalt-api` service with a key from the mode-600 release environment; Cobalt's UUID key registry is
a Docker secret, and the official hosted `api.cobalt.tools` endpoint is not used.
The adapter accepts only `redirect` and `picker` responses with HTTPS media URLs and rejects
`tunnel` and `local-processing` results, so it never turns Cobalt into a TikDD media proxy. Every
platform starts with `deliveryModes: []` and must pass its own CDN, cross-exit, and browser download
audit before `COBALT_DELIVERY_VERIFIED_PLATFORMS` can include it. YouTube and xHamster are disabled
in the Cobalt container and are not part of this work item. The image is pinned by digest, the
container has no public port, and the default production gates remain false. See ADR-0058 and
`docs/work-item-121-cobalt-secondary-provider.md`.

## Cobalt capability matrix

Work Item 126 generalizes the closed-gate evidence model beyond the failed OK.ru canary. The
runtime service list is read only from the documented `cobalt.services` field, and service aliases
are mapped to explicit TikDD platform slugs. A platform remains a `qualified-secondary` candidate
only after two samples pass direct-host, Range, cross-exit and browser-save checks. Cobalt
`tunnel` and `local-processing` responses are recorded as `proxy-only`; TikDD does not proxy or
remux those results. The matrix is evidence-only and does not add new public platforms or change
the production gates.

Work Item 127 narrows the first live matrix to Vimeo and Pinterest. Both start as deferred
closed-gate records until the private runtime service list, two samples, reviewed media hosts,
three-exit Range checks and browser saving all pass independently. Existing VidDown and Pinterest
Video Downloader routes remain primary; Cobalt can only become a sequential fallback after that
platform's own evidence is qualified.

Work Item 128 prepares a single closed-gate batch for existing X, Instagram, TikTok and Facebook
routes. The batch starts fail-closed and uses the production Cobalt User-Agent; it does not enable
the Worker or alter any rollout. Only platforms that pass two samples, the existing Host policy,
three-exit Range checks and browser saving may become priority-450 sequential fallbacks.

Work Item 129 supersedes the earlier blanket rejection of Cobalt `tunnel` and `local-processing`.
The private API remains inaccessible from the Internet; only strict signed descriptors at
`media.tikdd.cc/tunnel` are accepted. Direct results use reviewed source-CDN policies, tunnel
results remain provider-hosted browser traffic, and local-processing inputs are downloaded and
remuxed/encoded by the browser. Delivery validates and reveals a one-time plan but never carries
media bytes. Production eligibility is explicit per platform and result mode through
`COBALT_DELIVERY_VERIFIED_CAPABILITIES`; the legacy verified-platform list means only
`redirect|picker`. See ADR-0059 and Work Item 129.

Work Item 131 makes qualification topology-aware. Direct source-CDN results still require resolver,
direct-client and proxied-client portability. Signed Tunnel results require the two independent
client exits and the exact `media.tikdd.cc/tunnel` boundary; the NL host's request through its own
Cloudflare hostname is diagnostic rather than source-CDN portability evidence. Neither topology is
production eligible without the standard one-time Delivery handoff and a real browser save.
Browser local-processing remains unapproved. Current TikTok Tunnel evidence is therefore
`resolved-conditional`, with every Cobalt production gate and capability still closed. See
ADR-0060 and Work Item 131.

Work Item 132 repeated both TikTok samples successfully behind a temporary TikTok-only key. The
proxied client exit passed, but the direct client exit was blocked at the Cloudflare edge before
the request reached the media origin. Cobalt therefore remains `resolved-conditional`: the
temporary key was destroyed, the original OK-only key restored, the container stopped, and no
Worker gate, `tiktok:tunnel` capability or rollout rule was enabled. Edge/browser compatibility
must be repaired and the complete handoff repeated before Cobalt can join the TikTok route.

Work Item 133 repaired that edge boundary with an exact `media.tikdd.cc/tunnel` GET/HEAD exception;
other paths and methods remain denied. Both independent user exits passed the two-sample bounded
Tunnel audit. The subsequent Cobalt-only browser window nevertheless failed: production Cobalt
rejected every authenticated request because its key registry used unsupported `userAgent` rather
than `userAgents`, while the old release check exercised only unauthenticated discovery. The unique
TikTok/NL Cobalt rule was CAS-disabled at revision 2/allocation zero, and SnapTik plus TikCD were
restored. Cobalt is not an active production fallback.

Work Item 134 adds a strict registry parser and authenticated private `POST /` readiness probe. The
official release path force-recreates Cobalt after secret changes, requires the deliberately invalid
probe URL to reach Cobalt's link-validation error, and refuses to recreate Worker if authentication
fails. The check never invokes an upstream Provider or logs secrets. A later activation must repeat
the two-sample qualification and obtain separate approval for a Cobalt-only browser window.
