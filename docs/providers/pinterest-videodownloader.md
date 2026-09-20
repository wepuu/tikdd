# Pinterest Video Downloader Provider

Work Item 79 adds this adapter as the experimental Pinterest Beta candidate. It uses the
anonymous `pinterest-videodownloader.com` API only for resolution:

- `GET /api/expand?url=...` expands `pin.it` links;
- `GET /api/pin?id=...` returns the public Pin metadata and media URL;
- only HTTPS MP4 resources on the exact `v1.pinimg.com` host are accepted;
- TikDD Delivery sends a one-use redirect to that media host and never reads media bytes.

The adapter is fail-closed and default-off. Enablement requires all three values below to be
`true`, followed by a unique `pinterest-videodownloader/pinterest/nl` rollout rule:

```text
ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER=true
PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED=true
PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED=true
```

The provider is not a generic Pinterest extractor, does not accept private media or credentials,
and does not fall back to HHHDownload's `/api/stream` proxy. Vimeo candidates from Work Item 79
remain deferred and are not routed by this adapter.
