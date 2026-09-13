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
  inflact: "https://inflact.com/instagram-downloader/"
};

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
