# Work Item 124: Cobalt runtime root-schema correction

## Finding

The first production probe for the private Cobalt 11 container confirmed that the key file,
supplementary secrets group, container health, and `Api-Key` authentication all work. The probe
still returned failure because it looked for `services` at the JSON root. Cobalt's documented
`GET /` response nests the service list under `cobalt.services`; the response observed in the
container contained `cobalt` and `git` objects.

## Fix

Read only `body.cobalt.services` and accept the reviewed `ok` service. The probe continues to
emit only a pass/fail line, never the API key, response body, source URL, or media URL. The three
Cobalt gates remain false and the Cobalt profile is stopped after verification.

No Provider adapter, Delivery policy, public route, database migration, or rollout rule changes.
