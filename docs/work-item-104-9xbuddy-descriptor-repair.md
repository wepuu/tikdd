# Work Item 104 — 9xBuddy dynamic descriptor repair

Status: implemented locally; production activation requires the normal PR, exact-SHA image, backup,
deployment, and browser-validation sequence.

## Production evidence

After Work Item 103, 9xBuddy consistently reached its anonymous extraction endpoint and returned
HTTP 200 with seven formats, including five MP4 choices. The response token and bootstrap-derived
key inputs were still present. TikDD nevertheless classified every MP4 descriptor as
`provider_schema_changed`, then fell back to LocoLoader. Once LocoLoader's shared allowance was
exhausted, its local `provider_rate_limited` result was incorrectly presented as unavailable
content.

A bounded NL probe inspected the current static client algorithm and two public responses without
persisting source URLs, tokens, response bodies, or CDN addresses. The current envelope is:

1. hex-decode the descriptor;
2. reverse the resulting ASCII string;
3. treat that string as Base64 ciphertext;
4. decrypt it with `SORRY_MATE + landing-host length + CSS hash + response token`.

TikDD's previous implementation inserted another Base64 encoding between steps 2 and 3. The key
contract had not changed; the extra transformation made otherwise valid `/download/` paths
unreadable.

## Implementation

- Decode the current Base64-inside-hex envelope first and retain the prior binary-reversal envelope
  as a bounded compatibility fallback.
- Accept only a decoded `/download/` path that passes the existing descriptor parser. No upstream
  JavaScript is executed and no Provider URL crosses the normalized Provider boundary.
- Emit only a coarse extraction state: current/legacy descriptor, empty formats, missing token,
  missing MP4, unknown encoding, decode failure, or invalid path.
- Retry `/extract` once only when the formats array is empty. Deterministic token, schema, encoding,
  decrypt, and path failures are not repeated.
- Mark LocoLoader shared-budget exhaustion as retryable and show a distinct capacity message rather
  than claiming that the source page is private, removed, or unsupported.

ADR-0046 continues to govern the exact artifact host and one-time Delivery redirect. This work does
not change persistence, provider priority, public contracts, delivery topology, or host policy, so
no new ADR is required.

## Verification and release boundary

Provider tests cover current and legacy descriptors, one bounded empty-format retry, deterministic
failure without replay, sanitized diagnostics, and LocoLoader budget semantics. Web tests cover the
provider-capacity presentation. Complete `pnpm check`, `git diff --check`, and production Compose
validation before handoff.

Production should deploy with the existing route and gates unchanged, then validate two public
xHamster pages through 9xBuddy. Each task must have one successful 9xBuddy attempt and must not
consume LocoLoader allowance. If 9xBuddy fails, keep the bounded LocoLoader fallback but do not reset
or bypass its shared allowance.
