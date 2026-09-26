# 9xBuddy / xHamster Provider

9xBuddy is an experimental, disabled-by-default adapter for public xHamster pages. The current
anonymous protocol is dynamic: TikDD reads the landing bootstrap, derives the current auth token,
obtains an access token, signs the canonical URL, and submits it to the reviewed `ab.9xbud.com`
API. The response contains encrypted descriptors rather than public media URLs.

The current descriptor envelope is decoded as bounded hex, reversed into the Provider's Base64
ciphertext, and then decrypted with the bootstrap-derived key. A previous descriptor envelope is
retained as a narrow compatibility fallback. TikDD does not execute upstream JavaScript and does
not persist raw descriptors, response bodies, tokens, or media URLs. Sanitized diagnostics record
only whether the current or legacy envelope was recognized, or the coarse rejection stage.

The adapter prepares one MP4 artifact near 720p through the Provider's `/download` and `/progress`
workflow. It returns a candidate only after the artifact is ready, and the normal TikDD Delivery
service issues a one-time redirect. TikDD, the Worker, and the NL VPS never proxy media bytes. The
final artifact is accepted only on exact `ab.9xbud.com`; Provider pages, 9xPlayer, arbitrary
redirects, user cookies, login state, and challenge tokens are not used.

The default protection is one in-flight request and a two-second spacing interval. A conversion
may require up to 90 seconds, so xHamster has a platform-specific route timeout floor. Queue replay
is disabled and retryable failures fall back sequentially to LocoLoader. Dailymotion is currently
manifest-visible Lab capability only; it has no Delivery policy or production route.

An HTTP 200 extraction envelope with no formats is not treated as proof that the source content is
unsupported. The adapter retries only the extract call once after a short delay and records the
bounded attempt count without logging the source URL or response body. If the second envelope is
still empty, it returns a retryable, fallback-eligible Provider failure. Explicit private, removed,
invalid URL, and unsupported messages remain terminal.

Only an empty formats array is retried. Missing tokens, absent MP4 entries, unknown encoding,
decryption failure, and invalid download paths are deterministic extraction failures and are not
replayed against 9xBuddy; the router may continue sequentially to an eligible fallback.
