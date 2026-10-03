#!/bin/sh
set -eu

action="${1:-}"
release_env="${TIKDD_RELEASE_ENV:-deploy/production.env}"
compose_file="${TIKDD_PRODUCTION_COMPOSE:-compose.production.yml}"
lock_file="${TIKDD_DEPLOYMENT_LOCK:-/run/lock/tikdd-deploy.lock}"

if [ ! -r "$release_env" ]; then
  echo "Production environment file is missing or unreadable: $release_env" >&2
  exit 78
fi

compose() {
  TIKDD_PRODUCTION_ENV_FILE="$release_env" \
    docker compose --env-file "$release_env" -f "$compose_file" "$@"
}

read_release_value() {
  key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      sub(/\r$/, "", value)
    }
    END { print value }
  ' "$release_env"
}

release_value() {
  name="$1"
  fallback="$2"
  current="$(printenv "$name" 2>/dev/null || true)"
  if [ -n "$current" ]; then
    printf '%s\n' "$current"
    return
  fi
  configured="$(read_release_value "$name")"
  if [ -n "$configured" ]; then
    printf '%s\n' "$configured"
  else
    printf '%s\n' "$fallback"
  fi
}

verify_admin_write_mode() {
  expected="$1"
  [ -n "$expected" ] || return 0
  case "$expected" in
    readonly|content-draft|full) ;;
    *)
      echo "TIKDD_ADMIN_EXPECTED_WRITE_MODE must be readonly, content-draft, or full." >&2
      return 78
      ;;
  esac

  container_id="$(compose --profile admin ps -q admin-api 2>/dev/null | awk 'NF { value=$1 } END { print value }')"
  [ -n "$container_id" ] || {
    echo "Admin API container is not running; cannot verify write mode." >&2
    return 78
  }
  if ! env_dump="$(docker inspect "$container_id" --format '{{range .Config.Env}}{{println .}}{{end}}')"; then
    echo "Admin API container environment could not be inspected; refusing to expose Admin." >&2
    return 78
  fi
  actual="$(printf '%s\n' "$env_dump" | awk -F= '$1=="ADMIN_WRITE_MODE" { sub(/^[^=]*=/, ""); print; exit }')"
  [ -n "$actual" ] || actual="readonly"
  if [ "$actual" != "$expected" ]; then
    echo "Admin write mode mismatch: expected $expected, actual $actual." >&2
    return 78
  fi
  echo "admin_write_mode=PASS mode=$actual"
}

