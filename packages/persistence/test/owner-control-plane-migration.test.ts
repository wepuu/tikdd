import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("owner control-plane migration", () => {
  it("creates revision heads, published snapshots, safe command receipts, and seeded locales", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0011_owner_control_plane.sql", import.meta.url),
      "utf8"
    );

    for (const table of [
      "admin_route_policy_revisions",
      "admin_route_policy_heads",
      "admin_platform_presentation_revisions",
      "admin_platform_presentation_heads",
      "admin_locale_revisions",
      "admin_locale_heads",
      "admin_page_revisions",
      "admin_page_heads",
      "admin_published_snapshots",
      "admin_published_snapshot_heads",
      "admin_command_receipts"
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migration).toContain("('en', 1, 'English'");
    expect(migration).toContain("('zh-CN', 1, '简体中文'");
    expect(migration).toContain("idempotency_digest BYTEA NOT NULL UNIQUE");
    expect(migration).toContain("CHECK (octet_length(idempotency_digest) = 32)");
    expect(migration).toContain("CHECK ((page_type = 'platform') = (platform IS NOT NULL))");
    expect(migration).not.toMatch(/source_url|canonical_url|target_url|download_url|task_id|candidate_id|format_id|ticket_id|cookie|headers|provider_payload|raw_payload/);
  });

  it("adds bounded route allocations and a monotonic runtime projection head",async()=>{
    const migration=await readFile(new URL("../../../infra/migrations/0012_route_policy_controls.sql",import.meta.url),"utf8");
    expect(migration).toContain("staged_allocations JSONB NOT NULL");
    expect(migration).toContain("jsonb_array_length(staged_allocations) <= 16");
    expect(migration).toContain("CREATE SEQUENCE IF NOT EXISTS admin_route_policy_projection_revision_seq");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS admin_route_policy_projection_heads");
    expect(migration).toContain("projected_revision = durable_revision");
    expect(migration).not.toMatch(/source_url|canonical_url|target_url|download_url|task_id|candidate_id|format_id|ticket_id|cookie|headers|provider_payload|raw_payload/);
  });

  it("adds versioned platform presentation fields without making host rules mutable",async()=>{
    const migration=await readFile(new URL("../../../infra/migrations/0013_platform_presentation_controls.sql",import.meta.url),"utf8");
    expect(migration).toContain("public_display_name TEXT");
    expect(migration).toContain("support_label TEXT");
    expect(migration).toContain("revision_kind TEXT NOT NULL");
    expect(migration).toContain("admin_platform_previous_revision");
    expect(migration).not.toMatch(/recognized_hosts|extractor_keys|allow_subdomains|delivery_allowlist/);
  });

  it("adds versioned shared locale blocks without introducing arbitrary markup",async()=>{
    const migration=await readFile(new URL("../../../infra/migrations/0014_structured_content_model.sql",import.meta.url),"utf8");
    expect(migration).toContain("admin_shared_content_revisions");
    expect(migration).toContain("admin_shared_content_heads");
    expect(migration).toContain("jsonb_typeof(content) = 'object'");
    expect(migration).not.toMatch(/html|script|remote_url|source_url|task_id|candidate_id|cookie|headers/);
  });

  it("adds a bounded two-phase content publication pipeline",async()=>{
    const migration=await readFile(new URL("../../../infra/migrations/0015_content_publication_pipeline.sql",import.meta.url),"utf8");
    expect(migration).toContain("affected_paths JSONB");
    expect(migration).toContain("revalidation_attempts INTEGER");
    expect(migration).toContain("admin_published_snapshots_propagation_idx");
    expect(migration).toContain("jsonb_array_length(affected_paths) <= 10000");
    expect(migration).not.toMatch(/download_url|source_url|cookie|headers|provider_payload|raw_payload/);
  });
});
