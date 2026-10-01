import { describe, expect, it, vi } from "vitest";
import {
  classifyCobaltOriginHairpin,
  parseCobaltTunnelAuditPlan,
  runCobaltTunnelAudit
} from "../src/cobalt-tunnel-audit";

function descriptor(overrides: Record<string, string> = {}): string {
  const query = new URLSearchParams({
    id: "a".repeat(21),
    exp: String(Date.now() + 240_000),
    sig: "b".repeat(43),
    sec: "c".repeat(43),
    iv: "d".repeat(22),
    ...overrides
  });
  return `https://media.tikdd.cc/tunnel?${query.toString()}`;
}

describe("Cobalt tunnel delivery audit", () => {
  it("accepts only bounded signed descriptors at the reviewed tunnel endpoint", () => {
    expect(parseCobaltTunnelAuditPlan({
      exit: "client-direct",
      samples: [{ id: "tiktok-a", url: descriptor() }]
    }).samples).toHaveLength(1);
    expect(() => parseCobaltTunnelAuditPlan({
      exit: "client-direct",
      samples: [{ id: "bad", url: descriptor({ extra: "value" }) }]
    })).toThrow(/query/i);
    expect(() => parseCobaltTunnelAuditPlan({
      exit: "client-direct",
      samples: [{ id: "bad", url: descriptor().replace("media.tikdd.cc", "media.tikdd.cc.example.com") }]
    })).toThrow(/host/i);
  });

  it("passes a non-zero attachment MP4 range with exact CORS and private caching", async () => {
    const plan = parseCobaltTunnelAuditPlan({
      exit: "client-proxy",
      samples: [{ id: "tiktok-a", url: descriptor() }]
    });
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([0, 1, 2, 3]), {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-range": "bytes 0-3/100",
        "content-disposition": "attachment; filename=fixture.mp4",
        "access-control-allow-origin": "https://www.tikdd.cc",
        "cache-control": "private, no-store",
        "cf-ray": "sanitized"
      }
    }));
    const results = await runCobaltTunnelAudit(plan, {
      webOrigin: "https://www.tikdd.cc",
      fetchImpl
    });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      headers: { Range: "bytes=0-1023", Origin: "https://www.tikdd.cc" }
    }));
    expect(results).toEqual([expect.objectContaining({
      sampleId: "tiktok-a",
      exit: "client-proxy",
      outcome: "passed",
      httpStatus: 206,
      nonZeroBytes: true,
      cloudflareRequestIdObserved: true,
      failureCode: null
    })]);
    expect(JSON.stringify(results)).not.toMatch(/media\.tikdd|[?&](id|exp|sig|sec|iv)=|fixture\.mp4|sanitized/);
  });

  it("classifies an edge 403 without emitting headers or the descriptor", async () => {
    const plan = parseCobaltTunnelAuditPlan({
      exit: "origin-hairpin",
      samples: [{ id: "tiktok-a", url: descriptor() }]
    });
    const results = await runCobaltTunnelAudit(plan, {
      webOrigin: "https://www.tikdd.cc",
      fetchImpl: async () => new Response("blocked", { status: 403, headers: { "cf-ray": "secret-ray" } })
    });
    expect(results[0]).toMatchObject({
      outcome: "failed",
      httpStatus: 403,
      cloudflareRequestIdObserved: true,
      failureCode: "http_rejected"
    });
    expect(classifyCobaltOriginHairpin(results[0]!, null)).toBe("blocked-unclassified");
    expect(classifyCobaltOriginHairpin(results[0]!, false)).toBe("edge-blocked");
    expect(classifyCobaltOriginHairpin(results[0]!, true)).toBe("origin-rejected");
    expect(JSON.stringify(results)).not.toContain("secret-ray");
    expect(JSON.stringify(results)).not.toContain("blocked");
  });

  it("rejects missing attachment, broad CORS and cacheable responses", async () => {
    const plan = parseCobaltTunnelAuditPlan({
      exit: "client-direct",
      samples: [{ id: "tiktok-a", url: descriptor() }]
    });
    const response = (headers: Record<string, string>) => new Response(new Uint8Array([1]), {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-range": "bytes 0-0/1",
        "content-disposition": "attachment",
        "access-control-allow-origin": "https://www.tikdd.cc",
        "cache-control": "private, no-store",
        ...headers
      }
    });
    await expect(runCobaltTunnelAudit(plan, {
      webOrigin: "https://www.tikdd.cc",
      fetchImpl: async () => response({ "content-disposition": "inline" })
    })).resolves.toEqual([expect.objectContaining({ failureCode: "attachment_rejected" })]);
    await expect(runCobaltTunnelAudit(plan, {
      webOrigin: "https://www.tikdd.cc",
      fetchImpl: async () => response({ "access-control-allow-origin": "*" })
    })).resolves.toEqual([expect.objectContaining({ failureCode: "cors_rejected" })]);
    await expect(runCobaltTunnelAudit(plan, {
      webOrigin: "https://www.tikdd.cc",
      fetchImpl: async () => response({ "cache-control": "public, max-age=60" })
    })).resolves.toEqual([expect.objectContaining({ failureCode: "cache_policy_rejected" })]);
  });
});
