#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

manifest="${1:-}"
host_env="${2:-}"
[[ -f "$manifest" && ! -L "$manifest" ]] || { echo "Immutable image manifest missing" >&2; exit 2; }
[[ -f "$host_env" && ! -L "$host_env" ]] || { echo "Host environment missing" >&2; exit 2; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=deploy/scripts/lib.sh
source "$script_dir/lib.sh"

executor_image="$(sed -n 's/^EXECUTOR_IMAGE=//p' "$manifest" | tail -n1)"
processor_image="$(sed -n 's/^EXECUTOR_PROCESSOR_IMAGE=//p' "$manifest" | tail -n1)"
is_image_digest "$executor_image" || die "manifest egress image is not digest-pinned"
is_image_digest "$processor_image" || die "manifest processor image is not digest-pinned"

target_dir="$(cd -- "$(dirname -- "$host_env")" && pwd -P)"
temp_env="$(mktemp "$target_dir/.host.env.XXXXXX")"
cleanup() {
  [[ -z "${temp_env:-}" || ! -e "$temp_env" ]] || rm -f -- "$temp_env"
}
trap cleanup EXIT
awk -v executor="$executor_image" -v processor="$processor_image" '
  BEGIN { seen_executor=0; seen_processor=0 }
  /^EXECUTOR_IMAGE=/ { print "EXECUTOR_IMAGE=" executor; seen_executor=1; next }
  /^EXECUTOR_PROCESSOR_IMAGE=/ { print "EXECUTOR_PROCESSOR_IMAGE=" processor; seen_processor=1; next }
  { print }
  END { if (!seen_executor || !seen_processor) exit 42 }
' "$host_env" > "$temp_env"
owner="$(stat -c '%u:%g' "$host_env")"
chown "$owner" "$temp_env"
chmod 0600 "$temp_env"
mv -Tf -- "$temp_env" "$host_env"
temp_env=""
