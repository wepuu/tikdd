import { pathToFileURL } from "node:url";

export const CANDIDATES = {
  tokvid: "https://tokvid.io/",
  tikcd: "https://tikcd.com/",
  "tikvid-io": "https://tikvid.io/",
  "gramsnap": "https://gramsnap.com/",
  savevid: "https://savevid.net/en",
  tikvid: "https://tikvid.cc/",
  snapinsta: "https://snapinsta.to/",
  fastdl: "https://fastdl.app/",
  "igram-world": "https://igram.world/",
  sssinstagram: "https://sssinstagram.com/",
  inflact: "https://inflact.com/instagram-downloader/",
  "savefrom-net": "https://en1.savefrom.net/25-instagram-reels-download-5Ie.html",
  collabstr: "https://collabstr.com/",
  igexport: "https://igexport.com/en/reels-download/",
  fastvideosave: "https://fastvideosave.net/",
  indown: "https://indown.io/reels/en2",
  ahm7_alldl: "https://ahm7xmakki.com/api/alldl",
  prexzy: "https://prexzyapis.com/download/igv2",
  cliplatch: "https://cliplatch.com/api/parse",
  "embedsocial-jp": "https://embedsocial.jp/tools/instagram-reels-downloader/",
  reelsvideo: "https://reelsvideo.io/",
  "save-free": "https://www.save-free.com/en/reels-downloader/",
  anonsaver: "https://anonsaver.com/en1/",
  "snap-insta": "https://snap-insta.to/en",
  dlreel: "https://dlreel.com/",
  vidssave: "https://vidssave.com/ins",
  "fdown-vn": "https://fdown.vn/en/instagram-downloader",
  "downloadmedia-app": "https://downloadmedia.app/instagram-video-downloader/",
  "bolta-ai": "https://bolta.ai/public-apps/video-downloader/instagram",
  luxa: "https://www.luxa.org/video/download",
  outfame: "https://www.outfame.com/free-instagram-tools/instagram-downloader",
  "sssinsta-za": "https://sssinsta.co.za/",
  iqsaved: "https://iqsaved.com/en1/",
  "ahm7_alldl": "https://ahm7xmakki.com/api/alldl",
  "cobalt-directory": "https://cobalt.directory/api/working?type=api",
  tdownv4: "https://tdownv4.sl-bjs.workers.dev/",
  clipx: "https://clipx.zamdev.workers.dev/",
  postvault: "https://postvault.edwardd.app/",
  tikwm: "https://tikwm.com/api/",
  fdown: "https://fdown.net/",
  "fdownloader-vn": "https://fdownloader.vn/",
  fget: "https://fget.io/",
  "instagram-video-downloader-vercel": "https://instagram-video-downloader-mu.vercel.app/",
  "reelsaver-fun": "https://www.reelsaver.fun/",
  "fdown-isuru": "https://fdown.isuru.eu.org/",
  "vidown-netlify": "https://vidown.netlify.app/",
  "socialdownloader-space": "https://www.socialdownloader.space/",
  "social-media-downloader-eight": "https://social-media-downloader-eight.vercel.app/",
  "gram-grabberz": "https://gram-grabberz.vercel.app/",
  facebookone: "https://facebookone.vercel.app/",
  reeldown: "https://reeldown.io/",
  mediafetcher: "https://mediafetcher.org/",
  pinsaver: "https://pinsaver.online/",
  "pinterest-videodownloader": "https://pinterest-videodownloader.com/",
  hhhdownload: "https://hhhdownload.com/",
  clipsave: "https://clipsave.org/",
  tryunsora: "https://tryunsora.com/",
  whitehole: "https://whitehole.page/",
  snapfetchr: "https://snapfetchr.com/",
  "reelsdownloader-in": "https://reelsdownloader.in/",
  savepanda: "https://www.savepanda.io/",
  snapvideo: "https://snapvideo.cc/",
  "savevideo-me": "https://savevideo.me/en/",
  "viddown-net": "https://www.viddown.net/download-vimeo-video",
  "downbot-app": "https://downbot.app/en"
};

