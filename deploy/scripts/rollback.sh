#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  echo "Usage: sudo rollback.sh [FULL_40_CHAR_COMMIT] [--config host.env] [--apply]" >&2
}

target_commit=""
config_file=""
apply=false
while (($#)); do
  case "$1" in
    --config) config_file="${2:-}"; shift 2 ;;
    --apply) apply=true; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
    *) [[ -z "$target_commit" ]] || { echo "Only one target is allowed" >&2; exit 2; }; target_commit="$1"; shift ;;
  esac
done
[[ "$(id -u)" -eq 0 ]] || { echo "Run with sudo" >&2; exit 2; }
: "${config_file:=/srv/cuadrabot/secrets/host.env}"
# shellcheck disable=SC1090
source "$config_file"
: "${CUADRABOT_ROOT:=/srv/cuadrabot}"
: "${CUADRABOT_RELEASE:=$CUADRABOT_ROOT/current}"
: "${CUADRABOT_DEPLOY_USER:=cuadrabot}"
: "${CUADRABOT_EXECUTOR_UID:=10002}"
: "${CUADRABOT_LIBEXEC:=/usr/local/lib/cuadrabot}"
export DOCKER_HOST="unix:///run/user/$CUADRABOT_EXECUTOR_UID/docker.sock"

if [[ -z "$target_commit" ]]; then
  [[ -L "$CUADRABOT_ROOT/previous" ]] || { echo "No previous release is recorded" >&2; exit 2; }
  target_commit="$(basename -- "$(readlink -f -- "$CUADRABOT_ROOT/previous")")"
fi
[[ "$target_commit" =~ ^[a-f0-9]{40}$ ]] || { echo "Target must be a full Git commit" >&2; exit 2; }
target="$CUADRABOT_ROOT/releases/$target_commit"
[[ -d "$target" && ! -L "$target" ]] || { echo "Target release is not installed" >&2; exit 2; }
[[ "$(runuser -u "$CUADRABOT_DEPLOY_USER" -- git -C "$target" rev-parse HEAD)" == "$target_commit" ]] || { echo "Target release commit mismatch" >&2; exit 2; }
[[ -f "$CUADRABOT_ROOT/manifests/$target_commit.env" ]] || { echo "Target has no immutable image manifest" >&2; exit 2; }
target_manifest="$CUADRABOT_ROOT/manifests/$target_commit.env"

echo "Rollback will atomically activate $target_commit and restart private services."
if [[ "$apply" != true ]]; then
  echo "Dry run complete. Add --apply after checking job activity."
  exit 0
fi

systemctl stop cuadrabot-worker.service >/dev/null 2>&1 || true
if /usr/bin/docker ps --format '{{.Names}}' | grep -q '^cuadrabot-takeoff-'; then
  echo "Refusing to interrupt an active processor; worker remains stopped" >&2
  exit 6
fi
systemctl stop cuadrabot-broker.service cuadrabot-egress.service >/dev/null 2>&1 || true
"$CUADRABOT_LIBEXEC/apply-image-manifest.sh" "$target_manifest" "$config_file"

current_target=""
if [[ -L "$CUADRABOT_RELEASE" ]]; then
  current_target="$(readlink -f -- "$CUADRABOT_RELEASE")"
  [[ "$current_target" == "$CUADRABOT_ROOT/releases/"* ]] || { echo "Current release escapes releases root" >&2; exit 2; }
fi
switch_link="$CUADRABOT_ROOT/.rollback-${target_commit}"
ln -s -- "$target" "$switch_link"
mv -Tf -- "$switch_link" "$CUADRABOT_RELEASE"
[[ -z "$current_target" ]] || ln -sfn -- "$current_target" "$CUADRABOT_ROOT/previous"

systemctl restart cuadrabot-egress.service cuadrabot-broker.service cuadrabot-worker.service
for _ in $(seq 1 30); do
  if systemctl is-active --quiet cuadrabot-egress.service \
    && systemctl is-active --quiet cuadrabot-broker.service \
    && systemctl is-active --quiet cuadrabot-worker.service \
    && curl --fail --silent http://127.0.0.1:8092/readyz >/dev/null \
    && curl --fail --silent http://127.0.0.1:8090/readyz >/dev/null; then
    echo "Rollback to $target_commit is ready."
    exit 0
  fi
  sleep 2
done
echo "Rollback target did not become ready; services remain in their observable failed state" >&2
exit 1
