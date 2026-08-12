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
