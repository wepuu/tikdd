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

Work Item 72 registers `socialdownloader-space` only for the repeatedly verified Facebook path.
Its adapter accepts the anonymous JSON endpoint and the reviewed same-host `/api/video` stream;
X and TikTok remain Lab-only until their browser delivery audit is recorded.
The production Facebook Beta route requires `ENABLE_SOCIALDOWNLOADER_PROVIDER`,
`SOCIALDOWNLOADER_TERMS_APPROVED`, and `SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED`; all three are
currently enabled only for the reviewed NL rollout. The queue performs no automatic replay for this
provider. Its browser handoff remains `navigate` until a separate CORS/browser-save audit qualifies
the existing `cors-download` mode.
