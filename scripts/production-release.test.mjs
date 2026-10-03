import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseScript = readFileSync(new URL("./production-release.sh", import.meta.url), "utf8");
const productionCompose = readFileSync(new URL("../compose.production.yml", import.meta.url), "utf8");

describe("production release Admin lifecycle", () => {
  it("validates the browser-facing public origin independently of Admin's internal Web origin", () => {
    expect(releaseScript).toMatch(/validate_public_web_origin\(\)/);
    expect(releaseScript).toMatch(/release_value TIKDD_WEB_PUBLIC_ORIGIN/);
    expect(releaseScript).toMatch(/TIKDD_WEB_PUBLIC_ORIGIN must be an HTTPS origin/);
    expect(releaseScript).toMatch(/TIKDD_WEB_PUBLIC_ORIGIN must be a public exact origin/);
    expect(releaseScript).toMatch(/validate_public_web_origin\n  compose --profile admin/);
  });

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

  it("force-recreates Cobalt and proves Worker-key POST authentication before recreating Worker", () => {
    expect(releaseScript).toMatch(/verify_cobalt_auth_readiness\(\)/);
    expect(releaseScript).toMatch(/start_cobalt_authenticated\(\)/);
    expect(releaseScript).toMatch(/compose --profile cobalt up -d --force-recreate --wait cobalt-api/);
    expect(releaseScript).toMatch(/--profile cobalt --profile cobalt-ops run --rm --no-deps cobalt-auth-readiness/);
    expect(releaseScript).toMatch(/Cobalt authentication readiness failed; stopping the private runtime before Worker recreation/);
    const applyBlock = releaseScript.split("  worker-config-apply)", 2)[1]?.split("  cobalt-runtime-probe)", 2)[0] ?? "";
    expect(applyBlock.indexOf("start_cobalt_authenticated")).toBeGreaterThanOrEqual(0);
    expect(applyBlock.indexOf("compose up -d --force-recreate --wait worker")).toBeGreaterThan(applyBlock.indexOf("start_cobalt_authenticated"));
  });

  it("supports a closed-gate private Cobalt runtime probe without recreating the Worker", () => {
    expect(releaseScript).toMatch(/verify_cobalt_runtime\(\)/);
    expect(releaseScript).toMatch(/cobalt-runtime-probe\)/);
    expect(releaseScript).toMatch(/cobalt-runtime-probe requires ENABLE_COBALT_PROVIDER=false/);
    expect(releaseScript).toMatch(/compose --profile cobalt pull cobalt-api/);
    expect(releaseScript).toMatch(/compose --profile cobalt up -d --force-recreate --wait cobalt-api/);
    expect(releaseScript).toMatch(/compose --profile cobalt exec -T cobalt-api node -e/);
    expect(releaseScript).toMatch(/info\?\.cobalt\?\.services/);
    expect(releaseScript).toMatch(/https:\/\/example\.invalid\//);
    expect(releaseScript).toMatch(/error\.api\.link\.unsupported/);
    expect(releaseScript).toMatch(/service=private auth=verified ok=available gates=closed/);
    expect(releaseScript).toMatch(/cobalt-runtime-stop\)/);
    const probeBlock = releaseScript.split("  cobalt-runtime-probe)", 2)[1]?.split("  cobalt-runtime-stop)", 2)[0] ?? "";
    expect(probeBlock).not.toMatch(/force-recreate.*worker/);
  });

  it("runs a bounded Cobalt multimode qualification and deletes its temporary input", () => {
    expect(releaseScript).toMatch(/verify_cobalt_qualification_input\(\)/);
    expect(releaseScript).toMatch(/cobalt-multimode-qualification\)/);
    expect(releaseScript).toMatch(/Remove the stale Cobalt qualification tunnel output before continuing/);
    expect(releaseScript).toMatch(/input must have mode 600/);
    expect(releaseScript).toMatch(/input must be owned by service UID 1000/);
    expect(releaseScript).toMatch(/stat -c '%u' "\$qualification_input"/);
    expect(releaseScript).toMatch(/compose --profile cobalt --profile cobalt-ops run --rm cobalt-qualification/);
    expect(releaseScript).toMatch(/install -o 1000 -g 1000 -m 600 \/dev\/null "\$qualification_output"/);
    expect(releaseScript).toMatch(/trap 'rm -f "\$qualification_input" "\$qualification_output"'/);
    expect(releaseScript).toMatch(/cobalt_tunnel_artifact=READY/);
    const qualificationBlock = productionCompose.split("  cobalt-qualification:", 2)[1]?.split("  canary:", 2)[0] ?? "";
    expect(qualificationBlock).toMatch(/cobalt:qualify/);
    expect(qualificationBlock).toMatch(/profiles: \["cobalt-ops"\]/);
    expect(qualificationBlock).not.toMatch(/profiles: \["ops"\]/);
    expect(qualificationBlock).toMatch(/read_only: true/);
    expect(qualificationBlock).toMatch(/cobalt_api_keys/);
    expect(qualificationBlock).toMatch(/provider-egress/);
    expect(qualificationBlock).toMatch(/COBALT_APPROVED_PLATFORMS/);
    expect(qualificationBlock).toMatch(/COBALT_DELIVERY_VERIFIED_CAPABILITIES/);
    expect(qualificationBlock).toMatch(/cobalt-qualification-tunnel-output\.json/);
  });

  it("audits signed Cobalt tunnel descriptors with closed gates and deletes the sensitive input", () => {
    expect(releaseScript).toMatch(/verify_cobalt_tunnel_audit_input\(\)/);
    expect(releaseScript).toMatch(/cobalt-tunnel-audit\)/);
    expect(releaseScript).toMatch(/cobalt-tunnel-audit requires ENABLE_COBALT_PROVIDER=false/);
    expect(releaseScript).toMatch(/Cobalt tunnel audit input must have mode 600/);
    expect(releaseScript).toMatch(/Cobalt tunnel audit input must be owned by service UID 1000/);
    expect(releaseScript).toMatch(/compose --profile cobalt --profile cobalt-ops run --rm cobalt-tunnel-audit/);
    expect(releaseScript).toMatch(/trap 'rm -f "\$tunnel_audit_input"'/);
    const auditBlock = productionCompose.split("  cobalt-tunnel-audit:", 2)[1]?.split("  canary:", 2)[0] ?? "";
    expect(auditBlock).toMatch(/cobalt:tunnel-audit/);
    expect(auditBlock).toMatch(/profiles: \["cobalt-ops"\]/);
    expect(auditBlock).toMatch(/read_only: true/);
    expect(auditBlock).not.toMatch(/cobalt_api_keys/);
    expect(auditBlock).toMatch(/provider-egress/);
  });

  it("keeps the Cobalt key readable only through the dedicated secrets group", () => {
    const cobaltBlock = productionCompose.split("  cobalt-api:", 2)[1]?.split("  calibration-api-preflight:", 2)[0] ?? "";
    expect(cobaltBlock).toMatch(/group_add:\s+- \$\{TIKDD_SECRETS_GID:-1999\}/);
    expect(cobaltBlock).toMatch(/secrets:\s+- cobalt_api_keys/);
    expect(cobaltBlock).toMatch(/127\.0\.0\.1:\$\{TIKDD_COBALT_HOST_PORT:-3900\}:9000/);
    expect(cobaltBlock).toMatch(/API_URL: \$\{TIKDD_COBALT_PUBLIC_ORIGIN:-https:\/\/media\.tikdd\.cc\/\}/);
    expect(cobaltBlock).toMatch(/TUNNEL_LIFESPAN: \$\{COBALT_TUNNEL_LIFESPAN:-300\}/);
    expect(cobaltBlock).toMatch(/CORS_WILDCARD: "0"/);
  });

  it("runs Cobalt authentication readiness as a private read-only one-shot service", () => {
    const readinessBlock = productionCompose.split("  cobalt-auth-readiness:", 2)[1]?.split("  cobalt-tunnel-audit:", 2)[0] ?? "";
    expect(readinessBlock).toMatch(/cobalt:auth-readiness/);
    expect(readinessBlock).toMatch(/profiles: \["cobalt-ops"\]/);
    expect(readinessBlock).toMatch(/COBALT_API_URL: http:\/\/cobalt-api:9000\//);
    expect(readinessBlock).toMatch(/COBALT_API_KEY: \$\{COBALT_API_KEY:-\}/);
    expect(readinessBlock).toMatch(/cobalt_api_keys/);
    expect(readinessBlock).toMatch(/provider-egress/);
    expect(readinessBlock).toMatch(/read_only: true/);
    expect(readinessBlock).not.toMatch(/ports:/);
  });

  it("exposes only the exact Cobalt tunnel route at the media origin", () => {
    const nginx = readFileSync(new URL("../deploy/nginx/tikdd.conf.template", import.meta.url), "utf8");
    const mediaBlock = nginx.split("server_name __TIKDD_MEDIA_HOST__;", 2)[1]?.split("\nserver {", 2)[0] ?? "";
    expect(mediaBlock).toMatch(/location = \/tunnel/);
    expect(mediaBlock).toMatch(/limit_except GET \{ deny all; \}/);
    expect(mediaBlock).toMatch(/127\.0\.0\.1:__TIKDD_COBALT_HOST_PORT__\/tunnel\$is_args\$args/);
    expect(mediaBlock).toMatch(/location \/ \{ return 404; \}/);
    expect(mediaBlock).toMatch(/__TIKDD_NGINX_LOG_DIR__\/tikdd-media\.access\.log/);
    expect(nginx).not.toMatch(/access_log \/var\/log\/nginx\/tikdd-/);
    expect(mediaBlock).not.toMatch(/\/v1|\/health|cobalt-api/);
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
    expect(releaseScript).toMatch(/SOCIALDOWNLOADER_APPROVED_PLATFORMS/);
    expect(releaseScript).toMatch(/SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS/);
    expect(releaseScript).toMatch(/Worker SocialDownloader platform binding mismatch/);
    expect(releaseScript).toMatch(/ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER/);
    expect(releaseScript).toMatch(/PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED/);
    expect(releaseScript).toMatch(/PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"Pinterest Video Downloader"/);
    expect(releaseScript).toMatch(/pinterest_enabled=/);
    expect(releaseScript).toMatch(/ENABLE_VIDDOWN_PROVIDER/);
    expect(releaseScript).toMatch(/VIDDOWN_TERMS_APPROVED/);
    expect(releaseScript).toMatch(/VIDDOWN_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"VidDown"/);
    expect(releaseScript).toMatch(/viddown_enabled=/);
    expect(releaseScript).toMatch(/ENABLE_LOCOLOADER_PROVIDER/);
    expect(releaseScript).toMatch(/LOCOLOADER_TERMS_APPROVED/);
    expect(releaseScript).toMatch(/LOCOLOADER_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"LocoLoader"/);
    expect(releaseScript).toMatch(/locoloader_enabled=/);
    expect(releaseScript).toMatch(/LOCOLOADER_APPROVED_PLATFORMS/);
    expect(releaseScript).toMatch(/LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS/);
    expect(releaseScript).toMatch(/ENABLE_9XBUDDY_PROVIDER/);
    expect(releaseScript).toMatch(/NINE_X_BUDDY_AUTOMATION_USE_APPROVED/);
    expect(releaseScript).toMatch(/NINE_X_BUDDY_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/NINE_X_BUDDY_APPROVED_PLATFORMS/);
    expect(releaseScript).toMatch(/NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS/);
    expect(releaseScript).toMatch(/ENABLE_GETXHAMSTER_PROVIDER/);
    expect(releaseScript).toMatch(/GETXHAMSTER_AUTOMATION_USE_APPROVED/);
    expect(releaseScript).toMatch(/GETXHAMSTER_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/GETXHAMSTER_APPROVED_PLATFORMS/);
    expect(releaseScript).toMatch(/GETXHAMSTER_DELIVERY_VERIFIED_PLATFORMS/);
    expect(releaseScript).toMatch(/ENABLE_SNAPYT_PROVIDER/);
    expect(releaseScript).toMatch(/SNAPYT_TERMS_APPROVED/);
    expect(releaseScript).toMatch(/SNAPYT_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"SnapYT"/);
    expect(releaseScript).toMatch(/snapyt_enabled=/);
    expect(releaseScript).toMatch(/ENABLE_NOADSDL_PROVIDER/);
    expect(releaseScript).toMatch(/NOADSDL_TERMS_APPROVED/);
    expect(releaseScript).toMatch(/NOADSDL_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"NoAdsDL"/);
    expect(releaseScript).toMatch(/noadsdl_enabled=/);
    expect(releaseScript).toMatch(/ENABLE_COBALT_PROVIDER/);
    expect(releaseScript).toMatch(/COBALT_LICENSE_ACKNOWLEDGED/);
    expect(releaseScript).toMatch(/COBALT_DELIVERY_AUDIT_APPROVED/);
    expect(releaseScript).toMatch(/"Cobalt"/);
    expect(releaseScript).toMatch(/cobalt_enabled=/);
    expect(releaseScript).toMatch(/COBALT_APPROVED_PLATFORMS/);
    expect(releaseScript).toMatch(/COBALT_DELIVERY_VERIFIED_PLATFORMS/);
    expect(releaseScript).toMatch(/COBALT_DELIVERY_VERIFIED_CAPABILITIES/);
    expect(releaseScript).toMatch(/Worker LocoLoader platform binding mismatch/);
  });

  it("passes the configured host resource thresholds to every stage gate", () => {
    expect(releaseScript).toMatch(/baseline_swap_used_kb="\$\(release_value TIKDD_BASELINE_SWAP_USED_KB/);
    expect(releaseScript).toMatch(/max_swap_growth_kb="\$\(release_value TIKDD_MAX_SWAP_GROWTH_KB/);
    expect(releaseScript).toMatch(/min_available_memory_kb="\$\(release_value TIKDD_MIN_AVAILABLE_MEMORY_KB/);
    expect(releaseScript).toMatch(/export TIKDD_BASELINE_SWAP_USED_KB="\$baseline_swap_used_kb"/);
    expect(releaseScript).toMatch(/export TIKDD_MAX_SWAP_GROWTH_KB="\$max_swap_growth_kb"/);
    expect(releaseScript).toMatch(/export TIKDD_MIN_AVAILABLE_MEMORY_KB="\$min_available_memory_kb"/);
  });

  it("binds the yt-dlp artifact store read-write only to Runner and read-only to Delivery", () => {
    const runnerBlock = productionCompose.split("  ytdlp-runner:", 2)[1]?.split("  cobalt-api:", 2)[0] ?? "";
    const deliveryBlock = productionCompose.split("  delivery:", 2)[1]?.split("  admin-api:", 2)[0] ?? "";
    expect(runnerBlock).toMatch(/TIKDD_YTDLP_ARTIFACT_DIR:-\/var\/lib\/tikdd\/ytdlp-artifacts/);
    expect(runnerBlock).toMatch(/target: \/var\/lib\/tikdd-ytdlp-artifacts/);
    expect(runnerBlock).not.toMatch(/read_only: true\s*$/m);
    expect(deliveryBlock).toMatch(/TIKDD_YTDLP_ARTIFACT_DIR:-\/var\/lib\/tikdd\/ytdlp-artifacts/);
    expect(deliveryBlock).toMatch(/target: \/var\/lib\/tikdd-ytdlp-artifacts[\s\S]*read_only: true/);
    expect(releaseScript).toMatch(/install -d -o 1000 -g 1000 -m 0700 "\$artifact_dir"/);
    expect(releaseScript).toMatch(/must stay below \/var\/lib\/tikdd/);
    expect(releaseScript).toMatch(/cannot be a symbolic link/);
  });
});
