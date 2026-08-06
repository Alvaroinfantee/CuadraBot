#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

[[ "$(id -u)" -eq 0 ]] || { echo "stage-egress-env.sh must run as root" >&2; exit 2; }

root="${CUADRABOT_ROOT:-/srv/cuadrabot}"
executor_user="${CUADRABOT_EXECUTOR_USER:-cuadraexec}"
source_env="$root/secrets/egress.env"
target_env="${EGRESS_ENV_FILE:-/run/cuadrabot-executor/egress.env}"

[[ "$target_env" == /run/cuadrabot-executor/egress.env ]] || {
  echo "EGRESS_ENV_FILE must be /run/cuadrabot-executor/egress.env" >&2
  exit 2
}
[[ -f "$source_env" && ! -L "$source_env" ]] || { echo "Egress environment missing" >&2; exit 2; }
[[ "$(stat -c '%U:%G:%a' "$source_env")" == root:root:600 ]] || {
  echo "$source_env must be root:root mode 0600" >&2
  exit 2
}
[[ -d "$(dirname -- "$target_env")" && ! -L "$(dirname -- "$target_env")" ]] || {
  echo "Egress runtime directory is missing or unsafe" >&2
  exit 2
}

install -o "$executor_user" -g "$executor_user" -m 0600 -- "$source_env" "$target_env"
