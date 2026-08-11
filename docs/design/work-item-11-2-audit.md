# Work item 11.2 actual-success Product Design audit

Date: 2026-08-10.

## Outcome

The authorized X journey completed through recognition, real resolution, normalized format
selection, one-use redirect delivery, natural ticket expiry, regeneration, and one redeemed browser
handoff. The Signal Runway direction remains unchanged. Two P1 issues found in the real journey
were corrected: download handoff now sets the new-tab expectation before the click and announces
the browser handoff afterward, and all desktop header navigation targets now meet the 44-pixel
project target. P0 findings remaining: 0. P1 findings remaining: 0.

The public page never displayed a provider name, fallback depth, circuit state, internal warning,
upstream URL, exact completion-time promise, or universal download claim.

## Scope and authorization

The project owner supplied a new public X test URL and authorized submission to TwitterSaver and
SSSTwitter with bounded priority fallback, one browser download, delivery expiry, and regeneration.
The authorization excluded account cookies, private content, challenge bypass, and access-control
bypass. The live route needed two resolutions because the first candidate expired while the
handoff states were being captured. Both resolutions succeeded at the first eligible route in
3,408 ms and 931 ms, so SSSTwitter was not contacted and a live fallback was not manufactured.

Three redirect tickets were created: two expired unused while expiry and regeneration were audited;
the final ticket was redeemed once by the browser. Only the sanitized attempt and ticket states
were inspected. Provider responses, direct media URLs, headers, cookies, and downloaded media bytes
were not recorded in the audit.

## Audited journey

1. **Recognized link — healthy.** The X URL is recognized before submission, Resolve stays disabled
   until rights confirmation, and the required action is clear. Evidence:
   [desktop](work-item-11-2/01-desktop-recognized.png) and
   [360px mobile](work-item-11-2/02-mobile-recognized.png).
2. **Resolving — healthy.** The primary action becomes disabled and busy, the result card replaces
   the example with a neutral resolving state, and no provider operation is exposed. Evidence:
   [desktop](work-item-11-2/03-desktop-resolving.png) and
   [360px mobile](work-item-11-2/04-mobile-resolving.png).
3. **Slower fallback presentation — healthy with a named live-evidence limit.** The real primary
   route completed before the 3.5-second follow-up announcement and did not fall back. The current
   development-only state was therefore captured as supplementary evidence instead of forcing a
   provider failure. It announces that checking continues without an ETA or route detail. Evidence:
   [desktop](work-item-11-2/26-qa-desktop-slower-fallback.png) and
   [360px mobile](work-item-11-2/27-qa-mobile-slower-fallback.png).
4. **Formats ready — healthy.** Real normalized metadata and three video-with-audio choices are
   legible, the result receives focus, and the selected format is explicit. Evidence:
   [desktop](work-item-11-2/06-desktop-formats-ready.png) and
   [360px mobile](work-item-11-2/05-mobile-formats-ready.png).
5. **Preparing download — healthy.** The chosen format remains visible while the action becomes a
   disabled busy state. Evidence: [desktop](work-item-11-2/07-desktop-preparing-download.png) and
   [360px regeneration equivalent](work-item-11-2/13-mobile-regenerating.png).
6. **Short-lived link ready — healthy after correction.** The link is a separate user action and
   now says it opens in a new tab. Evidence: actual
   [desktop](work-item-11-2/10-desktop-link-ready.png) and
   [360px mobile](work-item-11-2/09-mobile-link-ready.png), plus corrected
   [English ready](work-item-11-2/17-qa-en-desktop-link-ready.png) and
   [Simplified Chinese ready](work-item-11-2/20-qa-zh-desktop-link-ready.png).
7. **Browser handoff — healthy after P1 correction.** The final live one-use ticket was redeemed.
   After the click, the result now announces that the download was handed to the browser in a new
   tab and offers a clearly named replacement action. Evidence:
   [English desktop](work-item-11-2/18-qa-en-desktop-handoff.png),
   [English mobile](work-item-11-2/19-qa-en-mobile-handoff.png),
   [Chinese desktop](work-item-11-2/21-qa-zh-desktop-handoff.png), and
   [Chinese mobile](work-item-11-2/22-qa-zh-mobile-handoff.png).
