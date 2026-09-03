#!/bin/sh
set -eu

# Restore an encrypted backup from an off-host path into a disposable, private
# PostgreSQL instance. The database volume, network and container are removed on exit.

artifact=${1:-${TIKDD_RESTORE_BACKUP:-}}
gpg_home=${TIKDD_RESTORE_GPG_HOME:-}
password_file=${TIKDD_RESTORE_DB_PASSWORD_FILE:-}
postgres_image=${TIKDD_RESTORE_DB_IMAGE:-postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94}
network_name=${TIKDD_RESTORE_NETWORK:-tikdd-p0-dr-01-net}
volume_name=${TIKDD_RESTORE_VOLUME:-tikdd-p0-dr-01-pgdata}
database_container=${TIKDD_RESTORE_CONTAINER:-tikdd-p0-dr-01-restore-db}
database_name=${TIKDD_RESTORE_DB_NAME:-tikdd_restore}
database_user=${TIKDD_RESTORE_DB_USER:-restore_operator}

fail() {
  echo "restore-postgres-drill: $*" >&2
  exit 78
}

for command_name in gpg sha256sum docker dirname basename seq sleep grep printf cat; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done
[ -n "$artifact" ] || fail "pass the off-host encrypted artifact path"
case "$artifact" in
  /*) ;;
  *) fail "the backup path must be absolute" ;;
esac
case "$artifact" in
  /var/backups/tikdd/*) fail "restore must start from an off-host copy" ;;
esac
[ -f "$artifact" ] || fail "encrypted artifact is missing"
[ -n "$gpg_home" ] && [ -d "$gpg_home" ] || fail "TIKDD_RESTORE_GPG_HOME is required"
[ -n "$password_file" ] && [ -f "$password_file" ] && [ -r "$password_file" ] || \
  fail "TIKDD_RESTORE_DB_PASSWORD_FILE must be a readable file"

for name in "$network_name" "$volume_name" "$database_container"; do
  case "$name" in
    ''|*[!A-Za-z0-9_.-]*) fail "invalid Docker resource name: $name" ;;
  esac
done

checksum_file="$artifact.sha256"
[ -f "$checksum_file" ] || fail "checksum sidecar is missing: $checksum_file"
(cd "$(dirname "$artifact")" && sha256sum -c "$(basename "$checksum_file")")

docker network inspect "$network_name" >/dev/null 2>&1 && fail "network already exists: $network_name" || true
docker volume inspect "$volume_name" >/dev/null 2>&1 && fail "volume already exists: $volume_name" || true
docker container inspect "$database_container" >/dev/null 2>&1 && fail "container already exists: $database_container" || true

cleanup() {
  docker rm -f "$database_container" >/dev/null 2>&1 || true
  docker volume rm "$volume_name" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker network create --internal "$network_name" >/dev/null
docker volume create "$volume_name" >/dev/null
docker run -d --name "$database_container" --network "$network_name" \
  --mount "type=volume,src=$volume_name,dst=/var/lib/postgresql/data" \
  --mount "type=bind,src=$password_file,dst=/run/secrets/restore_password,readonly" \
  --env POSTGRES_USER="$database_user" --env POSTGRES_DB="$database_name" \
  --env POSTGRES_PASSWORD_FILE=/run/secrets/restore_password "$postgres_image" \
  >/dev/null

ready=false
for attempt in $(seq 1 60); do
  if docker run --rm --network "$network_name" "$postgres_image" \
      pg_isready --host "$database_container" --username "$database_user" --dbname "$database_name" \
      >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[ "$ready" = true ] || fail "isolated PostgreSQL did not become ready"

set -o pipefail
gpg --homedir "$gpg_home" --batch --quiet --decrypt "$artifact" | \
  docker run --rm -i --network "$network_name" \
    --mount "type=bind,src=$password_file,dst=/run/secrets/restore_password,readonly" \
    "$postgres_image" sh -ceu '
      export PGPASSWORD="$(cat /run/secrets/restore_password)"
      exec pg_restore --format=custom --no-owner --no-privileges --exit-on-error \
        --host="$1" --username="$2" --dbname="$3" -
    ' sh "$database_container" "$database_user" "$database_name"

validation=$(docker run --rm --network "$network_name" \
  --mount "type=bind,src=$password_file,dst=/run/secrets/restore_password,readonly" \
  "$postgres_image" sh -ceu '
    export PGPASSWORD="$(cat /run/secrets/restore_password)"
    exec psql --host="$1" --username="$2" --dbname="$3" -At -F "|" -v ON_ERROR_STOP=1
  ' sh "$database_container" "$database_user" "$database_name" <<'SQL'
SELECT 'table|' || table_name
FROM (VALUES
  ('resolve_tasks'),
  ('provider_attempts'),
  ('delivery_candidates'),
  ('active_source_admissions'),
  ('delivery_tickets'),
  ('provider_delivery_outcomes'),
  ('provider_daily_evidence')
) AS required(table_name)
WHERE to_regclass('public.' || table_name) IS NOT NULL
ORDER BY table_name;
SELECT 'count|resolve_tasks|' || COUNT(*) FROM resolve_tasks;
SELECT 'count|provider_attempts|' || COUNT(*) FROM provider_attempts;
SELECT 'count|delivery_candidates|' || COUNT(*) FROM delivery_candidates;
SELECT 'count|delivery_tickets|' || COUNT(*) FROM delivery_tickets;
SELECT 'integrity|candidate_missing_task|' || COUNT(*)
FROM delivery_candidates c LEFT JOIN resolve_tasks t ON t.id = c.task_id WHERE t.id IS NULL;
SELECT 'integrity|ticket_missing_candidate|' || COUNT(*)
FROM delivery_tickets d LEFT JOIN delivery_candidates c ON c.id = d.candidate_id WHERE c.id IS NULL;
SELECT 'integrity|attempt_missing_task|' || COUNT(*)
FROM provider_attempts a LEFT JOIN resolve_tasks t ON t.id = a.task_id WHERE t.id IS NULL;
SQL
)

for table_name in resolve_tasks provider_attempts delivery_candidates active_source_admissions \
  delivery_tickets provider_delivery_outcomes provider_daily_evidence; do
  printf '%s\n' "$validation" | grep -F "table|$table_name" >/dev/null || fail "missing restored table: $table_name"
done
for invariant in 'integrity|candidate_missing_task|0' 'integrity|ticket_missing_candidate|0' \
  'integrity|attempt_missing_task|0'; do
  printf '%s\n' "$validation" | grep -F "$invariant" >/dev/null || fail "restored integrity check failed: $invariant"
done

printf '%s\n' "$validation"
printf '%s\n' \
  "restore_result=PASS" \
  "decrypted_artifact_persisted=false" \
  "restore_volume_cleanup=scheduled_on_exit"
