#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_dir="$(cd -- "$script_dir/.." && pwd -P)"
repo_dir="$(cd -- "$deploy_dir/.." && pwd -P)"

while IFS= read -r -d '' script; do
  bash -n "$script"
done < <(find "$deploy_dir/scripts" -type f -name '*.sh' -print0)

grep -Fq 'OnCalendar=*-*-* *:00/10:00 UTC' "$deploy_dir/systemd/cuadrabot-reconcile.timer"
grep -Fq 'OnCalendar=*-*-* 03:15:00 UTC' "$deploy_dir/systemd/cuadrabot-retention.timer"
grep -Fq 'OnCalendar=*-*-* 04:15:00 UTC' "$deploy_dir/systemd/cuadrabot-archive-integrity.timer"
grep -Fq '127.0.0.1:${EGRESS_CONTROL_PORT}' "$deploy_dir/scripts/run-egress.sh"
grep -Fq -- '--memory-swap 512m' "$deploy_dir/scripts/run-egress.sh"
grep -Fq 'EXECUTOR_PROCESSOR_MEMORY_SWAP=6g' "$deploy_dir/config/host.env.example"
grep -Fq 'DOCKER_HOST=unix:///run/user/10002/docker.sock' "$deploy_dir/config/host.env.example"
grep -Fq 'install -o root -g root -m 0600' "$deploy_dir/scripts/bootstrap-host.sh"
grep -Fq 'stage-egress-env.sh' "$deploy_dir/systemd/cuadrabot-egress.service"
grep -Fq 'root:root:600' "$deploy_dir/scripts/stage-egress-env.sh"
grep -Fq 'find -P "$tree" -type d -exec chmod u+rwx,go-w,go+rx' "$deploy_dir/scripts/deploy-release.sh"
grep -Fq 'runuser -u "$CUADRABOT_WORKER_USER" -- test ! -w "$release_dir"' "$deploy_dir/scripts/deploy-release.sh"
grep -Fq 'systemctl is-active --quiet cuadrabot-worker.service' "$deploy_dir/scripts/deploy-release.sh"
grep -Fq "RequiresMountsFor=%s" "$deploy_dir/scripts/bootstrap-host.sh"
grep -Fq '"$NPM_BIN" --prefix "$incoming" run test:executor' "$deploy_dir/scripts/deploy-release.sh"
grep -Fqx '**/*.env' "$repo_dir/.dockerignore"
grep -Fq '/deploy/config/*.env' "$repo_dir/.gitignore"

# Prove the sourced provision-file shape preserves the spaces in an SSH public
# key, renders all placeholders, and remains valid cloud-init YAML when the
# validator is available (Ubuntu production and CI images normally provide it).
provision_fixture="$(mktemp)"
rendered_cloud_init="$(mktemp)"
fixture_public_key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEhERERERERERERERERERERERERERERERERERERERERE static-check'
printf "ADMIN_SSH_PUBLIC_KEY='%s'\nADMIN_SSH_CIDR=198.51.100.10/32\n" \
  "$fixture_public_key" > "$provision_fixture"
bash "$deploy_dir/scripts/render-cloud-init.sh" \
  --config "$provision_fixture" \
  --output "$rendered_cloud_init"
grep -Fq "$fixture_public_key" "$rendered_cloud_init"
if grep -Fq '__ADMIN_' "$rendered_cloud_init"; then
  echo "Rendered cloud-init contains an unresolved admin placeholder" >&2
  exit 1
fi
if command -v cloud-init >/dev/null 2>&1; then
  cloud-init schema --config-file "$rendered_cloud_init" >/dev/null
fi
rm -f -- "$provision_fixture" "$rendered_cloud_init"

# The DigitalOcean Ubuntu auto-mount may persist either a by-id or UUID fstab
# source. Exercise the exact parser used by bootstrap with both forms and keep
# an unrelated filesystem plus comments byte-for-byte.
# shellcheck source=deploy/scripts/lib.sh
source "$deploy_dir/scripts/lib.sh"
fstab_fixture="$(mktemp)"
fstab_filtered="$(mktemp)"
cat > "$fstab_fixture" <<'EOF'
# keep this comment
/dev/disk/by-id/scsi-do_volume_cuadrabot-prod /mnt/cuadrabot_prod ext4 defaults,nofail 0 2
UUID=cuadrabot-target /mnt/legacy ext4 defaults 0 2
UUID=unrelated /data ext4 defaults 0 2
EOF
resolve_fstab_source() {
  case "$1" in
    /dev/disk/by-id/scsi-do_volume_cuadrabot-prod|UUID=cuadrabot-target) printf '/dev/sdz\n' ;;
    UUID=unrelated) printf '/dev/sdy\n' ;;
    *) return 1 ;;
  esac
}
filter_fstab_for_device "$fstab_fixture" /dev/sdz > "$fstab_filtered"
grep -Fxq '# keep this comment' "$fstab_filtered"
grep -Fxq 'UUID=unrelated /data ext4 defaults 0 2' "$fstab_filtered"
[[ "$(wc -l < "$fstab_filtered")" -eq 2 ]]
rm -f -- "$fstab_fixture" "$fstab_filtered"

