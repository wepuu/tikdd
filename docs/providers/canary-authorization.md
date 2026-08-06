# Live provider canary authorization

- Assertion date: 2026-08-04
- Asserted by: TikDD project owner
- Scope: the named TwitterSaver and DLPanda integrations, and the two URLs in
  `config/provider-canaries.json`, are authorized for technical testing
- Evidence status: project-owner attestation; external legal evidence is not stored in this repository
- Data handling: the runner does not persist provider responses, page metadata, thumbnails, or media
  URLs and emits only provider status, normalized format count, failure code, and elapsed time

This record authorizes a bounded technical canary. It is not a blanket authorization to download
other content, bypass access controls, supply user cookies, or enable either provider in production.

Run all canaries from PowerShell:

```powershell
$env:TIKDD_CANARY_AUTHORIZED = "true"
pnpm canary:providers
```

Set `CANARY_PROVIDER` to `twittersaver` or `dlpanda` to run one provider. The explicit environment
acknowledgement prevents an accidental network call during ordinary tests and CI.

To verify priority routing and fallback without persisting provider responses, add:

```powershell
$env:CANARY_MODE = "routing"
pnpm canary:providers
```

Routing mode enables the two reviewed site adapters and keeps the development mock last. Its output
lists only provider IDs, attempt status, and normalized failure codes, making the fallback path
observable without exposing media data.
