# OK.ru free Provider candidate batch

## Current decision

Work Items 118 and 119 closed without a production Provider. Work Item 120 later reproduced
Vidomon's real anonymous protocol, but its direct OK CDN resources returned HTTP 400 and its working
download wrapper remained bound to the Provider browser session. OK.ru remains planned and receives
no public traffic. This record is based on protocol and delivery behavior, not landing-page claims.

| Candidate | Protocol result | Delivery result | State |
| --- | --- | --- | --- |
| TryUnSora OK.ru | Landing page reachable; no reproducible anonymous endpoint | Not tested | Deferred |
| MediaPuller | Anonymous form produced OK CDN candidates | Candidate media returned HTTP 400 | No media |
| Get-From.net | Dynamic client protocol was not reproducible | Not tested | Blocked |
| A2Z | Metadata endpoint returned a negative success envelope | No media | No media |
| ToolSphare | Slow JSON success envelope; one malformed page descriptor | POST/stream topology did not yield a browser GET | No media |
| SaveClips | Anonymous nonce; final bounded request returned no media | Not verified | No media |
| OKGrabber | Two native samples resolved; NL Range returned `206 video/mp4` | Signed CDN URL failed from two client exits; download endpoint returned HTML | Blocked |
| SparkDownloader | Page and unified client reachable; no reviewed OK.ru endpoint | Not tested | Deferred |
| OKVid | Anonymous same-origin form returned HTTP 200 HTML with no safe MP4 | Mandatory media gate not reached | No media |
| PasteDownload | Anonymous same-page form with page-issued hidden fields returned no safe MP4 | Mandatory media gate not reached | No media |
| SnapFrom | Browser session/token flow; no reproducible anonymous endpoint | Not tested | Blocked |
| AnyDownloader Web | Hosted API requires browser token state; distinct from the earlier self-hosted candidate | Not tested | Blocked |
| Vidomon | Fresh landing token plus deterministic same-origin REST request returned six MP4 descriptors for each of two samples | Direct CDN GET/Range returned 400; cookie-free wrapper returned HTML | Delivery blocked |

The repository stores only endpoint paths, counts, booleans, and failure classes. It does not store
sample URLs, signed CDN URLs, response bodies, nonce values, cookies, tokens, query values, or full
CDN hosts.

## Requalification gate

A later candidate must satisfy all of the following before an adapter is implemented:

1. Two distinct public native OK.ru videos resolve without login, user cookies, CAPTCHA, or copied
   browser state.
2. At least one normalized progressive format per sample returns non-zero `200/206 video/*` for a
   one-kibibyte Range request.
3. The same short-lived address succeeds from an independent client exit; resolver-IP-bound URLs
   fail this gate.
4. Browser delivery is an HTTPS GET with at most three reviewed redirects and no Provider page.
5. Exact media hosts and paths can be represented by a versioned Delivery policy without turning
   Delivery into a general proxy.

See [ADR-0056](../architecture/adr/0056-okru-portable-delivery-boundary.md).
Vidomon's narrower implementation decision is recorded in
[ADR-0057](../architecture/adr/0057-vidomon-okru-direct-delivery.md).
