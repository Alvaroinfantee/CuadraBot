#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF'
Usage: sudo bootstrap-host.sh --config /secure/path/host.env [--apply]

Default: inspect and print the exact operations. No packages, mounts, users,
or units are changed. --apply installs the host runtime. The configured block
device must already contain an ext4 filesystem with the expected label; this
script never formats a device.
EOF
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_dir="$(cd -- "$script_dir/.." && pwd -P)"
# shellcheck source=deploy/scripts/lib.sh
source "$script_dir/lib.sh"
config_file=""
apply=false

while (($#)); do
  case "$1" in
    --config)
      config_file="${2:-}"
      shift 2
      ;;
    --apply)
      apply=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "$config_file" && -f "$config_file" ]] || {
  echo "--config must name a readable host environment file" >&2
  exit 2
}

# shellcheck disable=SC1090
source "$config_file"
: "${CUADRABOT_ROOT:=/srv/cuadrabot}"
: "${CUADRABOT_RELEASE:=$CUADRABOT_ROOT/current}"
: "${CUADRABOT_DEPLOY_USER:=cuadrabot}"
: "${CUADRABOT_DEPLOY_UID:=10001}"
: "${CUADRABOT_DEPLOY_HOME:=/home/cuadrabot}"
: "${CUADRABOT_EXECUTOR_USER:=cuadraexec}"
: "${CUADRABOT_EXECUTOR_UID:=10002}"
: "${CUADRABOT_EXECUTOR_HOME:=/home/cuadraexec}"
: "${CUADRABOT_WORKER_USER:=cuadraworker}"
: "${CUADRABOT_WORKER_UID:=10003}"
: "${CUADRABOT_CRON_USER:=cuadracron}"
: "${CUADRABOT_CRON_UID:=10004}"
: "${CUADRABOT_LIBEXEC:=/usr/local/lib/cuadrabot}"
: "${CUADRABOT_HOST_PROFILE:=standard}"
: "${CUADRABOT_VOLUME_DEVICE:?CUADRABOT_VOLUME_DEVICE is required}"
: "${CUADRABOT_VOLUME_LABEL:=cuadrabot-prod}"

