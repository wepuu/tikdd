#!/bin/sh
set -eu

# Verify an encrypted custom-format artifact from an off-host location without
# persisting a decrypted dump.

artifact=${1:-${TIKDD_BACKUP_ARTIFACT:-}}
gpg_home=${TIKDD_BACKUP_GPG_HOME:-}
postgres_image=${TIKDD_BACKUP_POSTGRES_IMAGE:-postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94}

fail() {
  echo "verify-postgres-backup: $*" >&2
  exit 78
}

for command_name in gpg sha256sum docker dirname basename cd; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done
[ -n "$artifact" ] || fail "pass the off-host encrypted artifact path"
case "$artifact" in
  /var/backups/tikdd/*) fail "the verifier must read an off-host copy" ;;
esac
[ -f "$artifact" ] || fail "encrypted artifact is missing"
[ -n "$gpg_home" ] || fail "TIKDD_BACKUP_GPG_HOME is required"
[ -d "$gpg_home" ] || fail "GPG home is missing"

checksum_file="$artifact.sha256"
[ -f "$checksum_file" ] || fail "checksum sidecar is missing: $checksum_file"
(cd "$(dirname "$artifact")" && sha256sum -c "$(basename "$checksum_file")")

set -o pipefail
gpg --homedir "$gpg_home" --batch --quiet --decrypt "$artifact" | \
  docker run --rm -i --read-only --network none \
    --security-opt no-new-privileges:true --cap-drop ALL "$postgres_image" pg_restore --list \
    >/dev/null

printf '%s\n' \
  "encrypted_filename=$(basename "$artifact")" \
  "checksum=PASS" \
  "custom_format=PASS" \
  "decrypted_artifact_persisted=false"
