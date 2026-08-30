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

validate() {
  compose --profile admin --profile ops --profile admin-ops config --quiet
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

run_stage_gate() {
  stage="$1"
  [ -n "$stage_gate_command" ] || {
    echo "TIKDD_STAGE_VERIFY_COMMAND is required for staged shared-host deployment." >&2
    exit 78
  }
  TIKDD_STAGE="$stage" sh -c "$stage_gate_command"
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
    stage_service worker
    stage_service web
    compose --profile ops run --rm preflight
    run_stage_gate preflight
    compose ps
    ;;
  rollback)
    acquire_lock
    : "${TIKDD_ROLLBACK_ENV:?Set TIKDD_ROLLBACK_ENV to the previous approved release environment file.}"
    : "${TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED:?Set TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED=true only after review.}"
    [ "$TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED" = "true" ] || { echo "Schema compatibility is not confirmed." >&2; exit 78; }
    run_stage_gate rollback-baseline
    TIKDD_RELEASE_ENV="$TIKDD_ROLLBACK_ENV" "$0" validate
    docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" pull web api worker delivery
    for service in api delivery worker web; do
      docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" up -d --wait "$service"
      run_stage_gate "rollback-$service"
    done
    ;;
  admin-start)
    acquire_lock
    validate
    compose --profile admin pull admin-api admin
    compose --profile admin up -d --wait admin-api admin
    run_stage_gate admin-on-demand
    ;;
  admin-stop)
    acquire_lock
    compose --profile admin stop admin admin-api
    run_stage_gate admin-stopped
    ;;
  *)
    echo "Usage: $0 {validate|deploy|rollback|admin-start|admin-stop}" >&2
    exit 64
    ;;
esac
