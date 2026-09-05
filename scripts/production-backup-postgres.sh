#!/bin/sh
set -eu

# Create one encrypted custom-format dump from the live TikDD PostgreSQL container.
# This script intentionally does not schedule backups or copy them to a destination.

backup_dir=${TIKDD_BACKUP_DIR:-/var/backups/tikdd/p0-dr-01}
postgres_container=${TIKDD_BACKUP_POSTGRES_CONTAINER:-tikdd-postgres-1}
postgres_image=${TIKDD_BACKUP_POSTGRES_IMAGE:-postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94}
database_name=${TIKDD_POSTGRES_DB:-tikdd}
database_user=${TIKDD_POSTGRES_USER:-tikdd}
recipient=${TIKDD_BACKUP_RECIPIENT:-}
lock_file=${TIKDD_BACKUP_LOCK:-/run/lock/tikdd-backup.lock}

fail() {
  echo "production-backup-postgres: $*" >&2
  exit 78
}

for command_name in docker gpg sha256sum stat date flock mkdir chmod dirname rm cat grep awk; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done

[ -n "$recipient" ] || fail "TIKDD_BACKUP_RECIPIENT must name the dedicated public recipient"
case "$backup_dir" in
  /var/backups/tikdd/*) ;;
  *) fail "TIKDD_BACKUP_DIR must remain below /var/backups/tikdd" ;;
esac
[ "$backup_dir" != "/var/backups/tikdd/" ] || fail "TIKDD_BACKUP_DIR must name a child directory"

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
mkdir -p "$(dirname "$lock_file")"
exec 9>"$lock_file"
flock -n 9 || fail "another TikDD backup already holds $lock_file"

health_status=$(docker inspect -f '{{.State.Health.Status}}' "$postgres_container" 2>/dev/null || true)
[ "$health_status" = healthy ] || fail "PostgreSQL container is not healthy"

postgres_version=$(docker exec "$postgres_container" postgres --version)
pg_dump_version=$(docker exec "$postgres_container" pg_dump --version)
gpg --batch --list-keys --with-colons "$recipient" | grep '^fpr:' >/dev/null 2>&1 || \
  fail "the configured public recipient is not present in the production keyring"

started_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
stamp=$(date -u '+%Y%m%dT%H%M%SZ')
encrypted_file="$backup_dir/tikdd-prod-$stamp.dump.gpg"
plain_partial="$backup_dir/tikdd-prod-$stamp.dump.partial"
encrypted_partial="$encrypted_file.partial"
checksum_partial="$encrypted_file.sha256.partial"
container_dump="/tmp/tikdd-p0-dr-01-$stamp-$$.dump"
plain_removed=false

cleanup() {
  rm -f "$plain_partial" "$encrypted_partial" "$checksum_partial"
  docker exec "$postgres_container" rm -f "$container_dump" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker exec "$postgres_container" sh -c '
  set -eu
  export PGPASSWORD="$(cat /run/secrets/postgres_password)"
  exec pg_dump --format=custom --no-owner --no-privileges --file="$1" \
    --username="$2" --dbname="$3"
' sh "$container_dump" "$database_user" "$database_name"
docker cp "$postgres_container:$container_dump" "$plain_partial" >/dev/null
docker exec "$postgres_container" rm -f "$container_dump"

raw_bytes=$(stat -c '%s' "$plain_partial")
[ "$raw_bytes" -gt 0 ] || fail "pg_dump produced an empty custom-format dump"

# Validate the custom archive in a network-isolated disposable container before encryption.
cat "$plain_partial" | docker run --rm -i --read-only --network none \
  --security-opt no-new-privileges:true --cap-drop ALL "$postgres_image" pg_restore --list \
  >/dev/null

gpg --batch --yes --trust-model always --output "$encrypted_partial" \
  --encrypt --recipient "$recipient" "$plain_partial"
mv "$encrypted_partial" "$encrypted_file"
chmod 600 "$encrypted_file"

encrypted_bytes=$(stat -c '%s' "$encrypted_file")
[ "$encrypted_bytes" -gt 0 ] || fail "encryption produced an empty artifact"
sha256=$(sha256sum "$encrypted_file" | awk '{print $1}')
printf '%s  %s\n' "$sha256" "$(basename "$encrypted_file")" >"$checksum_partial"
chmod 600 "$checksum_partial"
mv "$checksum_partial" "$encrypted_file.sha256"
rm -f "$plain_partial"
plain_removed=true
completed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

printf '%s\n' \
  "database=$database_name" \
  "postgres_version=$postgres_version" \
  "pg_dump_version=$pg_dump_version" \
  "started_at=$started_at" \
  "completed_at=$completed_at" \
  "raw_dump_bytes=$raw_bytes" \
  "encrypted_filename=$(basename "$encrypted_file")" \
  "encrypted_bytes=$encrypted_bytes" \
  "sha256=$sha256" \
  "plaintext_removed=$plain_removed"
