import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseScript = readFileSync(new URL("./production-release.sh", import.meta.url), "utf8");

describe("production release Admin lifecycle", () => {
  it("binds Compose env_file to the selected release environment", () => {
    expect(releaseScript).toMatch(/TIKDD_PRODUCTION_ENV_FILE="\$release_env"[\s\\]+docker compose --env-file "\$release_env"/);
  });

  it("validates the expected write mode and fails closed on a mismatch", () => {
    expect(releaseScript).toMatch(/readonly\|content-draft\|full/);
    expect(releaseScript).toMatch(/Admin write mode mismatch/);
    expect(releaseScript).toMatch(/verify_admin_write_mode "\$expected_admin_write_mode"/);
    expect(releaseScript).toMatch(/status="\$\?"\n      stop_admin_after_failure\n      exit "\$status"/);
  });

  it("keeps account maintenance release-env-bound and separate from deploy", () => {
    expect(releaseScript).toMatch(/admin-account\)/);
    expect(releaseScript).toMatch(/compose --profile admin-ops run --rm admin-account "\$@"/);
    expect(releaseScript).not.toMatch(/stage_service admin/);
  });
});