/**
 * Reviewed Provider Lab protocol map. This is deliberately separate from the candidate
 * landing-page map so one hosted service can be evaluated independently per platform. An
 * endpoint entry records only the public method and URL; request bodies, cookies and upstream
 * media URLs never become part of the public Provider model.
 */
export const ACTIVE_ENDPOINTS = {
  "savevideo-me": Object.fromEntries([
    "dailymotion",
    "facebook",
    "vimeo",
    "x",
    "instagram",
    "tiktok",
    "reddit",
    "rumble"
  ].map((platform) => [platform, { method: "POST", url: "https://savevideo.me/en/get/" }])),
  "viddown-net": {
    vimeo: { method: "POST", url: "https://api.viddown.net/vimeo/v1/getLoaderList" }
  },
  "downbot-app": Object.fromEntries([
    "youtube",
    "tiktok",
    "facebook",
    "instagram",
    "vimeo",
    "x"
  ].map((platform) => [platform, { method: "POST", url: "https://api.downbot.app/api/download/request" }]))
};

export function resolveActiveEndpoint(providerId, platform) {
  const providerEndpoints = Object.hasOwn(ACTIVE_ENDPOINTS, providerId) ? ACTIVE_ENDPOINTS[providerId] : undefined;
  const endpoint = providerEndpoints && Object.hasOwn(providerEndpoints, platform)
    ? providerEndpoints[platform]
    : undefined;
  if (!endpoint) throw new Error(`No reviewed endpoint for ${providerId}/${platform}.`);
  return endpoint;
}

function contentTypeCategory(headers) {
  const value = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!value) return "missing";
  if (value === "text/html" || value === "application/xhtml+xml") return "html";
  if (value === "application/json" || value.endsWith("+json")) return "json";
  if (value.startsWith("text/")) return "text";
  return "other";
}

export function classifyTechnicalResponse({ status, challenge }) {
  if (challenge || status === 401 || status === 403) {
    return { state: "blocked", failureCode: "access_challenge" };
  }
  if (status === 419) return { state: "blocked", failureCode: "session_required" };
  if (status >= 200 && status < 400) return { state: "reachable", failureCode: null };
  if (status === 408 || status === 429 || status >= 500) {
    return { state: "deferred", failureCode: status >= 500 ? "upstream_unavailable" : "temporary_http_error" };
  }
  return { state: "blocked", failureCode: "http_error" };
}

async function probe(providerId, origin) {
  let current = new URL(origin);
  let redirectCount = 0;
  try {
    while (redirectCount <= 3) {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(10_000)
      });
      const location = response.headers.get("location");
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        const next = new URL(location, current);
        if (next.protocol !== "https:" || next.hostname !== current.hostname) {
          return { providerId, state: "blocked", failureCode: "redirect_outside_origin", status: response.status, contentType: contentTypeCategory(response.headers), redirectCount };
        }
        current = next;
        redirectCount += 1;
        continue;
      }
      const challenge = response.headers.get("cf-mitigated") === "challenge";
      const classification = classifyTechnicalResponse({ status: response.status, challenge });
      return {
        providerId,
        state: classification.state,
        failureCode: classification.failureCode,
        status: response.status,
        contentType: contentTypeCategory(response.headers),
        redirectCount
      };
    }
    return { providerId, state: "blocked", failureCode: "redirect_limit", status: null, contentType: "missing", redirectCount };
  } catch (error) {
    return {
      providerId,
      state: "blocked",
      failureCode: error?.name === "TimeoutError" ? "timeout" : "network_error",
      status: null,
      contentType: "missing",
      redirectCount
    };
  }
}

export async function runPreflight(ids = Object.keys(CANDIDATES)) {
  const selected = ids.filter((id) => Object.hasOwn(CANDIDATES, id));
  if (selected.length === 0) throw new Error("Provide a known provider id or --all.");
  const results = [];
  for (const id of selected) results.push(await probe(id, CANDIDATES[id]));
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ids = args.includes("--all") || args.length === 0 ? Object.keys(CANDIDATES) : args;
  const results = await runPreflight(ids);
  process.stdout.write(`${JSON.stringify({ event: "provider_technical_preflight", results })}\n`);
}