verify_worker_runtime_config() {
  expected_revision="$(read_release_value TIKDD_CONFIGURATION_REVISION)"
  [ -n "$expected_revision" ] || {
    echo "TIKDD_CONFIGURATION_REVISION is required for Worker configuration verification." >&2
    return 78
  }

  container_id="$(compose ps -q worker 2>/dev/null | awk 'NF { value=$1 } END { print value }')"
  [ -n "$container_id" ] || {
    echo "Worker container is not running; cannot verify runtime configuration." >&2
    return 78
  }
  if ! env_dump="$(docker inspect "$container_id" --format '{{range .Config.Env}}{{println .}}{{end}}')"; then
    echo "Worker environment could not be inspected; refusing to apply Provider configuration." >&2
    return 78
  fi

  actual_revision="$(printf '%s\n' "$env_dump" | awk -F= '$1=="TIKDD_CONFIGURATION_REVISION" { sub(/^[^=]*=/, ""); print; exit }')"
  if [ "$actual_revision" != "$expected_revision" ]; then
    echo "Worker configuration revision mismatch; expected $expected_revision, actual ${actual_revision:-missing}." >&2
    return 78
  fi

  verify_provider_gate_triplet() {
    provider_label="$1"
    enabled_key="$2"
    terms_key="$3"
    audit_key="$4"
    expected_enabled="$(release_value "$enabled_key" "false")"
    expected_terms="$(release_value "$terms_key" "false")"
    expected_audit="$(release_value "$audit_key" "false")"
    case "$expected_enabled" in
      true) expected_gate=true ;;
      false) expected_gate=false ;;
      *) echo "$enabled_key must be true or false." >&2; return 78 ;;
    esac
    [ "$expected_terms" = "$expected_gate" ] && [ "$expected_audit" = "$expected_gate" ] || {
      echo "$provider_label gates must all match $enabled_key." >&2
      return 78
    }

    for key in "$enabled_key" "$terms_key" "$audit_key"; do
      actual="$(printf '%s\n' "$env_dump" | awk -F= -v key="$key" '$1==key { sub(/^[^=]*=/, ""); print; exit }')"
      if [ "$actual" != "$expected_gate" ]; then
        echo "Worker $provider_label gate mismatch for $key; expected $expected_gate, actual ${actual:-missing}." >&2
        return 78
      fi
    done
    printf '%s' "$expected_gate"
  }

  fdown_enabled="$(verify_provider_gate_triplet \
    "FDown Isuru" \
    ENABLE_FDOWN_ISURU_PROVIDER \
    FDOWN_ISURU_TERMS_APPROVED \
    FDOWN_ISURU_DELIVERY_AUDIT_APPROVED)"
  socialdownloader_enabled="$(verify_provider_gate_triplet \
    "SocialDownloader" \
    ENABLE_SOCIALDOWNLOADER_PROVIDER \
    SOCIALDOWNLOADER_TERMS_APPROVED \
    SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED)"
  pinterest_enabled="$(verify_provider_gate_triplet \
    "Pinterest Video Downloader" \
    ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER \
    PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED \
    PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED)"
  viddown_enabled="$(verify_provider_gate_triplet \
    "VidDown" \
    ENABLE_VIDDOWN_PROVIDER \
    VIDDOWN_TERMS_APPROVED \
    VIDDOWN_DELIVERY_AUDIT_APPROVED)"
  locoloader_enabled="$(verify_provider_gate_triplet \
    "LocoLoader" \
    ENABLE_LOCOLOADER_PROVIDER \
    LOCOLOADER_TERMS_APPROVED \
    LOCOLOADER_DELIVERY_AUDIT_APPROVED)"
  nine_x_buddy_enabled="$(verify_provider_gate_triplet \
    "9xBuddy" \
    ENABLE_9XBUDDY_PROVIDER \
    NINE_X_BUDDY_AUTOMATION_USE_APPROVED \
    NINE_X_BUDDY_DELIVERY_AUDIT_APPROVED)"
  getxhamster_enabled="$(verify_provider_gate_triplet \
    "GetXHamster" \
    ENABLE_GETXHAMSTER_PROVIDER \
    GETXHAMSTER_AUTOMATION_USE_APPROVED \
    GETXHAMSTER_DELIVERY_AUDIT_APPROVED)"
  snapyt_enabled="$(verify_provider_gate_triplet \
    "SnapYT" \
    ENABLE_SNAPYT_PROVIDER \
    SNAPYT_TERMS_APPROVED \
    SNAPYT_DELIVERY_AUDIT_APPROVED)"
  noadsdl_enabled="$(verify_provider_gate_triplet \
    "NoAdsDL" \
    ENABLE_NOADSDL_PROVIDER \
    NOADSDL_TERMS_APPROVED \
    NOADSDL_DELIVERY_AUDIT_APPROVED)"
  cobalt_enabled="$(verify_provider_gate_triplet \
    "Cobalt" \
    ENABLE_COBALT_PROVIDER \
    COBALT_LICENSE_ACKNOWLEDGED \
    COBALT_DELIVERY_AUDIT_APPROVED)"
  expected_socialdownloader_platforms="$(release_value SOCIALDOWNLOADER_APPROVED_PLATFORMS "facebook")"
  expected_socialdownloader_verified="$(release_value SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS "facebook")"
  for platform_key in SOCIALDOWNLOADER_APPROVED_PLATFORMS SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS; do
    expected_platforms="$expected_socialdownloader_platforms"
    [ "$platform_key" = SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS ] && expected_platforms="$expected_socialdownloader_verified"
    actual_platforms="$(printf '%s\n' "$env_dump" | awk -F= -v key="$platform_key" '$1==key { sub(/^[^=]*=/, ""); print; exit }')"
    [ -n "$actual_platforms" ] || actual_platforms="facebook"
    if [ "$actual_platforms" != "$expected_platforms" ]; then
      echo "Worker SocialDownloader platform binding mismatch for $platform_key." >&2
      return 78
    fi
  done
  expected_locoloader_platforms="$(release_value LOCOLOADER_APPROVED_PLATFORMS "xhamster")"
  expected_locoloader_verified="$(release_value LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS "xhamster")"
  for platform_key in LOCOLOADER_APPROVED_PLATFORMS LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS; do
    expected_platforms="$expected_locoloader_platforms"
    [ "$platform_key" = LOCOLOADER_DELIVERY_VERIFIED_PLATFORMS ] && expected_platforms="$expected_locoloader_verified"
    actual_platforms="$(printf '%s\n' "$env_dump" | awk -F= -v key="$platform_key" '$1==key { sub(/^[^=]*=/, ""); print; exit }')"
    [ -n "$actual_platforms" ] || actual_platforms="xhamster"
    if [ "$actual_platforms" != "$expected_platforms" ]; then
      echo "Worker LocoLoader platform binding mismatch for $platform_key." >&2
      return 78
    fi
  done
  expected_nine_x_buddy_platforms="$(release_value NINE_X_BUDDY_APPROVED_PLATFORMS "xhamster")"
  expected_nine_x_buddy_verified="$(release_value NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS "xhamster")"
  for platform_key in NINE_X_BUDDY_APPROVED_PLATFORMS NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS; do
    expected_platforms="$expected_nine_x_buddy_platforms"
    [ "$platform_key" = NINE_X_BUDDY_DELIVERY_VERIFIED_PLATFORMS ] && expected_platforms="$expected_nine_x_buddy_verified"
    actual_platforms="$(printf '%s\n' "$env_dump" | awk -F= -v key="$platform_key" '$1==key { sub(/^[^=]*=/, ""); print; exit }')"
    [ -n "$actual_platforms" ] || actual_platforms="xhamster"
    if [ "$actual_platforms" != "$expected_platforms" ]; then
      echo "Worker 9xBuddy platform binding mismatch for $platform_key." >&2
      return 78
    fi
  done
  expected_getxhamster_platforms="$(release_value GETXHAMSTER_APPROVED_PLATFORMS "xhamster")"
  expected_getxhamster_verified="$(release_value GETXHAMSTER_DELIVERY_VERIFIED_PLATFORMS "xhamster")"
  for platform_key in GETXHAMSTER_APPROVED_PLATFORMS GETXHAMSTER_DELIVERY_VERIFIED_PLATFORMS; do
    expected_platforms="$expected_getxhamster_platforms"
    [ "$platform_key" = GETXHAMSTER_DELIVERY_VERIFIED_PLATFORMS ] && expected_platforms="$expected_getxhamster_verified"
    actual_platforms="$(printf '%s\n' "$env_dump" | awk -F= -v key="$platform_key" '$1==key { sub(/^[^=]*=/, ""); print; exit }')"
    [ -n "$actual_platforms" ] || actual_platforms="xhamster"
    if [ "$actual_platforms" != "$expected_platforms" ]; then
      echo "Worker GetXHamster platform binding mismatch for $platform_key." >&2
      return 78
    fi
  done
  expected_cobalt_platforms="$(release_value COBALT_APPROVED_PLATFORMS "odnoklassniki,x,instagram,tiktok,facebook,pinterest,vimeo")"
  expected_cobalt_verified="$(release_value COBALT_DELIVERY_VERIFIED_PLATFORMS "")"
  expected_cobalt_capabilities="$(release_value COBALT_DELIVERY_VERIFIED_CAPABILITIES "")"
  for platform_key in COBALT_APPROVED_PLATFORMS COBALT_DELIVERY_VERIFIED_PLATFORMS COBALT_DELIVERY_VERIFIED_CAPABILITIES; do
    expected_platforms="$expected_cobalt_platforms"
    [ "$platform_key" = COBALT_DELIVERY_VERIFIED_PLATFORMS ] && expected_platforms="$expected_cobalt_verified"
    [ "$platform_key" = COBALT_DELIVERY_VERIFIED_CAPABILITIES ] && expected_platforms="$expected_cobalt_capabilities"
    actual_platforms="$(printf '%s\n' "$env_dump" | awk -F= -v key="$platform_key" '$1==key { sub(/^[^=]*=/, ""); print; exit }')"
    if [ "$actual_platforms" != "$expected_platforms" ]; then
      echo "Worker Cobalt platform binding mismatch for $platform_key." >&2
      return 78
    fi
  done
  echo "worker_runtime_config=PASS revision=$expected_revision fdown_enabled=$fdown_enabled socialdownloader_enabled=$socialdownloader_enabled pinterest_enabled=$pinterest_enabled viddown_enabled=$viddown_enabled locoloader_enabled=$locoloader_enabled nine_x_buddy_enabled=$nine_x_buddy_enabled getxhamster_enabled=$getxhamster_enabled snapyt_enabled=$snapyt_enabled noadsdl_enabled=$noadsdl_enabled cobalt_enabled=$cobalt_enabled"
}