grep -Fxq 'User=@@WORKER_USER@@' "$deploy_dir/systemd/cuadrabot-worker.service"
grep -Fxq 'User=@@EXECUTOR_USER@@' "$deploy_dir/systemd/cuadrabot-broker.service"
grep -Fxq 'User=@@EXECUTOR_USER@@' "$deploy_dir/systemd/cuadrabot-egress.service"
for cron_unit in reconcile retention archive-integrity; do
  grep -Fxq 'User=@@CRON_USER@@' "$deploy_dir/systemd/cuadrabot-${cron_unit}.service"
done
for hardened_unit in worker broker egress reconcile retention archive-integrity; do
  unit="$deploy_dir/systemd/cuadrabot-${hardened_unit}.service"
  grep -Fxq 'ProtectProc=invisible' "$unit"
  grep -Fxq 'ProcSubset=pid' "$unit"
done

worker_unit="$deploy_dir/systemd/cuadrabot-worker.service"
[[ "$(grep -c '^EnvironmentFile=' "$worker_unit")" -eq 1 ]]
grep -Fq 'EnvironmentFile=@@CUADRABOT_ROOT@@/secrets/worker.env' "$worker_unit"
if grep -Eq '^EnvironmentFile=.*secrets/(host|broker|egress)\.env|^Environment=(DOCKER_HOST|XDG_RUNTIME_DIR)=' "$worker_unit"; then
  echo "Worker unit is exposed to executor configuration" >&2
  exit 1
fi
grep -Fq '/run/user/@@EXECUTOR_UID@@' "$worker_unit"

if grep -RIE '(^|[^A-Za-z])(sk-(proj-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,})' "$deploy_dir"; then
  echo "Possible live credential in deploy bundle" >&2
  exit 1
fi
if grep -RIE --exclude=static-check.sh '^[A-Z0-9_]*(IMAGE|IMAGE_REF)=.*(:latest|=latest)[[:space:]]*$' \
  "$deploy_dir/config" "$deploy_dir/systemd" "$deploy_dir/scripts"; then
  echo "Deployable image configuration uses an unpinned latest reference" >&2
  exit 1
fi

ci_file="$repo_dir/.github/workflows/ci.yml"
grep -Fq -- '- run: npm run test:executor' "$ci_file"
while IFS= read -r action_line; do
  [[ "$action_line" =~ @[a-f0-9]{40}([[:space:]]*#.*)?$ ]] || {
    echo "GitHub Action is not pinned to a full commit: $action_line" >&2
    exit 1
  }
done < <(grep -E '^[[:space:]]*(- )?uses:' "$ci_file")

for required in \
  "$repo_dir/executor/Dockerfile.egress" \
  "$repo_dir/executor/Dockerfile.processor" \
  "$repo_dir/executor/src/broker-main.mjs" \
  "$repo_dir/executor/src/egress-main.mjs" \
  "$repo_dir/executor/bin/codex-egress"; do
  [[ -f "$required" ]] || { echo "Missing executor deployment input: $required" >&2; exit 1; }
done

if command -v systemd-analyze >/dev/null 2>&1; then
  unit_tmp="$(mktemp -d)"
  cleanup_unit_tmp() {
    case "$unit_tmp" in
      "${TMPDIR:-/tmp}"/*) rm -rf -- "$unit_tmp" ;;
      *) echo "Refusing to remove unexpected temporary path: $unit_tmp" >&2 ;;
    esac
  }
  trap cleanup_unit_tmp EXIT
  mkdir -p \
    "$unit_tmp/root/secrets" \
    "$unit_tmp/root/worker-jobs" \
    "$unit_tmp/root/executor" \
    "$unit_tmp/root/docker" \
    "$unit_tmp/lib"
  cp "$deploy_dir"/scripts/*.sh "$unit_tmp/lib/"
  chmod 0755 "$unit_tmp/lib"/*.sh
  touch \
    "$unit_tmp/root/secrets/host.env" \
    "$unit_tmp/root/secrets/worker.env" \
    "$unit_tmp/root/secrets/broker.env" \
    "$unit_tmp/root/secrets/cron.env"
  for unit in "$deploy_dir"/systemd/*; do
    sed \
      -e "s|@@CUADRABOT_ROOT@@|$unit_tmp/root|g" \
      -e 's|@@DEPLOY_USER@@|root|g' \
      -e 's|@@DEPLOY_UID@@|0|g' \
      -e 's|@@DEPLOY_HOME@@|/root|g' \
      -e 's|@@EXECUTOR_USER@@|root|g' \
      -e 's|@@EXECUTOR_UID@@|0|g' \
      -e 's|@@EXECUTOR_HOME@@|/root|g' \
      -e 's|@@WORKER_USER@@|root|g' \
      -e 's|@@WORKER_UID@@|0|g' \
      -e 's|@@CRON_USER@@|root|g' \
      -e 's|@@CRON_UID@@|0|g' \
      -e "s|@@CUADRABOT_LIBEXEC@@|$unit_tmp/lib|g" \
      "$unit" > "$unit_tmp/$(basename -- "$unit")"
  done
  if grep -R '@@[A-Z_]*@@' "$unit_tmp"/*.service "$unit_tmp"/*.timer; then
    echo "Unrendered systemd placeholder" >&2
    exit 1
  fi
  systemd-analyze verify "$unit_tmp"/*.service "$unit_tmp"/*.timer
fi

echo "Deployment bundle static checks passed."
