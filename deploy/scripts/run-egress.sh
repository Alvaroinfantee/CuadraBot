#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=deploy/scripts/lib.sh
source "$script_dir/lib.sh"

root="${CUADRABOT_ROOT:-/srv/cuadrabot}"
container="${EXECUTOR_EGRESS_CONTAINER:-cuadrabot-openai-egress}"
network="${EXECUTOR_EGRESS_NETWORK:-cuadrabot-egress}"
state_volume="${EXECUTOR_EGRESS_STATE_VOLUME:-cuadrabot-egress-state}"
state_dir="${EGRESS_STATE_DIR:-/state}"
egress_env="${EGRESS_ENV_FILE:-/run/cuadrabot-executor/egress.env}"

[[ -f "$egress_env" && ! -L "$egress_env" ]] || die "staged egress environment is missing"
[[ "$state_dir" == /* && "$state_dir" != / ]] || die "EGRESS_STATE_DIR must be a non-root absolute path"

if rootless_docker container inspect "$container" >/dev/null 2>&1; then
  running="$(rootless_docker inspect --format '{{.State.Running}}' "$container")"
  role="$(rootless_docker inspect --format '{{index .Config.Labels "com.cuadrabot.role"}}' "$container")"
  [[ "$role" == "egress-proxy" ]] || die "refusing to touch unexpected container $container"
  [[ "$running" != "true" ]] || die "egress container is already running"
  rootless_docker container rm "$container" >/dev/null
fi

if rootless_docker network inspect "$network" >/dev/null 2>&1; then
  [[ "$(rootless_docker network inspect --format '{{.Internal}}' "$network")" == "false" ]] || die "$network must provide egress"
  [[ "$(rootless_docker network inspect --format '{{index .Labels "com.cuadrabot.role"}}' "$network")" == "egress" ]] || die "refusing unexpected network $network"
else
  rootless_docker network create \
    --driver bridge \
    --label com.cuadrabot.role=egress \
    "$network" >/dev/null
fi

if rootless_docker volume inspect "$state_volume" >/dev/null 2>&1; then
  [[ "$(rootless_docker volume inspect --format '{{index .Labels "com.cuadrabot.role"}}' "$state_volume")" == "egress-state" ]] || die "refusing unexpected volume $state_volume"
else
  rootless_docker volume create --label com.cuadrabot.role=egress-state "$state_volume" >/dev/null
fi

exec /usr/bin/docker run --rm \
  --name "$container" \
  --label com.cuadrabot.role=egress-proxy \
  --network "$network" \
  --publish "127.0.0.1:${EGRESS_CONTROL_PORT}:${EGRESS_CONTROL_PORT}" \
  --env-file "$egress_env" \
  --env "EGRESS_DATA_HOST=${EGRESS_DATA_HOST}" \
  --env "EGRESS_DATA_PORT=${EGRESS_DATA_PORT}" \
  --env "EGRESS_CONTROL_HOST=${EGRESS_CONTROL_HOST}" \
  --env "EGRESS_CONTROL_PORT=${EGRESS_CONTROL_PORT}" \
  --env "EGRESS_STATE_DIR=${state_dir}" \
  --mount "type=volume,src=${state_volume},dst=${state_dir}" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 128 \
  --cpus 0.5 \
  --memory 512m \
  --memory-swap 512m \
  "$EXECUTOR_IMAGE" \
  node executor/src/egress-main.mjs