verify_cobalt_runtime() {
  [ "$(release_value ENABLE_COBALT_PROVIDER "false")" = "false" ] || {
    echo "cobalt-runtime-probe requires ENABLE_COBALT_PROVIDER=false." >&2
    return 78
  }
  [ "$(release_value COBALT_LICENSE_ACKNOWLEDGED "false")" = "false" ] || {
    echo "cobalt-runtime-probe requires COBALT_LICENSE_ACKNOWLEDGED=false." >&2
    return 78
  }
  [ "$(release_value COBALT_DELIVERY_AUDIT_APPROVED "false")" = "false" ] || {
    echo "cobalt-runtime-probe requires COBALT_DELIVERY_AUDIT_APPROVED=false." >&2
    return 78
  }

  container_id="$(compose --profile cobalt ps -q cobalt-api 2>/dev/null | awk 'NF { value=$1 } END { print value }')"
  [ -n "$container_id" ] || {
    echo "Cobalt container is not running; cannot verify private runtime." >&2
    return 78
  }
  running="$(docker inspect "$container_id" --format '{{.State.Running}}' 2>/dev/null || true)"
  [ "$running" = "true" ] || {
    echo "Cobalt container is not running; refusing to continue." >&2
    return 78
  }

  # GET proves private runtime discovery. POST with an invalid, non-routable URL
  # proves that the in-memory key registry accepted the mounted schema and key;
  # it must reach URL validation without contacting an upstream Provider.
  compose --profile cobalt exec -T cobalt-api node -e 'const fs=require("fs");const keys=Object.keys(JSON.parse(fs.readFileSync("/run/secrets/cobalt_api_keys","utf8")));if(keys.length!==1)process.exit(1);const key=keys[0];const headers={accept:"application/json","content-type":"application/json",authorization:"Api-Key "+key,"user-agent":"TikDD/cobalt-secondary"};Promise.all([fetch("http://127.0.0.1:9000/",{headers}),fetch("http://127.0.0.1:9000/",{method:"POST",headers,body:JSON.stringify({url:"https://example.invalid/"})})]).then(async([discovery,auth])=>{let info=null,error=null;try{info=await discovery.json()}catch{}try{error=await auth.json()}catch{}const services=Array.isArray(info?.cobalt?.services)?info.cobalt.services:[];const hasOk=services.some(s=>typeof s==="string"?s.toLowerCase()==="ok":String(s?.id??s?.name??"").toLowerCase()==="ok");const code=error?.error?.code;if(!discovery.ok||!hasOk||auth.status!==400||!["error.api.link.invalid","error.api.link.unsupported"].includes(code))process.exit(1)}).catch(()=>process.exit(1))'
  echo "cobalt_runtime=PASS service=private auth=verified ok=available gates=closed"
}

