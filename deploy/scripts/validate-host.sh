#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

mode=full
config_file=""
while (($#)); do
  case "$1" in
    --preflight) mode=preflight; shift ;;
    --config) config_file="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: sudo validate-host.sh [--preflight] [--config host.env]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || { echo "Run with sudo" >&2; exit 2; }
: "${config_file:=/srv/cuadrabot/secrets/host.env}"
[[ -f "$config_file" ]] || { echo "Host config missing" >&2; exit 2; }
# shellcheck disable=SC1090
source "$config_file"
: "${CUADRABOT_ROOT:=/srv/cuadrabot}"
: "${CUADRABOT_RELEASE:=$CUADRABOT_ROOT/current}"
: "${CUADRABOT_DEPLOY_USER:=cuadrabot}"
: "${CUADRABOT_DEPLOY_UID:=10001}"
: "${CUADRABOT_EXECUTOR_USER:=cuadraexec}"
: "${CUADRABOT_EXECUTOR_UID:=10002}"
: "${CUADRABOT_WORKER_USER:=cuadraworker}"
: "${CUADRABOT_WORKER_UID:=10003}"
: "${CUADRABOT_CRON_USER:=cuadracron}"
: "${CUADRABOT_CRON_UID:=10004}"
: "${CUADRABOT_LIBEXEC:=/usr/local/lib/cuadrabot}"
: "${CUADRABOT_HOST_PROFILE:=standard}"
: "${CUADRABOT_VOLUME_DEVICE:?CUADRABOT_VOLUME_DEVICE is required}"
: "${CUADRABOT_VOLUME_LABEL:?CUADRABOT_VOLUME_LABEL is required}"
: "${ADMIN_SSH_CIDR:=}"
export DOCKER_HOST="unix:///run/user/$CUADRABOT_EXECUTOR_UID/docker.sock"

# shellcheck source=deploy/scripts/lib.sh
source "$CUADRABOT_LIBEXEC/lib.sh"
failures=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*" >&2; failures=$((failures + 1)); }
check() { if "$@"; then pass "$*"; else fail "$*"; fi; }

check_dir() {
  local path="$1" owner="$2" group="$3" mode="$4"
  [[ -d "$path" && ! -L "$path" && "$(stat -c '%U:%G:%a' "$path")" == "$owner:$group:$mode" ]]
}

case "$CUADRABOT_HOST_PROFILE" in
  standard)
    expected_min_cpus=8
    expected_min_memory_kib=15000000
    expected_processor_memory=6g
    expected_processor_memory_bytes=6442450944
    expected_processor_cpus=2
    expected_processor_nano_cpus=2000000000
    expected_processor_pids=256
    expected_processor_tmpfs=512m
    expected_egress_memory=512m
    expected_egress_memory_bytes=536870912
    expected_egress_cpus=0.5
    expected_egress_pids=128
    ;;
  budget)
    expected_min_cpus=1
    expected_min_memory_kib=1800000
    expected_processor_memory=1g
    expected_processor_memory_bytes=1073741824
    expected_processor_cpus=1
    expected_processor_nano_cpus=1000000000
    expected_processor_pids=128
    expected_processor_tmpfs=128m
    expected_egress_memory=256m
    expected_egress_memory_bytes=268435456
    expected_egress_cpus=0.25
    expected_egress_pids=96
    ;;
  *)
    fail "CUADRABOT_HOST_PROFILE must be standard or budget"
    expected_min_cpus=999
    expected_min_memory_kib=999999999
    expected_processor_memory=invalid
    expected_processor_memory_bytes=-1
    expected_processor_cpus=-1
    expected_processor_nano_cpus=-1
    expected_processor_pids=-1
    expected_processor_tmpfs=invalid
    expected_egress_memory=invalid
    expected_egress_memory_bytes=-1
    expected_egress_cpus=-1
    expected_egress_pids=-1
    ;;
esac

