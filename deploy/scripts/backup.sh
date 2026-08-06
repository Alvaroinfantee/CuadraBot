#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

root="${CUADRABOT_ROOT:-/srv/cuadrabot}"
backup_env="${BACKUP_ENV_FILE:-$root/secrets/backup.env}"
[[ -f "$backup_env" && ! -L "$backup_env" ]] || { echo "Backup environment missing" >&2; exit 2; }
# shellcheck disable=SC1090
source "$backup_env"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
: "${RESTIC_KEEP_DAILY:=7}"
: "${RESTIC_KEEP_WEEKLY:=4}"
: "${RESTIC_KEEP_MONTHLY:=3}"
export RESTIC_REPOSITORY RESTIC_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

if ! restic snapshots >/dev/null 2>&1; then
  restic init
fi

# Active job material, Docker layers, and token registry state are intentionally
# excluded. Queued/processing work is reconciled and resubmitted after a host
# loss; copying live job state would retain confidential drawings unnecessarily.
restic backup \
  "$root/secrets" \
  "$root/manifests" \
  --exclude '*.env.example' \
  --tag cuadrabot-executor-config
restic forget \
  --keep-daily "$RESTIC_KEEP_DAILY" \
  --keep-weekly "$RESTIC_KEEP_WEEKLY" \
  --keep-monthly "$RESTIC_KEEP_MONTHLY" \
  --prune
restic check