[[ "$CUADRABOT_ROOT" == /* && "$CUADRABOT_ROOT" != "/" ]] || { echo "CUADRABOT_ROOT must be a non-root absolute path" >&2; exit 2; }
[[ "$CUADRABOT_RELEASE" == "$CUADRABOT_ROOT/"* ]] || { echo "CUADRABOT_RELEASE must be inside CUADRABOT_ROOT" >&2; exit 2; }
[[ "$CUADRABOT_LIBEXEC" == /* && "$CUADRABOT_LIBEXEC" != "/" ]] || { echo "CUADRABOT_LIBEXEC must be a non-root absolute path" >&2; exit 2; }
for safe_path in "$CUADRABOT_ROOT" "$CUADRABOT_RELEASE" "$CUADRABOT_DEPLOY_HOME" "$CUADRABOT_EXECUTOR_HOME" "$CUADRABOT_LIBEXEC"; do
  [[ "$safe_path" =~ ^/[A-Za-z0-9._/-]+$ && "/$safe_path/" != *"/../"* ]] || { echo "Unsafe configurable path: $safe_path" >&2; exit 2; }
done
runtime_users=("$CUADRABOT_DEPLOY_USER" "$CUADRABOT_EXECUTOR_USER" "$CUADRABOT_WORKER_USER" "$CUADRABOT_CRON_USER")
runtime_uids=("$CUADRABOT_DEPLOY_UID" "$CUADRABOT_EXECUTOR_UID" "$CUADRABOT_WORKER_UID" "$CUADRABOT_CRON_UID")
for runtime_user in "${runtime_users[@]}"; do
  [[ "$runtime_user" =~ ^[a-z_][a-z0-9_-]{0,30}$ ]] || { echo "Invalid runtime user: $runtime_user" >&2; exit 2; }
done
for runtime_uid in "${runtime_uids[@]}"; do
  [[ "$runtime_uid" =~ ^[0-9]+$ && "$runtime_uid" -ge 1000 ]] || { echo "Invalid runtime UID: $runtime_uid" >&2; exit 2; }
done
[[ "$(printf '%s\n' "${runtime_users[@]}" | sort -u | wc -l)" -eq 4 ]] || { echo "Runtime users must be distinct" >&2; exit 2; }
[[ "$(printf '%s\n' "${runtime_uids[@]}" | sort -u | wc -l)" -eq 4 ]] || { echo "Runtime UIDs must be distinct" >&2; exit 2; }
[[ "$CUADRABOT_VOLUME_DEVICE" == /dev/disk/by-id/* ]] || { echo "Volume must use a stable /dev/disk/by-id path" >&2; exit 2; }
[[ "$CUADRABOT_VOLUME_LABEL" =~ ^[A-Za-z0-9._-]{1,16}$ ]] || { echo "Unsafe volume label" >&2; exit 2; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "bootstrap-host.sh must run as root (use sudo)" >&2
  exit 2
fi
[[ -r /etc/os-release ]] || { echo "Cannot identify OS" >&2; exit 2; }
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == "24.04" ]] || {
  echo "Ubuntu 24.04 LTS is required" >&2
  exit 2
}
[[ "$(uname -m)" == x86_64 ]] || { echo "This pinned bootstrap currently supports x86_64 only" >&2; exit 2; }
memory_kib="$(awk '/MemTotal:/ {print $2}' /proc/meminfo)"
case "$CUADRABOT_HOST_PROFILE" in
  standard)
    [[ "$(nproc)" -ge 8 ]] || { echo "The standard profile requires at least 8 vCPU" >&2; exit 2; }
    [[ "$memory_kib" -ge 15000000 ]] || { echo "The standard profile requires 16 GiB-class RAM" >&2; exit 2; }
    ;;
  budget)
    [[ "$(nproc)" -ge 1 ]] || { echo "The budget profile requires at least 1 vCPU" >&2; exit 2; }
    [[ "$memory_kib" -ge 1800000 ]] || { echo "The budget profile requires 2 GiB-class RAM" >&2; exit 2; }
    ;;
  *)
    echo "CUADRABOT_HOST_PROFILE must be standard or budget" >&2
    exit 2
    ;;
esac
[[ -z "$(swapon --show --noheadings)" ]] || { echo "Host swap is not approved for either executor profile" >&2; exit 2; }
for index in "${!runtime_users[@]}"; do
  runtime_user="${runtime_users[$index]}"
  runtime_uid="${runtime_uids[$index]}"
  id "$runtime_user" >/dev/null || { echo "Cloud-init user $runtime_user is missing" >&2; exit 2; }
  [[ "$(id -u "$runtime_user")" == "$runtime_uid" ]] || { echo "Unexpected UID for $runtime_user" >&2; exit 2; }
done

[[ -e "$CUADRABOT_VOLUME_DEVICE" ]] || { echo "Configured Block Storage device is not attached: $CUADRABOT_VOLUME_DEVICE" >&2; exit 2; }
resolved_device="$(readlink -f -- "$CUADRABOT_VOLUME_DEVICE")"
[[ "$resolved_device" == /dev/* && -b "$resolved_device" ]] || { echo "Volume device did not resolve to a block device" >&2; exit 2; }
[[ "$(blkid -s TYPE -o value "$resolved_device")" == ext4 ]] || { echo "Volume must already be formatted ext4; refusing to format it" >&2; exit 2; }
[[ "$(blkid -s LABEL -o value "$resolved_device")" == "$CUADRABOT_VOLUME_LABEL" ]] || { echo "Volume filesystem label mismatch" >&2; exit 2; }
volume_uuid="$(blkid -s UUID -o value "$resolved_device")"
[[ -n "$volume_uuid" ]] || { echo "Volume has no filesystem UUID" >&2; exit 2; }
mounted_target="$(findmnt -nr -S "$resolved_device" -o TARGET | head -n 1 || true)"
if [[ -n "$mounted_target" && "$mounted_target" != "$CUADRABOT_ROOT" && "$mounted_target" != /mnt/* ]]; then
  echo "Volume is mounted at unexpected target $mounted_target; refusing to move it" >&2
  exit 2
fi
if [[ -z "$mounted_target" && -d "$CUADRABOT_ROOT" && -n "$(find "$CUADRABOT_ROOT" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "$CUADRABOT_ROOT is nonempty and not the configured volume mount" >&2
  exit 2
fi

cat <<EOF
CuadraBot host bootstrap plan
  host profile:  $CUADRABOT_HOST_PROFILE
  deploy user:   $CUADRABOT_DEPLOY_USER (uid $CUADRABOT_DEPLOY_UID)
  executor user: $CUADRABOT_EXECUTOR_USER (uid $CUADRABOT_EXECUTOR_UID, rootless Docker)
  worker user:   $CUADRABOT_WORKER_USER (uid $CUADRABOT_WORKER_UID)
  cron user:     $CUADRABOT_CRON_USER (uid $CUADRABOT_CRON_UID)
  volume:        $resolved_device UUID=$volume_uuid label=$CUADRABOT_VOLUME_LABEL
  mount:         ${mounted_target:-unmounted} -> $CUADRABOT_ROOT
  node:          v22.23.2 (official archive, pinned SHA-256)
  Docker:        official apt packages, rootless user service, cgroup v2
  Docker data:   $CUADRABOT_ROOT/docker
  app units:     installed but disabled
  host swap:     none
EOF

if [[ "$apply" != true ]]; then
  echo "Dry run complete. Add --apply after reviewing the exact device and paths."
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl dbus-user-session fuse-overlayfs git gnupg jq \
  restic slirp4netns uidmap xz-utils

if [[ -n "$mounted_target" && "$mounted_target" != "$CUADRABOT_ROOT" ]]; then
  [[ "$mounted_target" == /mnt/* ]] || { echo "Unsafe existing mount target" >&2; exit 2; }
  existing_mount_unit="$(systemd-escape --path --suffix=mount "$mounted_target")"
  existing_mount_unit_path="/etc/systemd/system/$existing_mount_unit"
  if [[ -e "$existing_mount_unit_path" || -L "$existing_mount_unit_path" ]]; then
    [[ "$(findmnt -nr -T "$mounted_target" -o SOURCE)" == "$resolved_device" ]] || {
      echo "Refusing to remove a mount unit that does not target the verified volume" >&2
      exit 2
    }
    systemctl disable --now "$existing_mount_unit" >/dev/null 2>&1 || true
    rm -f -- "$existing_mount_unit_path"
    systemctl daemon-reload
  fi
  mountpoint -q "$mounted_target" && umount -- "$mounted_target"
fi

mkdir -p -- "$CUADRABOT_ROOT"
fstab_tmp="$(mktemp)"
trap 'rm -f -- "$fstab_tmp"' EXIT
filter_fstab_for_device /etc/fstab "$resolved_device" > "$fstab_tmp"
printf 'UUID=%s %s ext4 defaults,nodev,nosuid 0 2\n' "$volume_uuid" "$CUADRABOT_ROOT" >> "$fstab_tmp"
install -o root -g root -m 0644 "$fstab_tmp" /etc/fstab
systemctl daemon-reload
mountpoint -q "$CUADRABOT_ROOT" || mount -- "$CUADRABOT_ROOT"
[[ "$(findmnt -nr -T "$CUADRABOT_ROOT" -o SOURCE)" == "$resolved_device" ]] || {
  echo "Mounted source does not match the verified volume" >&2
  exit 2
}
mapfile -t volume_mount_targets < <(findmnt -rn -S "$resolved_device" -o TARGET | sort -u)
if [[ "${#volume_mount_targets[@]}" -ne 1 || "${volume_mount_targets[0]}" != "$CUADRABOT_ROOT" ]]; then
  echo "Verified volume must have exactly one mount target at $CUADRABOT_ROOT" >&2
  exit 2
fi

install -d -o root -g root -m 0755 "$CUADRABOT_ROOT"
install -d -o "$CUADRABOT_DEPLOY_USER" -g "$CUADRABOT_DEPLOY_USER" -m 0755 \
  "$CUADRABOT_ROOT/releases" \
  "$CUADRABOT_ROOT/manifests"
install -d -o "$CUADRABOT_EXECUTOR_USER" -g "$CUADRABOT_EXECUTOR_USER" -m 0700 \
  "$CUADRABOT_ROOT/docker" \
  "$CUADRABOT_ROOT/executor" \
  "$CUADRABOT_ROOT/executor/state" \
  "$CUADRABOT_ROOT/executor/docker-config"
install -d -o "$CUADRABOT_WORKER_USER" -g "$CUADRABOT_WORKER_USER" -m 0700 \
  "$CUADRABOT_ROOT/worker-jobs"
install -d -o root -g root -m 0700 \
  "$CUADRABOT_ROOT/secrets" \
  "$CUADRABOT_ROOT/restore"

node_version="22.23.2"
node_archive="node-v${node_version}-linux-x64.tar.xz"
node_sha256="d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307"
node_dir="/opt/node-v${node_version}-linux-x64"
if [[ ! -x "$node_dir/bin/node" ]]; then
  node_tmp="$(mktemp)"
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    "https://nodejs.org/dist/v${node_version}/${node_archive}" \
    --output "$node_tmp"
  printf '%s  %s\n' "$node_sha256" "$node_tmp" | sha256sum --check --status
  tar -xJf "$node_tmp" -C /opt
  rm -f -- "$node_tmp"
fi
[[ "$($node_dir/bin/node --version)" == "v${node_version}" ]] || { echo "Pinned Node validation failed" >&2; exit 2; }
ln -sfn -- "$node_dir/bin/node" /usr/local/bin/node
ln -sfn -- "$node_dir/bin/npm" /usr/local/bin/npm
ln -sfn -- "$node_dir/bin/npx" /usr/local/bin/npx
ln -sfn -- "$node_dir/bin/corepack" /usr/local/bin/corepack

install -d -o root -g root -m 0755 /etc/apt/keyrings
docker_key_tmp="$(mktemp)"
curl --fail --silent --show-error --location \
  --proto '=https' --tlsv1.2 \
  https://download.docker.com/linux/ubuntu/gpg \
  --output "$docker_key_tmp"
docker_fingerprint="$(gpg --show-keys --with-colons "$docker_key_tmp" | awk -F: '$1 == "fpr" {print $10; exit}')"
[[ "$docker_fingerprint" == "9DC858229FC7DD38854AE2D88D81803C0EBFCD88" ]] || {
  echo "Docker apt signing-key fingerprint mismatch" >&2
  exit 2
}
install -o root -g root -m 0644 "$docker_key_tmp" /etc/apt/keyrings/docker.asc
rm -f -- "$docker_key_tmp"
architecture="$(dpkg --print-architecture)"
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
  "$architecture" "${UBUNTU_CODENAME:-noble}" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-ce-rootless-extras
systemctl disable --now docker.service docker.socket >/dev/null 2>&1 || true
rm -f -- /var/run/docker.sock

ensure_subid() {
  local file="$1" option="$2"
  if grep -q "^${CUADRABOT_EXECUTOR_USER}:" "$file"; then
    return
  fi
  local start end
  start="$(python3 - "$file" <<'PY'
from pathlib import Path
import sys

ranges = []
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    parts = line.split(":")
    if len(parts) != 3:
        continue
    try:
        start, count = int(parts[1]), int(parts[2])
    except ValueError:
        continue
    ranges.append((start, start + count - 1))
candidate = 200000
while any(not (candidate + 65535 < low or candidate > high) for low, high in ranges):
    candidate += 65536
print(candidate)
PY
)"
  end="$((start + 65535))"
  usermod "$option" "${start}-${end}" "$CUADRABOT_EXECUTOR_USER"
}
ensure_subid /etc/subuid --add-subuids
ensure_subid /etc/subgid --add-subgids

install -d -o root -g root -m 0755 /etc/systemd/system/user@.service.d
printf '[Service]\nDelegate=cpu cpuset io memory pids\n' \
  > /etc/systemd/system/user@.service.d/delegate.conf
executor_user_dropin="/etc/systemd/system/user@${CUADRABOT_EXECUTOR_UID}.service.d"
install -d -o root -g root -m 0755 "$executor_user_dropin"
printf '[Unit]\nRequiresMountsFor=%s\nAfter=local-fs.target\n' "$CUADRABOT_ROOT" \
  > "$executor_user_dropin/cuadrabot-volume.conf"
chown root:root "$executor_user_dropin/cuadrabot-volume.conf"
chmod 0644 "$executor_user_dropin/cuadrabot-volume.conf"
systemctl daemon-reload
loginctl enable-linger "$CUADRABOT_EXECUTOR_USER"
systemctl start "user@${CUADRABOT_EXECUTOR_UID}.service"
controller_file="/sys/fs/cgroup/user.slice/user-${CUADRABOT_EXECUTOR_UID}.slice/user@${CUADRABOT_EXECUTOR_UID}.service/cgroup.controllers"
controllers="$(cat "$controller_file" 2>/dev/null || true)"
for required_controller in cpu io memory pids; do
  [[ " $controllers " == *" $required_controller "* ]] || {
    echo "cgroup controller $required_controller is not delegated; reboot once and rerun bootstrap" >&2
    exit 2
  }
done

install -d -o "$CUADRABOT_EXECUTOR_USER" -g "$CUADRABOT_EXECUTOR_USER" -m 0700 \
  "$CUADRABOT_EXECUTOR_HOME/.config" "$CUADRABOT_EXECUTOR_HOME/.config/docker"
printf '{\n  "data-root": "%s/docker",\n  "log-driver": "local",\n  "log-opts": {"max-size": "20m", "max-file": "5"},\n  "no-new-privileges": true\n}\n' \
  "$CUADRABOT_ROOT" > "$CUADRABOT_EXECUTOR_HOME/.config/docker/daemon.json"
chown "$CUADRABOT_EXECUTOR_USER:$CUADRABOT_EXECUTOR_USER" "$CUADRABOT_EXECUTOR_HOME/.config/docker/daemon.json"
chmod 0600 "$CUADRABOT_EXECUTOR_HOME/.config/docker/daemon.json"

user_env=(
  HOME="$CUADRABOT_EXECUTOR_HOME"
  XDG_RUNTIME_DIR="/run/user/$CUADRABOT_EXECUTOR_UID"
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$CUADRABOT_EXECUTOR_UID/bus"
  PATH="/usr/local/bin:/usr/bin:/bin"
)
if [[ ! -f "$CUADRABOT_EXECUTOR_HOME/.config/systemd/user/docker.service" ]]; then
  runuser -u "$CUADRABOT_EXECUTOR_USER" -- env "${user_env[@]}" \
    dockerd-rootless-setuptool.sh install
fi
runuser -u "$CUADRABOT_EXECUTOR_USER" -- env "${user_env[@]}" \
  systemctl --user enable --now docker.service

export DOCKER_HOST="unix:///run/user/$CUADRABOT_EXECUTOR_UID/docker.sock"
bash "$script_dir/wait-for-docker.sh"
egress_network="${EXECUTOR_EGRESS_NETWORK:-cuadrabot-egress}"
docker network inspect "$egress_network" >/dev/null 2>&1 || \
  docker network create --driver bridge --label com.cuadrabot.role=egress "$egress_network" >/dev/null

install -d -o root -g root -m 0755 "$CUADRABOT_LIBEXEC"
for runtime_script in \
  lib.sh wait-for-docker.sh preflight-component.sh stage-egress-env.sh run-component.sh \
  run-egress.sh stop-egress.sh cron-call.sh backup.sh restore.sh \
  apply-image-manifest.sh deploy-release.sh validate-host.sh rollback.sh; do
  install -o root -g root -m 0755 "$deploy_dir/scripts/$runtime_script" \
    "$CUADRABOT_LIBEXEC/$runtime_script"
done

install -o root -g root -m 0600 \
  "$config_file" "$CUADRABOT_ROOT/secrets/host.env"
for example in worker broker egress cron backup; do
  install -o root -g root -m 0600 \
    "$deploy_dir/config/${example}.env.example" \
    "$CUADRABOT_ROOT/secrets/${example}.env.example"
done

render_unit() {
  local source="$1" target="$2"
  sed \
    -e "s|@@CUADRABOT_ROOT@@|$CUADRABOT_ROOT|g" \
    -e "s|@@DEPLOY_USER@@|$CUADRABOT_DEPLOY_USER|g" \
    -e "s|@@DEPLOY_UID@@|$CUADRABOT_DEPLOY_UID|g" \
    -e "s|@@DEPLOY_HOME@@|$CUADRABOT_DEPLOY_HOME|g" \
    -e "s|@@EXECUTOR_USER@@|$CUADRABOT_EXECUTOR_USER|g" \
    -e "s|@@EXECUTOR_UID@@|$CUADRABOT_EXECUTOR_UID|g" \
    -e "s|@@EXECUTOR_HOME@@|$CUADRABOT_EXECUTOR_HOME|g" \
    -e "s|@@WORKER_USER@@|$CUADRABOT_WORKER_USER|g" \
    -e "s|@@WORKER_UID@@|$CUADRABOT_WORKER_UID|g" \
    -e "s|@@CRON_USER@@|$CUADRABOT_CRON_USER|g" \
    -e "s|@@CRON_UID@@|$CUADRABOT_CRON_UID|g" \
    -e "s|@@CUADRABOT_LIBEXEC@@|$CUADRABOT_LIBEXEC|g" \
    "$source" > "$target"
  chmod 0644 "$target"
  chown root:root "$target"
}
for unit in "$deploy_dir"/systemd/*; do
  render_unit "$unit" "/etc/systemd/system/$(basename -- "$unit")"
done
systemctl daemon-reload

echo "Bootstrap complete. Application services remain disabled."
echo "Populate $CUADRABOT_ROOT/secrets/*.env, deploy an exact release, then run validate-host.sh."
