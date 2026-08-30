#!/bin/sh
set -eu

password_file="${REDIS_PASSWORD_FILE:-/run/secrets/redis_password}"
if [ ! -r "$password_file" ]; then
  echo "Redis password file is missing or unreadable." >&2
  exit 78
fi
password="$(cat "$password_file")"
if [ -z "$password" ]; then
  echo "Redis password file is empty." >&2
  exit 78
fi

umask 077
mkdir -p /run/tikdd-redis
cat > /run/tikdd-redis/redis.conf <<EOF
bind 0.0.0.0
protected-mode yes
port 6379
dir /data
appendonly yes
appendfsync everysec
maxmemory ${TIKDD_REDIS_MAXMEMORY:-128mb}
maxmemory-policy noeviction
requirepass $password
EOF
unset password
exec redis-server /run/tikdd-redis/redis.conf
