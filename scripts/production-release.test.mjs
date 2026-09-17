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

  it("supports an explicit always-on Admin origin without weakening the stopped default", () => {
    expect(releaseScript).toMatch(/admin_origin_mode="\$\(release_value TIKDD_ADMIN_ORIGIN_MODE "stopped"\)"/);
    expect(releaseScript).toMatch(/TIKDD_ADMIN_ORIGIN_MODE must be stopped or always-on/);
    expect(releaseScript).toMatch(/if \[ "\$admin_origin_mode" = "always-on" \]; then\s+expected_admin_status=200/);
    expect(releaseScript).toMatch(/elif \[ "\$stage" = "admin-stopped" \]; then\s+expected_admin_status=404/);
  });

  it("recreates only the Worker and verifies the selected runtime configuration", () => {
    expect(releaseScript).toMatch(/worker-config-apply\)/);
    expect(releaseScript).toMatch(/compose up -d --force-recreate --wait worker/);
    expect(releaseScript).toMatch(/verify_worker_runtime_config/);
    expect(releaseScript).toMatch(/read_release_value TIKDD_CONFIGURATION_REVISION/);
    expect(releaseScript).toMatch(/Worker configuration revision mismatch/);
  });

  it("requires every Provider gate triplet to match its Provider switch in the Worker", () => {
    expect(releaseScript).toMatch(/ENABLE_FDOWN_ISURU_PROVIDER[\s\S]*FDOWN_ISURU_TERMS_APPROVED[\s\S]*FDOWN_ISURU_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/\$provider_label gates must all match \$enabled_key/);
    expect(releaseScript).toMatch(/Worker \$provider_label gate mismatch/);
    expect(releaseScript).toMatch(/ENABLE_SOCIALDOWNLOADER_PROVIDER/);
    expect(releaseScript).toMatch(/SOCIALDOWNLOADER_TERMS_APPROVED/);
    expect(releaseScript).toMatch(/SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"SocialDownloader"/);
    expect(releaseScript).toMatch(/socialdownloader_enabled=/);
  });
});
