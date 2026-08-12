# Work item 12.7 design QA — Publication proofing desk

Reviewed on 2026-08-12 against the running Admin implementation.

## Direction

The selected direction is a compact publication proofing desk rather than a generic CMS. Its
signature element is the four-stage publication film: structure validation, complete snapshot,
path acknowledgement, and public read. The workbench pairs constrained fields with the rendered
template so the owner reviews meaning and layout in one place.

## Actual-effect review

- Desktop: the publication film reads as one continuous state transition; the 220 px document index
  keeps locale/page scope visible while the editor and preview retain sufficient width.
- Preview: desktop/mobile switching changes only the preview canvas and cannot mutate content.
- Hierarchy: blue/violet identify editing and version state, mint signals completion, and amber is
  reserved for blockers or failed acknowledgement.
- Mobile 390 × 844: the editor becomes single-column. Long code-owned page catalogs, the publication
  film, and the coverage table scroll within their own bounded containers; the document itself does
  not overflow horizontally.
- Accessibility: native labels, selects, inputs and buttons remain keyboard-addressable; preview
  controls have explicit accessible names; state is expressed in text as well as color.

## Accepted follow-up

Work item 12.8 extends the structured editor with complete SEO/search/social previews and field-level
validation details. Work item 12.9 replaces the intentionally unavailable fourth film step with the
real public snapshot loader acknowledgement. These are explicit boundaries, not hidden success states.
