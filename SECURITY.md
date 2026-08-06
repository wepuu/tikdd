# Security policy and threat model

TikDD accepts attacker-controlled URLs and may later transfer large attacker-influenced files. Treat
the resolver and delivery paths as hostile boundaries.

## Required controls before real providers

- Accept only HTTP and HTTPS URLs for explicitly supported platform hosts.
- Resolve and validate DNS after every upstream redirect; reject loopback, private, link-local,
  reserved, and cloud metadata addresses.
- Limit redirects, response bytes, media bytes, duration, retries, concurrency, and total egress.
- Do not forward user-supplied headers, cookies, credentials, or arbitrary HTTP methods upstream.
- Validate MIME type using both headers and content sniffing.
- Use short-lived signed delivery tokens and support byte ranges without becoming an open proxy.
- Redact query strings, tokens, cookies, and upstream URLs from logs.
- Delete source URLs, results, and temporary files at the configured expiry.
- Run HTML-scraping and yt-dlp providers in resource-limited worker containers.
- Treat the yt-dlp extractor list as discovery data only. Never automatically convert it into an
  upstream allowlist or accept an unknown host through a generic extractor.
- Stop fallback on private, authenticated, paid, DRM-protected, or policy-restricted responses; do
  not use provider diversity to bypass access controls.

## Reporting

Do not open a public issue for a vulnerability that could expose user URLs, credentials, internal
network access, or unrestricted media proxying. Use the repository owner's private security contact.
