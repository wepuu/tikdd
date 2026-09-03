#!/bin/sh
set -eu

operation=${1:-}
release_dir=${TIKDD_RELEASE_DIR:-/opt/tikdd/current}
release_env=${TIKDD_RELEASE_ENV:-/etc/tikdd/production.env}
compose_file=${TIKDD_PRODUCTION_COMPOSE:-compose.production.yml}
lock_file=${TIKDD_DEPLOYMENT_LOCK:-/run/lock/tikdd-deploy.lock}

fail() {
  echo "run-scheduled-operation: $*" >&2
  exit 78
}

case "$operation" in
  canary) service=canary-scheduled ;;
  evidence) service=evidence-scheduled ;;
  cleanup) service=cleanup-scheduled ;;
  *) fail "operation must be canary, evidence, or cleanup" ;;
esac

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v flock >/dev/null 2>&1 || fail "flock is required"
case "$release_dir" in
  /*) ;;
  *) fail "TIKDD_RELEASE_DIR must be absolute" ;;
esac
[ "$release_dir" != "/" ] || fail "TIKDD_RELEASE_DIR cannot be filesystem root"
[ -r "$release_env" ] || fail "release environment is missing or unreadable"
[ -f "$release_dir/$compose_file" ] || fail "production Compose file is missing"

mkdir -p "$(dirname "$lock_file")"
exec 9>"$lock_file"
# A shared deployment lock prevents execution against a half-switched release. Redis leases
# inside each application remain the singleton authority for manual/duplicate invocations.
flock -s 9
exec docker compose --env-file "$release_env" -f "$release_dir/$compose_file" \
  --profile ops run --rm --no-deps "$service"
