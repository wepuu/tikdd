# Work item 6 — visual-direction execution plan

## Decision to make

Choose one visual system for the multilingual TikDD landing and resolver experience before any
production UI is changed. The three directions must help a first-time user paste an authorized
public-media page link, understand the asynchronous resolution state, compare formats, and request a
short-lived download without learning about providers or adapters.

The design target is the existing responsive Next.js homepage/resolver. The primary ideation frame
is the successful X resolution state at the same `1456 × 1080` desktop ratio as
[`homepage.png`](homepage.png). Mobile behavior is evaluated after a direction is selected rather
than placing desktop and mobile mockups in one generated image.

## Fixed brief

- Keep the TikDD name, light surface, blue signal color, multilingual routes, and the working
  recognition → queued → resolving → ready → delivery journey.
- Treat [`homepage.png`](homepage.png) as direction evidence, not a pixel-perfect cloning target.
- Make link submission the single dominant action. Format selection is the only major supporting
  area in the successful state.
- Remove provider names, raw warnings, architecture jargon, and upstream URLs from the consumer
  experience.
- Do not imply guaranteed speed, original quality, universal compatibility, absolute privacy,
  audience size, unlimited use, or a permanently free service.
- Show only product capabilities that exist or can be represented honestly: recognized public URLs,
  asynchronous resolution, normalized format choices, and expiring delivery.
- Use no more than two font families per direction. Type must accommodate English and Simplified
  Chinese without a visibly different brand voice.
- Use real icons from a reviewed library during implementation. Generated concepts may indicate icon
  placement, but improvised SVG, emoji, text-symbol, CSS-art, and fake platform marks are not assets.
- Preserve visible focus, reduced-motion behavior, 44-pixel touch targets, live status announcements,
  and a viable 360-pixel layout as non-negotiable implementation constraints.

## Three exploration axes

These are independent visual hypotheses, not minor color variations. Each gets its own Image Gen
request with the actual reference image attached.

### Signal runway

Make the resolver journey itself the brand signature: one calm horizontal path visibly changes from
recognized to ready and terminates in the format action. Keep the surrounding page precise and
quiet. The risk to test is whether an engineering-derived signal can feel clear to consumers rather
than technical.

### Format lens

Make the selected media and its format decision the visual center after resolution, while the URL
field compresses into a completed source row. The signature is a single “format lens” that compares
quality and composition without a dense table. The risk to test is whether the result can lead the
page without suggesting TikDD hosts or previews the media itself.

### Platform current

Use a flowing platform-to-format current as the spatial structure: recognized source at one end,
one normalized result at the other, with the route implied rather than explained. The signature is
the restrained directional field derived from link routing, not a generic decorative gradient. The
risk to test is keeping the hero action obvious while retaining the broad-platform story.

## Execution sequence

1. **Prepare one comparable state.** Use a fictional, rights-cleared X result with neutral metadata,
   four plausible MP4 choices, no user count, no third-party provider identity, and no live media
   URL. Use the current date only if a date appears.
2. **Write three compact direction sheets.** For each axis, define four to six named color tokens with
   hex values, at most two font families, one layout sentence, a small wireframe, one signature
   element, and one intentionally omitted decoration.
3. **Run the pre-generation frontend review.** Reject or revise any direction that could be reused for
   an unrelated SaaS landing page, defaults to a centered card-on-background composition, uses
   structure as decoration, spreads visual risk across multiple effects, or depends on unsupported
   copy.
4. **Generate exactly three independent images.** Run one Image Gen call per named direction, never a
   batch. Attach the actual homepage reference to every call and include the fixed brief, shared
   success-state data, target dimensions, bilingual typography constraint, and direction sheet.
5. **Validate the visible outputs.** Confirm there are exactly three single-screen results and that
   none contains clipped UI, multiple concepts, browser/device chrome, fake platform logos,
   unreadable primary copy, unsupported claims, or a broken core flow. A failed generation is not a
   selectable direction.
6. **Run the post-generation frontend review.** Record evidence for hierarchy, typography,
   TikDD-specific identity, restrained motion potential, English/Chinese fit, accessibility risk,
   responsive risk, truthful copy, and implementation feasibility. Review the reference and each
   concept directly rather than relying on filenames or prompt intent.
7. **Present for selection and stop.** Display the three valid images once, number them only in their
   visible conversation order, and ask the project owner to choose 1, 2, or 3 or request a refinement.
   Do not scaffold a prototype or modify production UI before that choice.
8. **Handoff after selection.** Preserve the chosen image as the visual target for the next work item.
   If feedback combines directions or materially changes the selected one, generate one revised target
   and obtain selection before implementation.

## Frontend review scorecard

The scorecard is a quality gate, not a winner-selection algorithm. A direction must have no critical
failure and must answer every row with visible evidence.

| Review area | Pass condition |
| --- | --- |
| Core action | Paste/resolve remains the unmistakable primary action. |
| Result hierarchy | Progress and format choice are legible without provider or architecture knowledge. |
| Product identity | The signature element follows link recognition, routing, or format selection and is not generic decoration. |
| Typography | Display/body roles are intentional, readable, and credible in both English and Simplified Chinese. |
| Visual restraint | Boldness is concentrated in one memorable device; other effects support hierarchy. |
| Truthfulness | No unsupported speed, quality, coverage, privacy, popularity, or pricing claim appears. |
| Accessibility | Contrast, focus affordance, control sizing, state distinction, and reduced-motion fallback are feasible. |
| Responsive fit | The structure can collapse to 360 px without reordering the user journey or hiding task feedback. |
| Build feasibility | The direction can be implemented in the current Next.js/React surface without fake assets or a new UI framework. |

## Required artifacts

- Three independent generated desktop direction images.
- Three direction sheets and one completed review scorecard stored under `docs/design/`.
- A short selection record naming the visible option number, decision date, accepted qualities, and
  any requested refinement.
- No production component, stylesheet, route, or dependency change until selection.

## Completion gate

Work item 6 is complete only when exactly three reviewed directions have been shown and the project
owner has selected one (or selected a revised composite). Image generation alone is not completion.
The selected image then becomes the source of truth for the multilingual implementation and
desktop/mobile visual QA in the next work item.
