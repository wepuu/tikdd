# Work item 12.4 design QA — guarded route policy

## Evidence

- Actual local Admin with Docker PostgreSQL/Redis and the real Admin API composition path.
- Desktop review at the browser default viewport.
- Responsive review at a requested 390 × 844 viewport; rendered content viewport was 375px.
- One reversible draft-save/discard interaction through the visible UI.

## Findings resolved

### P0 — A draft could appear equivalent to an active policy

The header now distinguishes `Manifest baseline`, `草稿未发布`, `传播中`, `已传播`, and `传播失败`.
Draft creation never changes the runtime runway.

### P0 — Old read-only copy contradicted the new controls

The route inspector, owner badge, alert guidance, and next-step copy now describe guarded commands,
resume-never-grants, and preset probes instead of promising a future 12.4 milestone.

### P1 — Mutation failure could look like a normal refresh failure

Command feedback is local to the editor and explicitly says that a conflict or rejection did not
silently overwrite the current strategy. Publish completion requires a propagated receipt.

### P1 — Safety actions needed stronger scope than a platform policy

Draft commands require `platform/region`; pause, deny, resume, and probe require
`provider/platform/region`. Controls remain disabled until the exact text and a bounded reason are
present.

### P1 — Dense controls could overflow mobile

The comparison band and editor collapse to one column. Provider rows reflow labels beneath the
route identity. Measured `scrollWidth === clientWidth === 375`; no page-level horizontal overflow
remains.

## Open findings

No P0 or P1 design findings remain for work item 12.4. Platform presentation editing belongs to
12.5; multilingual content and SEO editors remain later work items.
