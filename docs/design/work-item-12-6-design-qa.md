# Work item 12.6 design QA — locale assembly line

## Direction

The selected subject is the personal-site owner assembling reviewed translations into fixed TikDD
page templates. The single job is to distinguish complete localized content from preview-only
fallback content.

The existing Admin typography and blue/violet/mint/amber palette continue. The intentional visual
risk is the fallback ribbon: it renders the actual locale chain as infrastructure provenance rather
than hiding it behind a generic completeness percentage.

## Layout

- Locale register: display name, canonical tag, direction, default state, and draft presence.
- Fallback ribbon: the currently selected chain, including RTL/LTR direction.
- Locale facts: state, revision, enabled status, and shared-block coverage.
- Page × Locale matrix: every code-owned definition against every enabled locale.
- Boundary footer: fixed templates, Safe Markdown, and draft isolation.

## Rendered QA

Reviewed on the actual local application on 2026-08-12:

- desktop width: hierarchy and dense matrix remain legible;
- mobile width: 375 CSS pixels, document width equals viewport width and the assembly panel does
  not overflow;
- Locale interaction: selecting 简体中文 updates the selected register row and renders
  `zh-CN → en`;
- 27 code-owned definitions render in the coverage matrix;
- console warnings/errors: none;
- open P0/P1 findings: none.

The matrix owns its deliberate horizontal scrolling on narrow screens. No draft was saved or
published during QA.

