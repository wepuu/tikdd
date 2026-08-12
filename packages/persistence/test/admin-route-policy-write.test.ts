import { readFile } from "node:fs/promises";
import { describe,expect,it } from "vitest";

describe("Admin route-policy write boundary",()=>{
  it("uses row locks, optimistic heads, expiring idempotency receipts, and immutable promotion",async()=>{
    const source=await readFile(new URL("../src/admin-route-policy.ts",import.meta.url),"utf8");
    expect(source).toContain("FOR UPDATE");expect(source).toContain("requireExpected");expect(source).toContain("idempotency_digest");
    expect(source).toContain("revision_kind");expect(source).toContain("nextval('admin_route_policy_projection_revision_seq')");
    expect(source).not.toContain("putSnapshot");
  });
  it("resumes only by expiring the exact Admin deny and never writes a grant",async()=>{
    const source=await readFile(new URL("../src/admin-route-policy.ts",import.meta.url),"utf8");
    const safety=source.slice(source.indexOf("async applySafetyControl"),source.indexOf("async acceptProbe"));
    expect(safety).toContain("admin-deny-");expect(safety).toContain("enabled=FALSE,allocation_bps=0");expect(safety).toContain('command.action==="resume"');
    expect(safety).not.toContain("enabled=TRUE");
  });
});

describe("Admin platform-presentation write boundary",()=>{
  it("uses immutable revisions and never writes catalog recognition or adapter capability",async()=>{
    const source=await readFile(new URL("../src/admin-platform-presentation.ts",import.meta.url),"utf8");
    expect(source).toContain("FOR UPDATE");expect(source).toContain("revision_kind");expect(source).toContain("platform_presentation");
    expect(source).not.toMatch(/recognized_hosts|extractor_keys|allow_subdomains|delivery_allowlist/);
  });
});
