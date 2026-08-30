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

validate() {
  compose --profile admin --profile ops --profile admin-ops config --quiet
}

case "$action" in
  validate)
    validate
    ;;
  deploy)
    command -v flock >/dev/null 2>&1 || { echo "flock is required." >&2; exit 78; }
    exec 9>"$lock_file"
    flock -n 9 || { echo "Another TikDD deployment holds the host lock." >&2; exit 75; }
    validate
    : "${TIKDD_BACKUP_VERIFY_COMMAND:?Set TIKDD_BACKUP_VERIFY_COMMAND to the infrastructure-owner backup verification hook.}"
    sh -c "$TIKDD_BACKUP_VERIFY_COMMAND"
    compose pull postgres redis web api worker delivery admin-api admin
    compose up -d postgres redis
    compose --profile ops run --rm migration
    compose up -d web api worker delivery
    compose --profile admin up -d admin-api admin
    compose --profile ops run --rm preflight
    compose ps
    ;;
  rollback)
    command -v flock >/dev/null 2>&1 || { echo "flock is required." >&2; exit 78; }
    exec 9>"$lock_file"
    flock -n 9 || { echo "Another TikDD deployment holds the host lock." >&2; exit 75; }
    : "${TIKDD_ROLLBACK_ENV:?Set TIKDD_ROLLBACK_ENV to the previous approved release environment file.}"
    : "${TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED:?Set TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED=true only after review.}"
    [ "$TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED" = "true" ] || { echo "Schema compatibility is not confirmed." >&2; exit 78; }
    TIKDD_RELEASE_ENV="$TIKDD_ROLLBACK_ENV" "$0" validate
    docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" pull web api worker delivery admin-api admin
    docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" up -d web api worker delivery
    docker compose --env-file "$TIKDD_ROLLBACK_ENV" -f "$compose_file" --profile admin up -d admin-api admin
    ;;
  *)
    echo "Usage: $0 {validate|deploy|rollback}" >&2
    exit 64
    ;;
esac
