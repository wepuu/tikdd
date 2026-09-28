# Work Item 117 — Content Snapshot Revision Ordering

## Outcome

Fix content publication after revision 9. Snapshot queries selected `revision::text` and then used
the unqualified output name in `ORDER BY revision DESC`. PostgreSQL therefore sorted the selected
text value, placing revision `9` ahead of revision `10`. Admin attempted to create revision `10`
again and PostgreSQL rejected the duplicate `(deployment, revision)` key.

## Change

- Order the three latest/recent snapshot queries by the qualified BIGINT source column
  `admin_published_snapshots.revision`.
- Preserve text conversion only for the JavaScript result boundary.
- Add a regression assertion covering every publication query so the unqualified text ordering
  cannot return.

No schema, public API, Provider routing, Delivery behavior, or content model changes are required.

## Production repair

Deploy the corrected Service image to Admin API, keep the existing Web and Provider runtime state,
then publish the already-ready 117-page content set as the next immutable snapshot. Verify that the
active snapshot includes all nine YouTube pages and that localized YouTube routes no longer return
404.
