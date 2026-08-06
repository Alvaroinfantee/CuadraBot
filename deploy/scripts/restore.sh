#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  echo "Usage: restore.sh [--snapshot ID --apply] [--config backup.env]" >&2
}

root="${CUADRABOT_ROOT:-/srv/cuadrabot}"
backup_env=""
snapshot=""
apply=false
while (($#)); do
  case "$1" in
    --snapshot) snapshot="${2:-}"; shift 2 ;;
    --config) backup_env="${2:-}"; shift 2 ;;
    --apply) apply=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done
: "${backup_env:=$root/secrets/backup.env}"
[[ -f "$backup_env" && ! -L "$backup_env" ]] || { echo "Backup environment missing" >&2; exit 2; }
# shellcheck disable=SC1090
source "$backup_env"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
export RESTIC_REPOSITORY RESTIC_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

if [[ -z "$snapshot" ]]; then
  restic snapshots
  exit 0
fi
[[ "$snapshot" =~ ^[A-Fa-f0-9]{8,64}$ ]] || { echo "Snapshot must be a Restic snapshot ID" >&2; exit 2; }
target="$root/restore/$snapshot"
[[ ! -e "$target" ]] || { echo "Restore target already exists: $target" >&2; exit 2; }
echo "Restore will create staging directory $target and will not overwrite live data."
if [[ "$apply" != true ]]; then
  echo "Dry run complete. Add --apply to restore into staging."
  exit 0
fi
install -d -m 0700 "$target"
restic restore "$snapshot" --target "$target"
echo "Restore staged at $target. Validate contents and follow RUNBOOK.md; do not copy active job state."