8. **Expired link — healthy.** Natural expiry removes Start download, explains expiry or one-time
   use, and exposes Create a new link in place. Evidence:
   [desktop](work-item-11-2/11-desktop-expired.png) and
   [360px mobile](work-item-11-2/12-mobile-expired.png).
9. **Regeneration — healthy.** Regeneration reuses the selected format, announces Preparing, and
   returns to a fresh short-lived link without another public resolution step. Evidence:
   [mobile preparing](work-item-11-2/13-mobile-regenerating.png),
   [mobile ready](work-item-11-2/14-mobile-regenerated-ready.png), and
   [desktop ready](work-item-11-2/15-desktop-regenerated-ready.png).

## Evidence-backed corrections

1. **P1 — browser handoff expectation and state.** Before correction, Start download used
   `target="_blank"`, but the ready copy did not set that expectation and the post-click state reused
   the ambiguous expired-or-used sentence. The corrected flow states the new-tab behavior before
   the click, announces browser handoff in a live status afterward, and keeps Create a new link as
   the recovery action in both locales.
2. **P1 — 44-pixel desktop navigation targets.** Measured desktop navigation links were 15 pixels
   high and the header Resolve target was 40 pixels. They now measure 44 pixels high; mobile locale
   targets remain 44 by 44 and the main download action remains 48 pixels high.

## Accessibility and responsive evidence

- Ready, retryable, terminal, and expired task states continue to move focus to the result section.
- The format selector retains a single roving tab stop. ArrowDown moved selection and focus from
  720p to 360p in the browser; Arrow keys, Home, and End remain implemented.
- Resolving, slower-resolution, link-ready, expiry, and handoff changes use `role="status"`;
  delivery errors use `role="alert"`.
- The measured 360-pixel viewport retained a 15-pixel browser gutter and produced
  `clientWidth === scrollWidth === 345`, with no horizontal overflow.
- Desktop navigation and header action targets are 44 pixels high. Locale targets are 44 by 44,
  format rows are 44, and download actions are 48.
- Reduced motion remains code-verified: result scrolling becomes immediate when
  `prefers-reduced-motion: reduce` matches, and spinner animation is disabled by the matching CSS
  media query. The in-app browser did not expose preference emulation, so this is not a user-setting
  runtime claim.
- English and Simplified Chinese preserve the same reading order, state intent, target sizes, and
  recovery action. Chinese captures contain no mojibake.

## Visual comparison

The [combined comparison](work-item-11-2/23-comparison-signal-runway-10-4-actual.png) places the
selected Signal Runway reference, the work item 10.4 deterministic ready state, and the work item
11.2 actual ready state together. The bright glass canvas, restrained blue-violet actions, platform
row, two-column task workspace, type hierarchy, and quiet safety treatment remain consistent. The
P1 changes alter only action clarity and target geometry; they do not introduce a new visual
direction. See also the [actual journey sheet](work-item-11-2/24-actual-journey-contact-sheet.png)
and [bilingual handoff sheet](work-item-11-2/25-bilingual-handoff-contact-sheet.png).

## Evidence limits

- The authorized URL succeeded through the first eligible provider twice, so no real fallback
  occurred. The slower/fallback consumer state is current-run deterministic evidence and is not
  represented as a live provider result.
- The in-app browser did not surface a downloadable-file event for the `target="_blank"` redirect.
  PostgreSQL confirmed that the final one-use delivery ticket was redeemed; the audit does not
  independently claim that a file was saved to the user's Downloads folder or inspect media bytes.
- Screenshots and DOM checks support this combined UX/accessibility audit but do not establish full
  WCAG conformance or cross-browser behavior.

## Final result

P0 findings remaining: 0.

P1 findings remaining: 0.

Result: passed with the live-fallback and browser-download-event evidence limits above.
