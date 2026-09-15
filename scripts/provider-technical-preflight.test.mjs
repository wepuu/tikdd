import { describe, expect, it } from "vitest";
import { CANDIDATES, classifyTechnicalResponse } from "./provider-technical-preflight.mjs";

describe("technical Provider preflight classification", () => {
  it("marks ordinary HTTP success as reachable", () => {
    expect(classifyTechnicalResponse({ status: 200, challenge: false })).toEqual({ state: "reachable", failureCode: null });
  });

  it("marks challenge as blocked and temporary failures as deferred", () => {
    expect(classifyTechnicalResponse({ status: 403, challenge: true })).toEqual({ state: "blocked", failureCode: "access_challenge" });
    expect(classifyTechnicalResponse({ status: 503, challenge: false })).toEqual({ state: "deferred", failureCode: "upstream_unavailable" });
    expect(classifyTechnicalResponse({ status: 429, challenge: false })).toEqual({ state: "deferred", failureCode: "temporary_http_error" });
    expect(classifyTechnicalResponse({ status: 419, challenge: false })).toEqual({ state: "blocked", failureCode: "session_required" });
  });

  it("keeps the Instagram candidate mappings explicit", () => {
    expect(CANDIDATES).toMatchObject({
      fastdl: "https://fastdl.app/",
      snapinsta: "https://snapinsta.to/",
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
      ahm7_alldl: "https://ahm7xmakki.com/api/alldl",
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
      "vidown-netlify": "https://vidown.netlify.app/"
    });
  });
});