verify_cobalt_auth_readiness() {
  if ! compose --profile cobalt --profile cobalt-ops run --rm --no-deps cobalt-auth-readiness; then
    echo "Cobalt authentication readiness failed; stopping the private runtime before Worker recreation." >&2
    compose --profile cobalt stop cobalt-api >/dev/null 2>&1 || true
    return 78
  fi
}

start_cobalt_authenticated() {
  compose --profile cobalt up -d --force-recreate --wait cobalt-api
  verify_cobalt_auth_readiness
}

start_ytdlp_runner() {
  compose --profile ytdlp up -d --force-recreate --wait ytdlp-runner
  compose --profile ytdlp exec -T ytdlp-runner node -e \
    'fetch("http://127.0.0.1:9100/healthz").then(async r=>{const b=await r.json();if(!r.ok||b.service!=="ytdlp-runner"||typeof b.version!=="string")process.exit(1)}).catch(()=>process.exit(1))'
}

verify_cobalt_qualification_input() {
  qualification_input="$(release_value TIKDD_COBALT_QUALIFICATION_INPUT "/run/tikdd/cobalt-qualification-input.json")"
  [ "$qualification_input" = "/run/tikdd/cobalt-qualification-input.json" ] || {
    echo "Cobalt qualification input must use the reviewed runtime path." >&2
    return 78
  }
  [ -f "$qualification_input" ] && [ -r "$qualification_input" ] || {
    echo "Cobalt qualification input is missing or unreadable." >&2
    return 78
  }
  input_mode="$(stat -c '%a' "$qualification_input" 2>/dev/null || true)"
  [ "$input_mode" = "600" ] || {
    echo "Cobalt qualification input must have mode 600." >&2
    return 78
  }
  # The service image runs as the pinned non-root node identity (UID 1000).
  # A root-owned mode-600 bind mount passes the host check but remains unreadable
  # in the one-shot container, so verify both halves of the contract.
  input_uid="$(stat -c '%u' "$qualification_input" 2>/dev/null || true)"
  [ "$input_uid" = "1000" ] || {
    echo "Cobalt qualification input must be owned by service UID 1000." >&2
    return 78
  }
  qualification_output="/run/tikdd/cobalt-qualification-tunnel-output.json"
  [ ! -e "$qualification_output" ] || {
    echo "Remove the stale Cobalt qualification tunnel output before continuing." >&2
    return 78
  }
}

