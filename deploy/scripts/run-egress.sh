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
egress_memory="${EXECUTOR_EGRESS_MEMORY:-512m}"
egress_memory_swap="${EXECUTOR_EGRESS_MEMORY_SWAP:-$egress_memory}"
egress_cpus="${EXECUTOR_EGRESS_CPUS:-0.5}"
egress_pids="${EXECUTOR_EGRESS_PIDS:-128}"

[[ -f "$egress_env" && ! -L "$egress_env" ]] || die "staged egress environment is missing"
[[ "$state_dir" == /* && "$state_dir" != / ]] || die "EGRESS_STATE_DIR must be a non-root absolute path"
[[ "$egress_memory_swap" == "$egress_memory" ]] || die "egress memory-swap must equal memory"
[[ "$egress_memory" =~ ^[1-9][0-9]*[mg]$ ]] || die "invalid egress memory limit"
[[ "$egress_cpus" =~ ^(0\.[0-9]*[1-9]|[1-9][0-9]*(\.[0-9]+)?)$ ]] || die "invalid egress CPU limit"
[[ "$egress_pids" =~ ^[1-9][0-9]*$ ]] || die "invalid egress PID limit"

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
  --pids-limit "$egress_pids" \
  --cpus "$egress_cpus" \
  --memory "$egress_memory" \
  --memory-swap "$egress_memory_swap" \
  "$EXECUTOR_IMAGE" \
  node executor/src/egress-main.mjs
