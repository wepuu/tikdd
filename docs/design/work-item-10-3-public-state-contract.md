# Work item 10.3 public-state contract

Work item 10.3 changes routing reliability, not the selected TikDD visual direction. The existing
recognized, queued, resolving, ready, retryable-failure, and terminal-failure states remain the
consumer vocabulary in English and Simplified Chinese.

## Product Design constraints

- Primary success and sequential fallback render the same ready state.
- Consumer API responses replace implementation provenance with the generic `tikdd` / `api`
  projection and remove internal warnings.
- Provider names, route scores, fallback depth, circuit state, concurrency decisions, candidate
  hosts, direct URLs, and secret headers remain absent from consumer copy and task responses.
- Private, deleted, and geographically restricted content uses a terminal generic state; the UI
  must not offer fallback as a way around that outcome.
- Retryable provider availability failures use the existing safe retry state without naming the
  failed provider.
- Format actions continue to create opaque TikDD delivery tickets. The browser receives an upstream
  target only as the final non-followed redirect response, never in task JSON.

The visual-state and screenshot audit for these real scenarios remains work item 10.4. No new layout,
component style, marketing claim, or route is introduced in 10.3.