verify_cobalt_tunnel_audit_input() {
  [ "$(release_value ENABLE_COBALT_PROVIDER "false")" = "false" ] || {
    echo "cobalt-tunnel-audit requires ENABLE_COBALT_PROVIDER=false." >&2
    return 78
  }
  [ "$(release_value COBALT_LICENSE_ACKNOWLEDGED "false")" = "false" ] || {
    echo "cobalt-tunnel-audit requires COBALT_LICENSE_ACKNOWLEDGED=false." >&2
    return 78
  }
  [ "$(release_value COBALT_DELIVERY_AUDIT_APPROVED "false")" = "false" ] || {
    echo "cobalt-tunnel-audit requires COBALT_DELIVERY_AUDIT_APPROVED=false." >&2
    return 78
  }
  tunnel_audit_input="$(release_value TIKDD_COBALT_TUNNEL_AUDIT_INPUT "/run/tikdd/cobalt-tunnel-audit-input.json")"
  [ "$tunnel_audit_input" = "/run/tikdd/cobalt-tunnel-audit-input.json" ] || {
    echo "Cobalt tunnel audit input must use the reviewed runtime path." >&2
    return 78
  }
  [ -f "$tunnel_audit_input" ] && [ -r "$tunnel_audit_input" ] || {
    echo "Cobalt tunnel audit input is missing or unreadable." >&2
    return 78
  }
  audit_input_mode="$(stat -c '%a' "$tunnel_audit_input" 2>/dev/null || true)"
  [ "$audit_input_mode" = "600" ] || {
    echo "Cobalt tunnel audit input must have mode 600." >&2
    return 78
  }
  audit_input_uid="$(stat -c '%u' "$tunnel_audit_input" 2>/dev/null || true)"
  [ "$audit_input_uid" = "1000" ] || {
    echo "Cobalt tunnel audit input must be owned by service UID 1000." >&2
    return 78
  }
}

