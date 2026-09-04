import { readFile } from "node:fs/promises";
import { describe,expect,it } from "vitest";

describe("qualification Admin migration",()=>{
  it("extends authoritative receipts without adding a traffic-grant table",async()=>{const source=await readFile(new URL("../../../infra/migrations/0022_qualification_admin.sql",import.meta.url),"utf8");
    expect(source).toContain("'qualification'");expect(source).toContain("admin_command_receipts_aggregate_kind_check");expect(source).not.toContain("provider_rollout_rules");
  });
});
