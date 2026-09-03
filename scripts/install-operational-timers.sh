#!/bin/sh
set -eu

unit_dir=${TIKDD_SYSTEMD_UNIT_DIR:-/etc/systemd/system}
systemctl_bin=${TIKDD_SYSTEMCTL:-systemctl}
source_dir=${TIKDD_SYSTEMD_SOURCE_DIR:-$(CDPATH= cd -- "$(dirname "$0")/../deploy/systemd" && pwd)}

fail() {
  echo "install-operational-timers: $*" >&2
  exit 78
}

command -v "$systemctl_bin" >/dev/null 2>&1 || fail "$systemctl_bin is required"
command -v install >/dev/null 2>&1 || fail "install is required"
for unit in tikdd-canary.service tikdd-canary.timer tikdd-evidence.service tikdd-evidence.timer tikdd-cleanup.service tikdd-cleanup.timer; do
  [ -r "$source_dir/$unit" ] || fail "unit template is missing: $unit"
done

install -d -m 0755 "$unit_dir"
for unit in tikdd-canary.service tikdd-canary.timer tikdd-evidence.service tikdd-evidence.timer tikdd-cleanup.service tikdd-cleanup.timer; do
  install -m 0644 "$source_dir/$unit" "$unit_dir/$unit"
done

"$systemctl_bin" daemon-reload
for timer in tikdd-canary.timer tikdd-evidence.timer tikdd-cleanup.timer; do
  "$systemctl_bin" enable --now "$timer"
done

for timer in tikdd-canary.timer tikdd-evidence.timer tikdd-cleanup.timer; do
  "$systemctl_bin" is-enabled "$timer" >/dev/null
  "$systemctl_bin" is-active "$timer" >/dev/null
  next="$($systemctl_bin show "$timer" --property=NextElapseUSecRealtime --value)"
  [ -n "$next" ] || fail "$timer has no next trigger"
done
printf '%s\n' "operational_timers=installed_and_active"