validate_public_web_origin() {
  public_origin="$(release_value TIKDD_WEB_PUBLIC_ORIGIN "")"
  case "$public_origin" in
    https://*) ;;
    *)
      echo "TIKDD_WEB_PUBLIC_ORIGIN must be an HTTPS origin." >&2
      return 78
      ;;
  esac
  public_host="${public_origin#https://}"
  case "$public_host" in
    ""|*/*|*\?*|*\#*|localhost|127.0.0.1|\[::1\]|web|web:*)
      echo "TIKDD_WEB_PUBLIC_ORIGIN must be a public exact origin." >&2
      return 78
      ;;
  esac
  echo "public_web_origin=PASS origin=$public_origin"
}

validate() {
  validate_public_web_origin
  compose --profile admin --profile ops --profile admin-ops --profile cobalt --profile cobalt-ops --profile ytdlp config --quiet
}

acquire_lock() {
  command -v flock >/dev/null 2>&1 || { echo "flock is required." >&2; exit 78; }
  exec 9>"$lock_file"
  flock -n 9 || { echo "Another TikDD deployment holds the host lock." >&2; exit 75; }
}

stage_gate_command="$(release_value TIKDD_STAGE_VERIFY_COMMAND "")"
postgres_data_dir="$(release_value TIKDD_POSTGRES_DATA_DIR "/var/lib/tikdd/postgres")"
backup_verify_command="$(release_value TIKDD_BACKUP_VERIFY_COMMAND "")"
initial_empty_confirmed="$(release_value TIKDD_INITIAL_EMPTY_DATABASE_CONFIRMED "false")"
provider_rollout_enabled="$(release_value PROVIDER_ROLLOUT_ENABLED "false")"
internal_preflight_required="$(release_value TIKDD_INTERNAL_PREFLIGHT_REQUIRED "false")"
preflight_signals="$(release_value TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON "")"
expected_admin_write_mode="$(release_value TIKDD_ADMIN_EXPECTED_WRITE_MODE "")"
admin_origin_mode="$(release_value TIKDD_ADMIN_ORIGIN_MODE "stopped")"
baseline_swap_used_kb="$(release_value TIKDD_BASELINE_SWAP_USED_KB "")"
max_swap_growth_kb="$(release_value TIKDD_MAX_SWAP_GROWTH_KB "")"
min_available_memory_kb="$(release_value TIKDD_MIN_AVAILABLE_MEMORY_KB "")"

[ -n "$baseline_swap_used_kb" ] && export TIKDD_BASELINE_SWAP_USED_KB="$baseline_swap_used_kb"
[ -n "$max_swap_growth_kb" ] && export TIKDD_MAX_SWAP_GROWTH_KB="$max_swap_growth_kb"
[ -n "$min_available_memory_kb" ] && export TIKDD_MIN_AVAILABLE_MEMORY_KB="$min_available_memory_kb"

case "$admin_origin_mode" in
  stopped|always-on) ;;
  *)
    echo "TIKDD_ADMIN_ORIGIN_MODE must be stopped or always-on." >&2
    exit 78
    ;;
esac

run_stage_gate() {
  stage="$1"
  [ -n "$stage_gate_command" ] || {
    echo "TIKDD_STAGE_VERIFY_COMMAND is required for staged shared-host deployment." >&2
    exit 78
  }
  expected_admin_status=404
  if [ "$admin_origin_mode" = "always-on" ]; then
    expected_admin_status=200
  fi
  if [ "$stage" = "admin-on-demand" ]; then
    expected_admin_status=200
  elif [ "$stage" = "admin-stopped" ]; then
    expected_admin_status=404
  fi
  TIKDD_STAGE="$stage" \
    TIKDD_STAGE_EXPECTED_ADMIN_STATUS="$expected_admin_status" \
    sh -c "$stage_gate_command"
}

stop_admin_after_failure() {
  compose --profile admin stop admin admin-api >/dev/null 2>&1 || true
}

verify_migration_safety() {
  if [ -n "$backup_verify_command" ]; then
    sh -c "$backup_verify_command"
    return
  fi
  [ "$initial_empty_confirmed" = "true" ] || {
    echo "A backup verification hook or explicit fresh-empty database confirmation is required." >&2
    exit 78
  }
  case "$postgres_data_dir" in
    /*) ;;
    *) echo "TIKDD_POSTGRES_DATA_DIR must be an absolute path." >&2; exit 78 ;;
  esac
  [ "$postgres_data_dir" != "/" ] || {
    echo "TIKDD_POSTGRES_DATA_DIR cannot be the filesystem root." >&2
    exit 78
  }
  if [ -d "$postgres_data_dir" ]; then
    [ -r "$postgres_data_dir" ] && [ -x "$postgres_data_dir" ] || {
      echo "PostgreSQL data directory cannot be inspected safely." >&2
      exit 78
    }
    if ! first_entry="$(find "$postgres_data_dir" -mindepth 1 -print -quit 2>/dev/null)"; then
      echo "PostgreSQL data directory inspection failed." >&2
      exit 78
    fi
    if [ -n "$first_entry" ]; then
      echo "Fresh-empty confirmation cannot be used for a non-empty PostgreSQL data directory." >&2
      exit 78
    fi
  fi
}

stage_service() {
  service="$1"
  compose up -d --wait "$service"
  run_stage_gate "$service"
}

run_provider_preflight() {
  case "$internal_preflight_required" in
    false)
      echo "internal_preflight=SKIPPED reason=public_release"
      return
      ;;
    true) ;;
    *)
      echo "TIKDD_INTERNAL_PREFLIGHT_REQUIRED must be true or false." >&2
      exit 78
      ;;
  esac

  [ -n "$preflight_signals" ] || {
    echo "TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON is required when internal preflight is enabled." >&2
    exit 78
  }

  expected_status=2
  expected_decision=blocked
  if [ "$provider_rollout_enabled" = "true" ]; then
    expected_status=0
    expected_decision=ready
  fi

  preflight_status=0
  compose --profile ops run --rm \
    -e "TIKDD_INTERNAL_PREFLIGHT_SIGNALS_JSON=$preflight_signals" \
    preflight || preflight_status="$?"

  if [ "$preflight_status" -ne "$expected_status" ]; then
    echo "Provider preflight decision mismatch: expected $expected_decision (exit $expected_status), received exit $preflight_status." >&2
    [ "$preflight_status" -ne 0 ] && return "$preflight_status"
    return 78
  fi
  echo "provider_preflight=PASS expected_decision=$expected_decision exit_status=$preflight_status"
}

case "$action" in
  validate)
    validate
    ;;
  deploy)
    acquire_lock
    validate
    run_stage_gate baseline
    verify_migration_safety
    compose pull postgres redis web api worker delivery
    run_stage_gate images-prepared
    stage_service postgres
    stage_service redis
    compose --profile ops run --rm migration
    run_stage_gate migration
    stage_service api
    stage_service delivery
    if [ "$(release_value ENABLE_COBALT_PROVIDER "false")" = "true" ]; then
      compose --profile cobalt pull cobalt-api
      start_cobalt_authenticated
      run_stage_gate cobalt-api
    fi
    if [ "$(release_value ENABLE_YTDLP_PROVIDER "false")" = "true" ]; then
      compose --profile ytdlp pull ytdlp-runner
      start_ytdlp_runner
      run_stage_gate ytdlp-runner
    fi
    stage_service worker
    stage_service web
    run_provider_preflight
    run_stage_gate preflight
    compose ps
    ;;
  worker-config-apply)
    acquire_lock
    validate
    if [ "$(release_value ENABLE_COBALT_PROVIDER "false")" = "true" ]; then
      start_cobalt_authenticated
    fi
    if [ "$(release_value ENABLE_YTDLP_PROVIDER "false")" = "true" ]; then
      start_ytdlp_runner
    fi
    compose up -d --force-recreate --wait worker
    verify_worker_runtime_config
    ;;
  cobalt-runtime-probe)
    acquire_lock
    validate
    compose --profile cobalt pull cobalt-api
    start_cobalt_authenticated
    verify_cobalt_runtime
    ;;
  cobalt-runtime-stop)
    acquire_lock
    validate
    compose --profile cobalt stop cobalt-api
    echo "cobalt_runtime=STOPPED"
    ;;
  cobalt-multimode-qualification)
    acquire_lock
    validate
    verify_cobalt_qualification_input
    qualification_input="$(release_value TIKDD_COBALT_QUALIFICATION_INPUT "/run/tikdd/cobalt-qualification-input.json")"
    qualification_output="/run/tikdd/cobalt-qualification-tunnel-output.json"
    install -o 1000 -g 1000 -m 600 /dev/null "$qualification_output"
    trap 'rm -f "$qualification_input" "$qualification_output"' EXIT HUP INT TERM
    compose --profile cobalt pull cobalt-api
    start_cobalt_authenticated
    compose --profile cobalt --profile cobalt-ops run --rm cobalt-qualification
    rm -f "$qualification_input"
    if [ -s "$qualification_output" ]; then
      [ "$(stat -c '%a' "$qualification_output" 2>/dev/null || true)" = "600" ] || {
        echo "Cobalt qualification tunnel output must have mode 600." >&2
        exit 78
      }
      [ "$(stat -c '%u' "$qualification_output" 2>/dev/null || true)" = "1000" ] || {
        echo "Cobalt qualification tunnel output must be owned by service UID 1000." >&2
        exit 78
      }
      echo "cobalt_tunnel_artifact=READY samples=bounded path=$qualification_output"
    else
      rm -f "$qualification_output"
      echo "cobalt_tunnel_artifact=NONE"
    fi
    trap - EXIT HUP INT TERM
    ;;
  cobalt-tunnel-audit)
    acquire_lock
    validate
    verify_cobalt_tunnel_audit_input
    tunnel_audit_input="$(release_value TIKDD_COBALT_TUNNEL_AUDIT_INPUT "/run/tikdd/cobalt-tunnel-audit-input.json")"
    trap 'rm -f "$tunnel_audit_input"' EXIT HUP INT TERM
    compose --profile cobalt pull cobalt-api
    start_cobalt_authenticated
    compose --profile cobalt --profile cobalt-ops run --rm cobalt-tunnel-audit
    rm -f "$tunnel_audit_input"
    trap - EXIT HUP INT TERM
    ;;
  rollback)
    acquire_lock
    : "${TIKDD_ROLLBACK_ENV:?Set TIKDD_ROLLBACK_ENV to the previous approved release environment file.}"
    : "${TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED:?Set TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED=true only after review.}"
    [ "$TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED" = "true" ] || { echo "Schema compatibility is not confirmed." >&2; exit 78; }
    run_stage_gate rollback-baseline
    TIKDD_RELEASE_ENV="$TIKDD_ROLLBACK_ENV" sh "$0" validate
    TIKDD_PRODUCTION_ENV_FILE="$TIKDD_ROLLBACK_ENV" \
      docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" pull web api worker delivery
    for service in api delivery worker web; do
      TIKDD_PRODUCTION_ENV_FILE="$TIKDD_ROLLBACK_ENV" \
        docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" up -d --wait "$service"
      run_stage_gate "rollback-$service"
    done
    ;;
  admin-start)
    acquire_lock
    validate
    compose --profile admin pull admin-api admin
    if compose --profile admin up -d --wait admin-api admin; then
      :
    else
      status="$?"
      stop_admin_after_failure
      exit "$status"
    fi
    if verify_admin_write_mode "$expected_admin_write_mode"; then
      :
    else
      status="$?"
      stop_admin_after_failure
      exit "$status"
    fi
    if run_stage_gate admin-on-demand; then
      :
    else
      status="$?"
      stop_admin_after_failure
      exit "$status"
    fi
    ;;
  admin-stop)
    acquire_lock
    compose --profile admin stop admin admin-api
    run_stage_gate admin-stopped
    ;;
  admin-account)
    acquire_lock
    validate
    shift
    [ "$#" -gt 0 ] || {
      echo "Usage: $0 admin-account <account-cli arguments...>" >&2
      exit 64
    }
    compose --profile admin-ops run --rm admin-account "$@"
    ;;
  *)
    echo "Usage: $0 {validate|deploy|worker-config-apply|cobalt-runtime-probe|cobalt-runtime-stop|cobalt-multimode-qualification|cobalt-tunnel-audit|rollback|admin-start|admin-stop|admin-account}" >&2
    exit 64
    ;;
esac
