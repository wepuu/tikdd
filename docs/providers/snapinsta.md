# SnapInsta.to secondary candidate

- Provider ID: `snapinsta`
- Candidate page: <https://snapinsta.to/en46>
- Platform: Instagram (public posts and Reels only)
- Current stage: `canary_failed` / `resolution-only` / disabled

The adapter submits only the normalized canonical Instagram URL to the reviewed page host and
normalizes MP4 links into the internal result shape. Private, authenticated, paid, or challenge
flows remain outside the TikDD boundary. The media host and redirect behavior are not approved yet,
so production routing filters this capability and no rollout rule exists.

Do not send live user URLs from CI. A future promotion requires sanitized negative fixtures, an exact
media-host policy, Delivery verification, and a separately approved bounded canary.

The bounded NL verification recorded by Work Item 52 received a Cloudflare challenge on the landing
page. No Instagram URL was submitted and no bypass was attempted. The candidate remains deferred
until ordinary, non-challenge access can be demonstrated.
