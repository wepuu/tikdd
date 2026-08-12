# Work item 12.5 design QA — platform management

## Visual direction

The Platforms area continues the Routing Observatory visual language but changes the primary task
from incident diagnosis to a **platform publication runway**. The owner should immediately see the
difference between “TikDD recognizes this URL” and “TikDD is ready to present this platform
publicly.”

The established Plus Jakarta Sans/Noto Sans typography and blue, violet, mint, and amber system are
retained. Catalog states use a compact explicit status rail rather than relying on copy alone:

- stable: operational blue;
- experimental: violet preview;
- planned: neutral/amber planning state;
- paused: explicit warning state.

The signature element is the five-check readiness runway. It puts catalog stability, route
coverage, page association, locale coverage, and SEO readiness before the publication editor.

## Boundary communication

- Recognized hosts, extractor keys, and adapter capabilities are grouped in a read-only facts
  panel.
- Editable public name, support label, visibility, and page association are visually separated from
  the code-owned facts.
- Exact platform/region confirmation and the blocking explanation remain adjacent to publication
  controls.
- Experimental and planned platforms may be prepared as preview/hidden but cannot be represented as
  indexable supported pages.

## Rendered checks

Actual local rendering was reviewed on 2026-08-12:

- desktop: platform catalog, facts, readiness, and editing surfaces preserve the intended hierarchy;
- mobile (375 CSS pixels): document width equals viewport width, with only deliberate component-
  level horizontal scrolling where dense platform facts require it;
- switching from TikTok to X updates both the selected catalog item and the management facts;
- browser console: no warnings or errors;
- no P0/P1 visual, interaction, accessibility, or responsive finding remains open.

No draft was saved or published during visual QA, and no external Provider was contacted.

