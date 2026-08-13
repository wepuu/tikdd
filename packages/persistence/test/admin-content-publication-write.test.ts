import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Admin content publication write boundary",()=>{
  it("keeps draft promotion, snapshot insertion, and its receipt in one transaction",async()=>{
    const source=await readFile(new URL("../src/admin-content-publication.ts",import.meta.url),"utf8");
    const publish=source.slice(source.indexOf("async publish("),source.indexOf("async completePropagation("));
    expect(publish).toContain("this.tx(async client=>");
    expect(publish).toContain("INSERT INTO admin_published_snapshots");
    expect(publish).toContain("UPDATE admin_locale_heads");
    expect(publish).toContain("UPDATE admin_page_heads");
    expect(publish).toContain("UPDATE admin_shared_content_heads");
    expect(publish).toContain("return receipt(client");
  });

  it("moves the active pointer only after successful propagation",async()=>{
    const source=await readFile(new URL("../src/admin-content-publication.ts",import.meta.url),"utf8");
    const complete=source.slice(source.indexOf("async completePropagation("),source.indexOf("async rollback("));
    expect(complete).toContain('if(success)');
    expect(complete).toContain("INSERT INTO admin_published_snapshot_heads");
    expect(complete).toContain("ON CONFLICT(deployment) DO UPDATE");
  });

  it("limits recovery to the exact active snapshot and its persisted bounded paths",async()=>{
    const source=await readFile(new URL("../src/admin-content-publication.ts",import.meta.url),"utf8");
    const recovery=source.slice(source.indexOf("async rebuild("),source.indexOf("async markPropagation("));
    expect(recovery).toContain("active.snapshot_id!==command.sourceSnapshotId");
    expect(recovery).toContain("active.snapshot_id!==command.snapshotId");
    expect(recovery).toContain("active.propagation_state!==\"propagated\"");
    expect(recovery).toContain("paths.length>100");
    expect(recovery).not.toContain("command.paths");
  });
});
