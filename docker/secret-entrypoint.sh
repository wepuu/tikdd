#!/bin/sh
set -eu

is_allowed_secret() {
  case "$1" in
    DATABASE_URL|PUBLIC_CONTENT_DATABASE_URL|REDIS_URL|DELIVERY_ENCRYPTION_KEY_BASE64URL|TASK_ADMISSION_HMAC_KEY_BASE64URL|PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL|TIKDD_INTERNAL_PREFLIGHT_HMAC_KEY_BASE64URL|TIKDD_INTERNAL_PREFLIGHT_ATTESTATION|ADMIN_CSRF_SECRET|ADMIN_COMMAND_SECRET|ADMIN_ORIGIN_PROOF|PUBLIC_CONTENT_REVALIDATION_SECRET|PROVIDER_DIAGNOSTICS_TOKEN|PILOT_EVIDENCE_DIAGNOSTICS_TOKEN)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

load_secret() {
  name="$1"
  required="$2"
  is_allowed_secret "$name" || {
    echo "Unsupported TikDD secret binding: $name" >&2
    exit 78
  }
  file_variable="${name}_FILE"
  file_path="$(printenv "$file_variable" 2>/dev/null || true)"
  if [ -z "$file_path" ]; then
    if [ "$required" = "true" ]; then
      echo "Required TikDD secret file binding is missing: $file_variable" >&2
      exit 78
    fi
    return 0
  fi
  if [ ! -f "$file_path" ] || [ ! -r "$file_path" ]; then
    if [ "$required" = "true" ]; then
      echo "TikDD secret file is missing or unreadable: $file_variable" >&2
      exit 78
    fi
    return 0
  fi
  value="$(cat "$file_path")"
  if [ -z "$value" ]; then
    echo "TikDD secret file is empty: $file_variable" >&2
    exit 78
  fi
  export "$name=$value"
  unset "$file_variable"
}

for secret_name in ${TIKDD_REQUIRED_SECRET_ENV_VARS:-}; do
  load_secret "$secret_name" true
done
for secret_name in ${TIKDD_OPTIONAL_SECRET_ENV_VARS:-}; do
  load_secret "$secret_name" false
done

unset TIKDD_REQUIRED_SECRET_ENV_VARS TIKDD_OPTIONAL_SECRET_ENV_VARS
exec "$@"
