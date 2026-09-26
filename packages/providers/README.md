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
