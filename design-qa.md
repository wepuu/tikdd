# TikDD homepage redesign — design QA

## Comparison target

- Source visual truth: `docs/design/homepage.png`
- Final implementation screenshot: `docs/design/implementation-redesign-final.png`
- Mobile screenshots: `docs/design/implementation-redesign-mobile.png` and
  `docs/design/implementation-redesign-mobile-success.png`
- Route: `/en`; `/zh-CN` was also inspected for localization parity
- Desktop state: empty resolver with the truthful example-result layout visible
- Mobile interaction state: authorized X URL resolved successfully by the development provider

## Viewport and normalization

- Source pixels: 1448 × 1086.
- Final desktop implementation pixels: 1448 × 1209 at device pixel ratio 1.
- Browser CSS viewport request: 1463 × 1221. The in-app browser retained a 15-pixel vertical
  scrollbar gutter and a 12-pixel capture inset.
- Desktop comparison used the shared 1448-pixel width and the top 1086 pixels of the implementation.
  The implementation's additional 123 pixels contain the continuation below the source crop and
  were excluded from fidelity judgments.
- Mobile browser CSS viewport request: 390 × 844. The document client width was 375 pixels, the
  captured pixels were 375 × 812, and `scrollWidth === clientWidth === 375`.

## Full-view comparison evidence

The source and final implementation were opened together in one comparison input. Their visible
application canvases, header height, hero baseline, search control, platform row, three-card feature
strip, two-column process/result region, and FAQ start align to the same desktop grid. The source and
implementation were also opened individually at original detail; primary copy, form text, icons,
format rows, and borders remained readable, so a separate cropped-region comparison was not needed.

## Required fidelity surfaces

- **Fonts and typography:** Plus Jakarta Sans Variable reproduces the rounded geometric display and
  compact UI voice; Noto Sans SC Variable preserves the same weight hierarchy for Simplified
  Chinese. The heading scale, line height, negative tracking, two-line description, compact labels,
  and format-row weights match the source hierarchy without truncation.
- **Spacing and layout rhythm:** The 1192-pixel glass canvas, 72-pixel header, centered hero, 874-pixel
  resolver, three equal feature cards, and 0.9/2.1 workspace tracks reproduce the source proportions.
  Desktop anchors differ only where truthful copy has a different intrinsic width.
- **Colors and visual tokens:** The implementation maps the source to midnight ink, electric blue,
  violet, pale glass, and cool gray-blue borders. Blue-violet action gradients and restrained glow
  are limited to the primary controls and preview action.
- **Image quality and asset fidelity:** The flowing background and scenic preview are project-owned
  raster assets generated to match the reference art direction. They are sharp, correctly cropped,
  and contain no embedded text, fake UI, or watermark. Product and platform controls use Phosphor
  icons rather than custom SVG, CSS art, emoji, or text-symbol substitutes.
- **Copy and content:** Layout and density follow the source, while unsupported claims about speed,
  original quality, free service, absolute privacy, and audience size were deliberately replaced by
  accurate resolver, format-normalization, and controlled-delivery language.
- **Responsiveness and accessibility:** The 375-pixel client layout has no horizontal overflow.
  Navigation collapses, controls remain at least 44 pixels, authorization stays adjacent to the
  primary action on mobile, focus indicators remain visible, and reduced-motion disables motion.
  English and Simplified Chinese expose equivalent semantic structure with no mojibake.

## Comparison history

### Pass 1 — blocked

- **P1:** The first redesign placed the process/result workspace before the three feature cards,
  reversing the reference hierarchy. Fixed by moving the feature strip ahead of the workspace.
- **P2:** The standalone rights/status row pushed all lower sections roughly 15–30 pixels below the
  source rhythm. Fixed by moving desktop authorization into the process-card safety row and
  recalibrating the platform-row gap.

Evidence: `docs/design/implementation-redesign-pass1.png`.

### Pass 2 — blocked

- **P2:** Mobile authorization was visually separated from the disabled primary action. Fixed by
  adding a mobile-only rights control directly below the resolve button while keeping the desktop
  control in the source-aligned process card.

Evidence: `docs/design/implementation-redesign-pass2.png` and
`docs/design/implementation-redesign-mobile.png`.

### Final pass — passed

