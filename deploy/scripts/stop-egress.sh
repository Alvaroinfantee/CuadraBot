#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

container="${EXECUTOR_EGRESS_CONTAINER:-cuadrabot-openai-egress}"
if ! /usr/bin/docker container inspect "$container" >/dev/null 2>&1; then
  exit 0
fi
role="$(/usr/bin/docker inspect --format '{{index .Config.Labels "com.cuadrabot.role"}}' "$container")"
[[ "$role" == "egress-proxy" ]] || {
  echo "Refusing to stop unexpected container $container" >&2
  exit 1
}
/usr/bin/docker stop --time 20 "$container" >/dev/null
