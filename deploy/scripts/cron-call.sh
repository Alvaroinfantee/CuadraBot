#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

kind="${1:-}"
case "$kind" in
  reconcile) endpoint="/api/internal/cron/reconcile" ;;
  retention) endpoint="/api/internal/cron/retention" ;;
  archive-integrity) endpoint="/api/internal/cron/archive-integrity" ;;
  *) echo "Unknown cron task: $kind" >&2; exit 2 ;;
esac

[[ "${CUADRABOT_API_URL:-}" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || {
  echo "CUADRABOT_API_URL must be an HTTPS origin without a path" >&2
  exit 2
}
[[ "${CRON_SECRET:-}" =~ ^[A-Za-z0-9._+=@/-]{32,}$ ]] || {
  echo "CRON_SECRET is missing or unsafe" >&2
  exit 2
}

# Read the bearer header from stdin so it never appears in argv/process lists.
{
  printf 'url = "%s%s"\n' "$CUADRABOT_API_URL" "$endpoint"
  printf 'request = "POST"\n'
  printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET"
  printf 'proto = "=https"\n'
  printf 'tlsv1.2\n'
  printf 'fail-with-body\n'
  printf 'silent\n'
  printf 'show-error\n'
  printf 'max-time = 900\n'
} | /usr/bin/curl --config -
