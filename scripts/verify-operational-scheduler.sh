#!/bin/sh
set -eu

systemctl_bin=${TIKDD_SYSTEMCTL:-systemctl}
release_dir=${TIKDD_RELEASE_DIR:-/opt/tikdd/current}
release_env=${TIKDD_RELEASE_ENV:-/etc/tikdd/production.env}
compose_file=${TIKDD_PRODUCTION_COMPOSE:-compose.production.yml}

fail() {
  echo "verify-operational-scheduler: $*" >&2
  exit 78
}

command -v "$systemctl_bin" >/dev/null 2>&1 || fail "$systemctl_bin is required"
command -v docker >/dev/null 2>&1 || fail "docker is required"
[ -r "$release_env" ] || fail "release environment is missing or unreadable"
[ -f "$release_dir/$compose_file" ] || fail "production Compose file is missing"

for timer in tikdd-canary.timer tikdd-evidence.timer tikdd-cleanup.timer; do
  "$systemctl_bin" is-enabled "$timer" >/dev/null || fail "$timer is not enabled"
  "$systemctl_bin" is-active "$timer" >/dev/null || fail "$timer is not active"
  next="$($systemctl_bin show "$timer" --property=NextElapseUSecRealtime --value)"
  [ -n "$next" ] || fail "$timer has no next trigger"
done

docker compose --env-file "$release_env" -f "$release_dir/$compose_file" \
  --profile ops run --rm --no-deps operational-readiness
printf '%s\n' "scheduler_and_operational_freshness=PASS"
