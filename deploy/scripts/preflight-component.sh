#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=deploy/scripts/lib.sh
source "$script_dir/lib.sh"

component="${1:-}"
root="${CUADRABOT_ROOT:-/srv/cuadrabot}"
release="${CUADRABOT_RELEASE:-$root/current}"

check_release() {
  [[ -L "$release" ]] || die "$release must be an atomic release symlink"
  local resolved_release
  resolved_release="$(readlink -f -- "$release")"
  [[ "$resolved_release" == "$root/releases/"* ]] || die "release symlink escapes $root/releases"
  [[ "$(basename -- "$resolved_release")" =~ ^[a-f0-9]{40}$ ]] || die "release directory must be a full Git commit"
  printf '%s\n' "$resolved_release"
}

check_host_config() {
  require_exact_file_mode "$root/secrets/host.env" root 600 root
}

case "$component" in
  worker)
    resolved_release="$(check_release)"
    require_exact_file_mode "$root/secrets/worker.env" root 600 root
    require_secret_key "$root/secrets/worker.env" WORKER_SHARED_SECRET
    require_secret_key "$root/secrets/worker.env" TAKEOFF_SERVICE_API_TOKEN
    [[ -f "$resolved_release/worker/src/index.ts" ]] || die "worker entrypoint missing"
    ;;
  broker)
    resolved_release="$(check_release)"
    check_host_config
    require_exact_file_mode "$root/secrets/broker.env" root 600 root
    require_secret_key "$root/secrets/broker.env" EXECUTOR_BROKER_TOKEN
    require_secret_key "$root/secrets/broker.env" EXECUTOR_EGRESS_CONTROL_TOKEN
    require_secret_key "$root/secrets/broker.env" EXECUTOR_PROCESSOR_KEY_SECRET
    require_secret_key "$root/secrets/broker.env" EXECUTOR_SAFETY_SECRET
    [[ -f "$resolved_release/executor/src/broker-main.mjs" ]] || die "broker entrypoint missing"
    is_image_digest "${EXECUTOR_PROCESSOR_IMAGE:-}" || die "EXECUTOR_PROCESSOR_IMAGE must be pinned by repository sha256 digest"
    [[ "${EXECUTOR_BROKER_HOST:-}" == "127.0.0.1" ]] || die "broker host must be 127.0.0.1"
    [[ "${EXECUTOR_BROKER_PORT:-}" == "8090" ]] || die "broker port must be 8090"
    [[ "${EXECUTOR_PROCESSOR_MEMORY:-}" == "6g" ]] || die "processor memory must be 6g"
    [[ "${EXECUTOR_PROCESSOR_MEMORY_SWAP:-}" == "6g" ]] || die "processor memory+swap must be 6g"
    [[ "${EXECUTOR_MAX_CONCURRENT_JOBS:-}" == "1" ]] || die "exactly one concurrent job is supported on this host"
    "$script_dir/wait-for-docker.sh"
    ;;
  egress)
    check_host_config
    require_exact_file_mode "$root/secrets/egress.env" root 600 root
    require_secret_key "$root/secrets/egress.env" OPENAI_API_KEY
    require_secret_key "$root/secrets/egress.env" EGRESS_CONTROL_TOKEN
    is_image_digest "${EXECUTOR_IMAGE:-}" || die "EXECUTOR_IMAGE must be pinned by repository sha256 digest"
    [[ "${EXECUTOR_EGRESS_CONTAINER:-}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || die "invalid egress container name"
    [[ "${EXECUTOR_EGRESS_NETWORK:-}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || die "invalid egress network name"
    [[ "${EXECUTOR_EGRESS_STATE_VOLUME:-}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || die "invalid egress state volume name"
    [[ "${EGRESS_STATE_DIR:-}" == /* && "${EGRESS_STATE_DIR:-}" != / ]] || die "invalid egress state directory"
    [[ "${EGRESS_DATA_PORT:-}" == "8091" ]] || die "egress data port must be 8091"
    [[ "${EGRESS_CONTROL_PORT:-}" == "8092" ]] || die "egress control port must be 8092"
    "$script_dir/wait-for-docker.sh"
    ;;
  cron)
    require_exact_file_mode "$root/secrets/cron.env" root 600 root
    require_secret_key "$root/secrets/cron.env" CRON_SECRET
    ;;
  *)
    die "component must be worker, broker, egress, or cron"
    ;;
esac
