#!/bin/sh
set -eu
password_file="${REDIS_PASSWORD_FILE:-/run/secrets/redis_password}"
[ -r "$password_file" ] || exit 1
REDISCLI_AUTH="$(cat "$password_file")" redis-cli --no-auth-warning ping | grep -qx PONG
