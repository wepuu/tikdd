# TikVid.cc secondary candidate

- Provider ID: `tikvid`
- Candidate page: <https://tikvid.cc/en1/>
- Platform: TikTok
- Current stage: `fixture_verified` / `resolution-only` / disabled

The adapter only submits the normalized canonical TikTok URL to the reviewed provider page host and
normalizes MP4 links into the internal result shape. It does not persist or expose upstream links.
The media host and redirect behavior are intentionally not approved yet, so production routing
filters this capability and no rollout rule exists.

Do not send live user URLs from CI. A future promotion requires sanitized negative fixtures, an exact
media-host policy, Delivery verification, and a separately approved bounded canary.