[[ "$(nproc)" -ge "$expected_min_cpus" ]] && pass "$CUADRABOT_HOST_PROFILE profile CPU floor" || fail "host has insufficient CPU for $CUADRABOT_HOST_PROFILE profile"
memory_kib="$(awk '/MemTotal:/ {print $2}' /proc/meminfo)"
[[ "$memory_kib" -ge "$expected_min_memory_kib" ]] && pass "$CUADRABOT_HOST_PROFILE profile RAM floor" || fail "host has insufficient RAM for $CUADRABOT_HOST_PROFILE profile"
[[ -z "$(swapon --show --noheadings)" ]] && pass "host swap disabled" || fail "unexpected host swap enabled"
[[ "${DO_VOLUME_ENCRYPTION_AT_REST_CONFIRMED:-false}" == true ]] \
  && pass "operator recorded DigitalOcean volume encryption control" \
  || fail "DO_VOLUME_ENCRYPTION_AT_REST_CONFIRMED is not true"
ssh_cidr_valid=false
if [[ "${ADMIN_SSH_CIDR:-}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/(3[0-2]|[12]?[0-9])$ ]]; then
  IFS=. read -r octet1 octet2 octet3 octet4 <<<"${ADMIN_SSH_CIDR%/*}"
  ((10#$octet1 <= 255 && 10#$octet2 <= 255 && 10#$octet3 <= 255 && 10#$octet4 <= 255)) && ssh_cidr_valid=true
fi
[[ "$ssh_cidr_valid" == true ]] && pass "operator SSH CIDR is configured" || fail "ADMIN_SSH_CIDR must be one IPv4 CIDR"
[[ "${DO_CLOUD_FIREWALL_SSH_ONLY_CONFIRMED:-false}" == true ]] \
  && pass "operator recorded DigitalOcean Cloud Firewall control" \
  || fail "DO_CLOUD_FIREWALL_SSH_ONLY_CONFIRMED is not true"

resolved_device="$(readlink -f -- "$CUADRABOT_VOLUME_DEVICE" 2>/dev/null || true)"
[[ -b "$resolved_device" ]] && pass "Block Storage device resolves" || fail "Block Storage device missing"
[[ "$(findmnt -nr -T "$CUADRABOT_ROOT" -o SOURCE 2>/dev/null || true)" == "$resolved_device" ]] \
  && pass "persistent root is the exact attached volume" || fail "persistent root is not the configured volume"
mapfile -t volume_mount_targets < <(findmnt -rn -S "$resolved_device" -o TARGET 2>/dev/null | sort -u)
[[ "${#volume_mount_targets[@]}" -eq 1 && "${volume_mount_targets[0]:-}" == "$CUADRABOT_ROOT" ]] \
  && pass "attached volume has exactly one mount target" || fail "attached volume has duplicate or unexpected mount targets"
[[ "$(findmnt -nr -T "$CUADRABOT_ROOT" -o FSTYPE 2>/dev/null || true)" == ext4 ]] \
  && pass "volume filesystem is ext4" || fail "volume filesystem is not ext4"
mount_options="$(findmnt -nr -T "$CUADRABOT_ROOT" -o OPTIONS 2>/dev/null || true)"
[[ ",$mount_options," == *,nodev,* && ",$mount_options," == *,nosuid,* ]] \
  && pass "volume has nodev,nosuid" || fail "volume lacks nodev,nosuid"
[[ "$(blkid -s LABEL -o value "$resolved_device" 2>/dev/null || true)" == "$CUADRABOT_VOLUME_LABEL" ]] \
  && pass "volume label matches" || fail "volume label mismatch"

runtime_users=("$CUADRABOT_DEPLOY_USER" "$CUADRABOT_EXECUTOR_USER" "$CUADRABOT_WORKER_USER" "$CUADRABOT_CRON_USER")
runtime_uids=("$CUADRABOT_DEPLOY_UID" "$CUADRABOT_EXECUTOR_UID" "$CUADRABOT_WORKER_UID" "$CUADRABOT_CRON_UID")
[[ "$(printf '%s\n' "${runtime_users[@]}" | sort -u | wc -l)" -eq 4 ]] \
  && [[ "$(printf '%s\n' "${runtime_uids[@]}" | sort -u | wc -l)" -eq 4 ]] \
  && pass "runtime identities are distinct" || fail "runtime identities are not distinct"
for index in "${!runtime_users[@]}"; do
  runtime_user="${runtime_users[$index]}"
  runtime_uid="${runtime_uids[$index]}"
  [[ "$(id -u "$runtime_user" 2>/dev/null || true)" == "$runtime_uid" ]] \
    && pass "$runtime_user has expected UID" || fail "$runtime_user UID mismatch"
done

check_dir "$CUADRABOT_ROOT" root root 755 && pass "persistent root ownership" || fail "persistent root ownership/mode mismatch"
check_dir "$CUADRABOT_ROOT/secrets" root root 700 && pass "secret directory ownership" || fail "secret directory ownership/mode mismatch"
check_docker_data_dir "$CUADRABOT_ROOT/docker" "$CUADRABOT_EXECUTOR_USER" "$CUADRABOT_EXECUTOR_USER" \
  && pass "Docker data ownership" || fail "Docker data ownership/mode mismatch"
check_dir "$CUADRABOT_ROOT/executor" "$CUADRABOT_EXECUTOR_USER" "$CUADRABOT_EXECUTOR_USER" 700 \
  && pass "executor state ownership" || fail "executor state ownership/mode mismatch"
check_dir "$CUADRABOT_ROOT/worker-jobs" "$CUADRABOT_WORKER_USER" "$CUADRABOT_WORKER_USER" 700 \
  && pass "worker job ownership" || fail "worker job ownership/mode mismatch"

resolved_release="$(readlink -f -- "$CUADRABOT_RELEASE" 2>/dev/null || true)"
if [[ -L "$CUADRABOT_RELEASE" && "$resolved_release" == "$CUADRABOT_ROOT/releases/"* ]]; then
  pass "current release symlink is contained"
  runuser -u "$CUADRABOT_WORKER_USER" -- test -r "$resolved_release/worker/src/index.ts" \
    && pass "worker can read its release entrypoint" || fail "worker cannot read its release entrypoint"
  runuser -u "$CUADRABOT_EXECUTOR_USER" -- test -r "$resolved_release/executor/src/broker-main.mjs" \
    && pass "executor can read its release entrypoint" || fail "executor cannot read its release entrypoint"
  runuser -u "$CUADRABOT_WORKER_USER" -- test ! -w "$resolved_release" \
    && pass "worker cannot write the release" || fail "worker can write the release"
  runuser -u "$CUADRABOT_EXECUTOR_USER" -- test ! -w "$resolved_release" \
    && pass "executor cannot write the release" || fail "executor can write the release"
elif [[ "$mode" == preflight && ! -e "$CUADRABOT_RELEASE" ]]; then
  pass "no release is active during initial preflight"
else
  fail "current release symlink is missing or escapes releases"
fi

require_exact_file_mode "$CUADRABOT_ROOT/secrets/host.env" root 600 root
for env_name in worker broker egress cron; do
  require_exact_file_mode "$CUADRABOT_ROOT/secrets/$env_name.env" root 600 root
done
pass "runtime secret ownership and modes"

for untrusted_user in "$CUADRABOT_WORKER_USER" "$CUADRABOT_CRON_USER"; do
  for forbidden_env in host broker egress; do
    if runuser -u "$untrusted_user" -- test -r "$CUADRABOT_ROOT/secrets/$forbidden_env.env"; then
      fail "$untrusted_user can read $forbidden_env.env"
    else
      pass "$untrusted_user cannot read $forbidden_env.env"
    fi
  done
  if runuser -u "$untrusted_user" -- test -x "$CUADRABOT_ROOT/secrets"; then
    fail "$untrusted_user can traverse the secret directory"
  else
    pass "$untrusted_user cannot traverse the secret directory"
  fi
done
docker_socket="/run/user/$CUADRABOT_EXECUTOR_UID/docker.sock"
[[ -S "$docker_socket" ]] && pass "rootless Docker socket exists" || fail "rootless Docker socket missing"
[[ "$(stat -c '%u' "$docker_socket" 2>/dev/null || true)" == "$CUADRABOT_EXECUTOR_UID" ]] \
  && pass "Docker socket belongs to executor UID" || fail "Docker socket owner mismatch"
for untrusted_user in "$CUADRABOT_WORKER_USER" "$CUADRABOT_CRON_USER"; do
  if runuser -u "$untrusted_user" -- env DOCKER_HOST="unix://$docker_socket" /usr/bin/docker info >/dev/null 2>&1; then
    fail "$untrusted_user can control the executor Docker daemon"
  else
    pass "$untrusted_user cannot control the executor Docker daemon"
  fi
done

worker_broker_token="$(sed -n 's/^TAKEOFF_SERVICE_API_TOKEN=//p' "$CUADRABOT_ROOT/secrets/worker.env" | tail -n1)"
broker_token="$(sed -n 's/^EXECUTOR_BROKER_TOKEN=//p' "$CUADRABOT_ROOT/secrets/broker.env" | tail -n1)"
broker_egress_token="$(sed -n 's/^EXECUTOR_EGRESS_CONTROL_TOKEN=//p' "$CUADRABOT_ROOT/secrets/broker.env" | tail -n1)"
egress_token="$(sed -n 's/^EGRESS_CONTROL_TOKEN=//p' "$CUADRABOT_ROOT/secrets/egress.env" | tail -n1)"
[[ -n "$worker_broker_token" && "$worker_broker_token" == "$broker_token" ]] \
  && pass "worker and broker tokens agree" || fail "worker and broker tokens differ"
[[ -n "$broker_egress_token" && "$broker_egress_token" == "$egress_token" ]] \
  && pass "broker and egress control tokens agree" || fail "broker and egress control tokens differ"
if grep -Eq '^(CODEX_API_KEY|OPENAI_API_KEY)=' "$CUADRABOT_ROOT/secrets/worker.env" "$CUADRABOT_ROOT/secrets/broker.env"; then
  fail "master model credential appears outside egress.env"
else
  pass "worker and broker have no master model credential"
fi

is_image_digest "${EXECUTOR_IMAGE:-}" && pass "egress image uses repository digest" || fail "egress image is not digest-pinned"
is_image_digest "${EXECUTOR_PROCESSOR_IMAGE:-}" && pass "processor image uses repository digest" || fail "processor image is not digest-pinned"
[[ "${EXECUTOR_PROCESSOR_MEMORY:-}" == "$expected_processor_memory" && "${EXECUTOR_PROCESSOR_MEMORY_SWAP:-}" == "$expected_processor_memory" ]] \
  && pass "processor memory and memory+swap match $CUADRABOT_HOST_PROFILE profile" || fail "processor memory profile or swap prohibition is not configured"
[[ "${EXECUTOR_PROCESSOR_CPUS:-}" == "$expected_processor_cpus" && "${EXECUTOR_PROCESSOR_PIDS:-}" == "$expected_processor_pids" && "${EXECUTOR_PROCESSOR_TMPFS:-}" == "$expected_processor_tmpfs" ]] \
  && pass "processor CPU, PID, and tmpfs limits match $CUADRABOT_HOST_PROFILE profile" || fail "processor resource profile mismatch"
[[ "${EXECUTOR_EGRESS_MEMORY:-}" == "$expected_egress_memory" && "${EXECUTOR_EGRESS_MEMORY_SWAP:-}" == "$expected_egress_memory" && "${EXECUTOR_EGRESS_CPUS:-}" == "$expected_egress_cpus" && "${EXECUTOR_EGRESS_PIDS:-}" == "$expected_egress_pids" ]] \
  && pass "egress limits match $CUADRABOT_HOST_PROFILE profile" || fail "egress resource profile mismatch"
[[ "${EXECUTOR_MAX_CONCURRENT_JOBS:-}" == 1 ]] \
  && pass "single-job concurrency" || fail "concurrency is not one"

"$CUADRABOT_LIBEXEC/wait-for-docker.sh" && pass "rootless Docker with systemd cgroups" || fail "rootless Docker validation"
docker_root="$(/usr/bin/docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
[[ "$docker_root" == "$CUADRABOT_ROOT/docker" ]] && pass "Docker data is on encrypted volume" || fail "Docker data root mismatch: $docker_root"
controller_file="/sys/fs/cgroup/user.slice/user-${CUADRABOT_EXECUTOR_UID}.slice/user@${CUADRABOT_EXECUTOR_UID}.service/cgroup.controllers"
controllers="$(cat "$controller_file" 2>/dev/null || true)"
for controller in cpu io memory pids; do
  [[ " $controllers " == *" $controller "* ]] || fail "cgroup controller not delegated: $controller"
done
[[ "$controllers" == *memory* && "$controllers" == *pids* ]] && pass "required cgroup controllers delegated"

declare -A expected_unit_users=(
  [cuadrabot-worker.service]="$CUADRABOT_WORKER_USER"
  [cuadrabot-broker.service]="$CUADRABOT_EXECUTOR_USER"
  [cuadrabot-egress.service]="$CUADRABOT_EXECUTOR_USER"
  [cuadrabot-reconcile.service]="$CUADRABOT_CRON_USER"
  [cuadrabot-retention.service]="$CUADRABOT_CRON_USER"
  [cuadrabot-archive-integrity.service]="$CUADRABOT_CRON_USER"
)
for unit in "${!expected_unit_users[@]}"; do
  expected_user="${expected_unit_users[$unit]}"
  [[ "$(systemctl show "$unit" -p User --value 2>/dev/null || true)" == "$expected_user" ]] \
    && pass "$unit uses $expected_user" || fail "$unit identity mismatch"
  [[ "$(systemctl show "$unit" -p ProtectProc --value 2>/dev/null || true)" == invisible ]] \
    && [[ "$(systemctl show "$unit" -p ProcSubset --value 2>/dev/null || true)" == pid ]] \
    && pass "$unit hides foreign processes" || fail "$unit process visibility hardening mismatch"
done
worker_unit_text="$(systemctl cat cuadrabot-worker.service 2>/dev/null || true)"
if grep -Eq '^EnvironmentFile=.*secrets/(host|broker|egress)\.env|^Environment=(DOCKER_HOST|XDG_RUNTIME_DIR)=' <<<"$worker_unit_text"; then
  fail "worker unit references executor configuration or secrets"
else
  pass "worker unit receives only worker configuration"
fi

ufw_status="$(LC_ALL=C ufw status verbose)"
if head -n1 <<<"$ufw_status" | grep -q '^Status: active'; then
  pass "UFW active"
else
  fail "UFW inactive"
fi
if ufw_default_denies_incoming <<<"$ufw_status"; then
  pass "UFW default incoming policy is deny"
else
  fail "UFW default incoming policy is not deny"
fi
mapfile -t ufw_inbound_rules < <(parse_ufw_inbound_permit_rules <<<"$ufw_status")
expected_ufw_source="$ADMIN_SSH_CIDR"
[[ "$expected_ufw_source" == */32 ]] && expected_ufw_source="${expected_ufw_source%/32}"
if [[ "${#ufw_inbound_rules[@]}" -eq 1 && "${ufw_inbound_rules[0]}" == "ALLOW 22/tcp $expected_ufw_source" ]]; then
  pass "UFW permits SSH only from the exact admin CIDR"
else
  fail "UFW inbound policy differs from SSH-only admin CIDR"
fi

listener_failures_before="$failures"
while read -r endpoint; do
  [[ -n "$endpoint" ]] || continue
  port="${endpoint##*:}"
  address="${endpoint%:*}"
  address="${address#[}"
  address="${address%]}"
  case "$address" in
    127.*|::1) continue ;;
  esac
  [[ "$port" == 22 ]] || fail "non-loopback listener found: $endpoint"
done < <(ss -H -ltn | awk '{print $4}')
[[ "$failures" -eq "$listener_failures_before" ]] && pass "no public application listeners"
if ss -H -ltn | awk '{print $4}' | grep -Eq '(^|\]|:|\.)8091$'; then
  fail "egress data port 8091 is published on the host"
else
  pass "egress data port is not host-published"
fi

if [[ "$mode" == full ]]; then
  for unit in cuadrabot-egress.service cuadrabot-broker.service cuadrabot-worker.service; do
    systemctl is-active --quiet "$unit" && pass "$unit active" || fail "$unit inactive"
  done
  for unit_and_uid in \
    "cuadrabot-egress.service:$CUADRABOT_EXECUTOR_UID" \
    "cuadrabot-broker.service:$CUADRABOT_EXECUTOR_UID" \
    "cuadrabot-worker.service:$CUADRABOT_WORKER_UID"; do
    unit="${unit_and_uid%%:*}"
    expected_uid="${unit_and_uid##*:}"
    main_pid="$(systemctl show "$unit" -p MainPID --value 2>/dev/null || true)"
    [[ "$main_pid" =~ ^[1-9][0-9]*$ && "$(stat -c '%u' "/proc/$main_pid" 2>/dev/null || true)" == "$expected_uid" ]] \
      && pass "$unit MainPID uses UID $expected_uid" || fail "$unit MainPID identity mismatch"
  done
  require_exact_file_mode /run/cuadrabot-executor/egress.env "$CUADRABOT_EXECUTOR_USER" 600 "$CUADRABOT_EXECUTOR_USER"
  pass "egress secret is staged only for the trusted executor UID"
  for timer in cuadrabot-reconcile.timer cuadrabot-retention.timer cuadrabot-archive-integrity.timer; do
    systemctl is-enabled --quiet "$timer" && systemctl is-active --quiet "$timer" \
      && pass "$timer enabled and active" || fail "$timer not enabled/active"
  done
  curl --fail --silent http://127.0.0.1:8092/readyz >/dev/null \
    && pass "egress control ready on loopback" || fail "egress control readiness"
  curl --fail --silent http://127.0.0.1:8090/readyz >/dev/null \
    && pass "broker ready on loopback" || fail "broker readiness"

  egress_name="${EXECUTOR_EGRESS_CONTAINER:-cuadrabot-openai-egress}"
  if egress_json="$(/usr/bin/docker inspect "$egress_name" 2>/dev/null | jq '.[0]')"; then
    jq -e --arg image "$EXECUTOR_IMAGE" '.Config.Image == $image' <<<"$egress_json" >/dev/null \
      && pass "running egress uses pinned image" || fail "egress image mismatch"
    jq -e '.Config.User != "" and .Config.User != "0" and .Config.User != "root"' <<<"$egress_json" >/dev/null \
      && pass "egress is non-root" || fail "egress user is root/empty"
    jq -e '.HostConfig.ReadonlyRootfs == true and (.HostConfig.CapDrop | index("ALL")) != null and (.HostConfig.SecurityOpt | index("no-new-privileges:true")) != null' <<<"$egress_json" >/dev/null \
      && pass "egress container hardening" || fail "egress hardening mismatch"
    jq -e --argjson memory "$expected_egress_memory_bytes" --argjson pids "$expected_egress_pids" '.HostConfig.Memory == $memory and .HostConfig.MemorySwap == $memory and .HostConfig.PidsLimit == $pids' <<<"$egress_json" >/dev/null \
      && pass "egress resource limits" || fail "egress resource limits mismatch"
    jq -e '(.HostConfig.PortBindings | keys) == ["8092/tcp"] and .HostConfig.PortBindings["8092/tcp"] == [{"HostIp":"127.0.0.1","HostPort":"8092"}]' <<<"$egress_json" >/dev/null \
      && pass "egress exposes control on loopback only" || fail "egress port bindings unsafe"
    jq -e --arg volume "${EXECUTOR_EGRESS_STATE_VOLUME:-cuadrabot-egress-state}" --arg destination "${EGRESS_STATE_DIR:-/state}" '.Mounts | any(.Type == "volume" and .Name == $volume and .Destination == $destination and .RW == true)' <<<"$egress_json" >/dev/null \
      && pass "egress state uses encrypted rootless volume" || fail "egress state mount mismatch"
  else
    fail "egress container cannot be inspected"
  fi

  while read -r processor; do
    [[ -n "$processor" ]] || continue
    processor_json="$(/usr/bin/docker inspect "$processor" | jq '.[0]')"
    jq -e --arg image "$EXECUTOR_PROCESSOR_IMAGE" '.Config.Image == $image' <<<"$processor_json" >/dev/null \
      || fail "$processor image mismatch"
    jq -e '.Config.User == "10001:10001" and .HostConfig.ReadonlyRootfs == true and (.HostConfig.CapDrop | index("ALL")) != null and (.HostConfig.SecurityOpt | index("no-new-privileges:true")) != null' <<<"$processor_json" >/dev/null \
      || fail "$processor isolation flags mismatch"
    jq -e --argjson memory "$expected_processor_memory_bytes" --argjson nano_cpus "$expected_processor_nano_cpus" --argjson pids "$expected_processor_pids" '.HostConfig.Memory == $memory and .HostConfig.MemorySwap == $memory and .HostConfig.NanoCpus == $nano_cpus and .HostConfig.PidsLimit == $pids' <<<"$processor_json" >/dev/null \
      || fail "$processor resource limits mismatch"
    jq -e '(.NetworkSettings.Ports | keys) == ["8000/tcp"] and (.NetworkSettings.Ports["8000/tcp"] | length) == 1 and .NetworkSettings.Ports["8000/tcp"][0].HostIp == "127.0.0.1" and (.NetworkSettings.Ports["8000/tcp"][0].HostPort | test("^[1-9][0-9]{0,4}$"))' <<<"$processor_json" >/dev/null \
      || fail "$processor has an unsafe/non-single loopback binding"
    jq -e --arg jobs "$CUADRABOT_ROOT/executor/state/jobs/" '(.Mounts | any(.RW == true and .Type == "bind" and (.Source | startswith($jobs)) and .Destination == "/data")) and (.Mounts | all(if .RW then (.Type == "bind" and (.Source | startswith($jobs)) and .Destination == "/data") else true end))' <<<"$processor_json" >/dev/null \
      || fail "$processor has a writable sibling/shared mount"
    mapfile -t job_networks < <(jq -r '.NetworkSettings.Networks | keys[]' <<<"$processor_json")
    [[ "${#job_networks[@]}" -eq 1 ]] || fail "$processor must have exactly one job network"
    for network in "${job_networks[@]}"; do
      network_json="$(/usr/bin/docker network inspect "$network" | jq '.[0]')"
      jq -e '.Internal == true and .Labels["com.cuadrabot.executor.managed"] == "true" and .Labels["com.cuadrabot.executor.role"] == "job-network"' <<<"$network_json" >/dev/null \
        || fail "$processor network is not managed/internal"
      jq -e --arg egress "$egress_name" --arg processor "$processor" '[.Containers[].Name] | index($egress) != null and index($processor) != null' <<<"$network_json" >/dev/null \
        || fail "$processor job network membership mismatch"
    done
    pass "$processor disposable isolation"
  done < <(/usr/bin/docker ps --filter label=com.cuadrabot.executor.role=processor --format '{{.Names}}')
fi

if [[ "$failures" -gt 0 ]]; then
  echo "$failures validation check(s) failed" >&2
  exit 1
fi
echo "All $mode host validation checks passed."