- No actionable visual-fidelity P0, P1, or P2 differences remained against the selected reference
  at the original handoff. A later task-flow audit identified separate P0 journey issues; those are
  closed in the work item 7.1 section below.
- Intentional deviations are limited to truthful product copy, multilingual controls, omission of an
  unsupported audience testimonial, and omission of a nonfunctional theme toggle.

## Functional verification

- Filled the public URL field with the authorized X canary.
- Checked the rights confirmation control.
- Submitted the resolver and observed the `Development provider result` success heading.
- Verified English and Simplified Chinese DOM content and navigation.
- Verified a clean browser console in a fresh tab: no warnings or errors.
- `pnpm check` passed: repository text checks, all workspace type checks, 45 tests, and production
  builds for Web, API, worker, and delivery.

## Follow-up polish

- P3: A future theme system may add the reference's moon control when a real dark theme exists.
- P3: An approved thumbnail-delivery boundary can replace the neutral resolved-media preview without
  loading arbitrary upstream image URLs in the browser.

## Work item 7.1 — P0 task-flow closure

Date: 2026-08-07.

### Audit findings closed

- The rights confirmation is now directly beneath the resolver on desktop and mobile. A recognized
  link visibly explains that confirmation is required while Resolve remains disabled.
- Editing or clearing the submitted URL resets the rights confirmation.
- A successful task moves focus and the viewport to the result card. The scroll uses `auto` when the
  user requests reduced motion.
- On mobile, a resolving or successful task places the result first and removes feature/process
  education from the active task path. Empty state restores both sections.
- Mock or provider-flavored development titles are replaced by localized `Resolved media` /
  `已解析媒体` copy. The result view exposes no provider or adapter name.
- Real results use normalized author, duration, platform, and format-count fields when present.
  Until thumbnail delivery has its own reviewed boundary, the resolved state uses a neutral
  Phosphor media icon instead of presenting the scenic example as real content.

### Browser evidence

- Desktop empty: `docs/design/work-item-7.1/01-desktop-empty.jpg` (`1433 × 1075`).
- Desktop recognized, rights required: `docs/design/work-item-7.1/02-desktop-rights-required.jpg`
  (`1433 × 1075`).
- Desktop success with result focus: `docs/design/work-item-7.1/03-desktop-success.jpg`
  (`1433 × 1075`).
- Mobile success with result-first task order: `docs/design/work-item-7.1/04-mobile-success.jpg`
  (`375 × 812`).
- Mobile empty state with education restored: `docs/design/work-item-7.1/05-mobile-empty.jpg`
  (`375 × 812`).
- Simplified Chinese empty and success states: `docs/design/work-item-7.1/06-mobile-zh-cn.jpg` and
  `docs/design/work-item-7.1/07-mobile-zh-success.jpg` (`375 × 812`).

### Interaction verification

- Authorized X link recognition produced a visible rights-required explanation.
- Confirming rights enabled Resolve; the development mock completed through API, queue, worker, and
  persistence.
- On success, `document.activeElement` was the result card in both English and Simplified Chinese.
- At mobile success, feature and process regions were absent from the rendered accessibility tree;
  clearing the URL restored both and reset the checkbox.
- Mobile `scrollWidth` remained `375` at a `390 × 844` requested viewport, with no horizontal
  overflow.
- Presentation tests cover real-title preservation, mock/development-title redaction, and duration
  formatting.
- Final `pnpm check` passed with 45 tests and production builds for Web, API, worker, and delivery.

### Remaining non-P0 polish

- P1: Raise compact process, format, FAQ, and safety copy to the planned minimum text sizes and
  re-check contrast at 200% zoom.
- P2: Add screenshot coverage for terminal failure, retryable failure, and expired-delivery states
  when those fixtures are available in the browser harness.

## Final result

final result: passed

## Work item 8 — Product Design boundary review

Date: 2026-08-07.

Work item 8 changes provider reliability and internal operations rather than the consumer journey.
The Product Design review therefore keeps the existing multilingual resolver and result experience
unchanged. Provider IDs, circuit states, policy versions, and failure counts remain absent from the
Web UI. The only new inspection surface is a separately credentialed, metadata-only internal API;
it is not an indexable route, public OpenAPI operation, or consumer administration screen. No new
visual target or browser screenshot QA is required for this backend-only boundary.
