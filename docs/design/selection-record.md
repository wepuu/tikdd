# TikDD visual-direction selection

- Decision date: 2026-08-04
- Selected option: 1 — Signal Runway
- Source of truth: [selected-signal-runway.png](selected-signal-runway.png)
- Selected by: project owner

## Accepted qualities

- The resolver journey is the product signature rather than generic decoration.
- The URL field remains the single dominant entry action.
- Recognition, resolution, and readiness are visible as one calm horizontal signal path.
- Normalized format choices are compact, comparable, and free of provider implementation details.
- The light blue-white surface, restrained borders, and blue-violet signal color preserve TikDD's
  engineering clarity without reading as an internal tool.
- The structure can collapse to a single-column mobile flow without changing the user journey.

## Implementation decision

The multilingual Next.js homepage implements this direction for English and Simplified Chinese. It
uses self-hosted variable fonts, Phosphor icons, real asynchronous task polling, rights confirmation,
normalized format selection, and one-use delivery-ticket creation. Provider names, raw upstream
warnings, and direct media URLs remain outside the consumer surface.

No refinement was requested at selection time.
