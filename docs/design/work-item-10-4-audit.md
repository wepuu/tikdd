# Work item 10.4 real-journey Product Design audit

Date: 2026-08-10.

## Outcome

The Signal Runway visual direction remains unchanged. The audit closed four P0 journey gaps in the
implemented resolver: failure states no longer reuse the example result, slower resolution has a
useful follow-up announcement without an invented ETA, delivery is now an explicit short-lived-link
step, and an expired or consumed link can be regenerated in place. No provider name, route depth,
circuit state, internal warning, upstream URL, or unsupported product claim appears in a consumer
state.

The browser scenarios used for this audit are deterministic development-only states on the existing
localized page. They are ignored when `NODE_ENV` is not `development`; they perform no provider,
media, API, or delivery request.

## Baseline findings

Initial screenshots were captured before implementation:

- [desktop empty](work-item-10-4/01-baseline-desktop-empty.png);
- [desktop recognized and rights required](work-item-10-4/02-baseline-desktop-recognized.png).

The screenshots and implemented state logic exposed these rollout-blocking gaps:

1. A task or admission failure left the scenic example and disabled example formats visible, which
   could be interpreted as the failed video's result.
2. Delivery navigated away as soon as ticket creation succeeded, so the product could not confirm a
   prepared short-lived link or offer an in-context replacement after expiry or one-time use.
3. A slower successful route kept repeating only the initial resolving sentence and gave no later
   live-region update.
4. Format rows, FAQ summaries, clear control, and language links did not all meet the 44-pixel touch
   target used by the work-item exit gate. The custom radio group also lacked arrow-key navigation.

## Audited journey

1. **Recognized link and rights confirmation — healthy.** A recognized X URL leaves Resolve
   disabled until confirmation and explains the required action. Editing or clearing the URL resets
   confirmation and all task/delivery state. Evidence:
   [desktop](work-item-10-4/02-baseline-desktop-recognized.png) and
   [360px mobile](work-item-10-4/12-mobile-recognized.png).
2. **Normal success and ready formats — healthy.** Success moves keyboard focus to the neutral
   result card, shows normalized metadata and formats, and exposes no upstream or provider detail.
   Evidence: [desktop](work-item-10-4/05-desktop-slower-ready.png),
   [English mobile](work-item-10-4/13-mobile-ready.png), and
   [Simplified Chinese mobile](work-item-10-4/17-mobile-zh-ready.png).
3. **Slower success — healthy.** After the initial resolving announcement, the live region changes
   to “Still checking available formats…” without promising a completion time. Its eventual ready
   state is visually and semantically identical to normal success. Evidence:
   [waiting](work-item-10-4/04-desktop-slower-working.png) and
   [ready](work-item-10-4/05-desktop-slower-ready.png).
4. **Retryable and duplicate states — healthy.** Both focus the result card, replace example media
   with a neutral warning state, explain when to retry, and keep an explicit Resolve action. Evidence:
   [temporary failure](work-item-10-4/06-desktop-retryable-failure.png),
   [duplicate submission](work-item-10-4/11-desktop-duplicate.png), and
   [mobile temporary failure](work-item-10-4/14-mobile-retryable.png).
5. **Terminal unavailable/private state — healthy.** The result describes public availability and
   access without encouraging a provider fallback or restriction bypass. It does not offer a retry
   action that would imply the same private input can be made public. Evidence:
   [desktop](work-item-10-4/07-desktop-private-failure.png),
   [English mobile](work-item-10-4/15-mobile-private.png), and
   [Simplified Chinese mobile](work-item-10-4/18-mobile-zh-private.png).
6. **Delivery request and expiry recovery — healthy.** “Prepare download” creates only an opaque,
   short-lived TikDD delivery link. “Start download” is a separate user action. Expired or consumed
   links change to “Create a new link” and return to the ready state after regeneration. No media
   link was opened during QA. Evidence: [prepared](work-item-10-4/08-desktop-delivery-ready.png),
   [expired](work-item-10-4/09-desktop-delivery-expired.png),
   [regenerated](work-item-10-4/10-desktop-delivery-regenerated.png), and
   [mobile expired](work-item-10-4/16-mobile-delivery-expired.png).

## Accessibility and responsive evidence

- The requested mobile viewport was 360 × 800; the in-app browser retained a 15-pixel scrollbar
  gutter, producing a 345 × 767 capture and `scrollWidth === clientWidth === 345`.
- Resolve is 50 pixels high, the rights control is 48, the download action is 48, format radios and
  FAQ summaries are 44, and each language target is 44 × 44 pixels.
- Result focus moves to the terminal result for ready, retryable, duplicate, private, and expired
  task states. Mobile task states hide educational feature/process content from the active path.
- Format radios use roving tab focus and support Arrow keys, Home, and End. Focus rings remain the
  existing high-contrast blue treatment.
- English and Simplified Chinese keep the same content order, controls, failure intent, and focus
  destination. Chinese screenshots contain no mojibake.
- Reduced-motion behavior remains intact: smooth result scrolling becomes immediate and the
  resolving spinner is disabled under `prefers-reduced-motion: reduce`.

## Visual comparison

The [final desktop empty state](work-item-10-4/19-final-desktop-empty.png) was reviewed beside
[the selected homepage direction](homepage.png) at the same 1448-pixel content width.
Typography, glass canvas, blue-violet actions, neutral preview, platform row, workspace proportions,
and restrained warning treatment remain inside the selected system. Changes are limited to task
state clarity, touch size, readable compact copy, and delivery recovery. No new visual concept or
provider-specific UI was introduced.

## Limits and follow-up

- Browser evidence is deterministic and makes no external provider request. Live route reliability
  remains an operations concern for work item 10.5.
- The in-app browser cannot emulate a user-level reduced-motion preference in this run; the existing
  CSS media query and runtime `matchMedia` branch were preserved and production build verification
  covers their syntax.
- A real delivery click was intentionally not followed because this audit validates UI handoff, not
  media transfer.

## Final result

P0 findings remaining: 0.

Final result: passed.
