#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF'
Usage: sudo deploy-release.sh FULL_40_CHAR_COMMIT [--config FILE] [--apply]

Default: validate the requested immutable release and print the plan. --apply
fetches that exact commit, installs locked Node dependencies, pulls digest-
pinned images, atomically switches `current`, and starts the private services.
It refuses to interrupt an active processor job.
EOF
}

commit=""
config_file=""
apply=false
while (($#)); do
  case "$1" in
    --config) config_file="${2:-}"; shift 2 ;;
    --apply) apply=true; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
    *) [[ -z "$commit" ]] || { echo "Only one commit may be supplied" >&2; exit 2; }; commit="$1"; shift ;;
  esac
done
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || { echo "A full lowercase 40-character Git commit is required" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "Run with sudo" >&2; exit 2; }

: "${config_file:=/srv/cuadrabot/secrets/host.env}"
[[ -f "$config_file" ]] || { echo "Host config not found: $config_file" >&2; exit 2; }
# shellcheck disable=SC1090
source "$config_file"
: "${CUADRABOT_ROOT:=/srv/cuadrabot}"
: "${CUADRABOT_RELEASE:=$CUADRABOT_ROOT/current}"
: "${CUADRABOT_DEPLOY_USER:=cuadrabot}"
: "${CUADRABOT_DEPLOY_HOME:=/home/cuadrabot}"
: "${CUADRABOT_EXECUTOR_USER:=cuadraexec}"
: "${CUADRABOT_EXECUTOR_UID:=10002}"
: "${CUADRABOT_EXECUTOR_HOME:=/home/cuadraexec}"
: "${CUADRABOT_WORKER_USER:=cuadraworker}"
: "${CUADRABOT_LIBEXEC:=/usr/local/lib/cuadrabot}"
: "${NPM_BIN:=/usr/local/bin/npm}"
: "${REPOSITORY_URL:?REPOSITORY_URL is required}"
: "${EXECUTOR_IMAGE:?EXECUTOR_IMAGE is required}"
: "${EXECUTOR_PROCESSOR_IMAGE:?EXECUTOR_PROCESSOR_IMAGE is required}"
: "${DOCKER_CONFIG:=$CUADRABOT_ROOT/executor/docker-config}"

# shellcheck source=deploy/scripts/lib.sh
source "$CUADRABOT_LIBEXEC/lib.sh"
is_image_digest "$EXECUTOR_IMAGE" || die "EXECUTOR_IMAGE must be pinned by repository digest"
is_image_digest "$EXECUTOR_PROCESSOR_IMAGE" || die "EXECUTOR_PROCESSOR_IMAGE must be pinned by repository digest"
[[ "$REPOSITORY_URL" =~ ^(https://github.com/|git@github.com:)[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(.git)?$ ]] || die "REPOSITORY_URL must be one GitHub repository URL"

release_dir="$CUADRABOT_ROOT/releases/$commit"
normalize_release_tree() {
  local tree="$1"
  [[ "$tree" == "$CUADRABOT_ROOT/releases/"* && -d "$tree" && ! -L "$tree" ]] || die "unsafe release tree"
  chown -R --no-dereference "$CUADRABOT_DEPLOY_USER:$CUADRABOT_DEPLOY_USER" "$tree"
  find -P "$tree" -type d -exec chmod u+rwx,go-w,go+rx -- {} +
  find -P "$tree" -type f -exec chmod u+rw,go-w,go+r -- {} +
  find -P "$tree" -type f -perm /u=x -exec chmod go+x -- {} +
}
current="none"
if [[ -L "$CUADRABOT_RELEASE" ]]; then
  current="$(basename -- "$(readlink -f -- "$CUADRABOT_RELEASE")")"
fi

cat <<EOF
Immutable release plan
  current:         $current
  requested:       $commit
  repository:      $REPOSITORY_URL
  executor image:  $EXECUTOR_IMAGE
  processor image: $EXECUTOR_PROCESSOR_IMAGE
  concurrency:     1 job, 2 CPU, 6 GiB RAM, no container swap
EOF
if [[ "$apply" != true ]]; then
  echo "Dry run complete. Add --apply after checking CI and image digests."
  exit 0
fi

export DOCKER_HOST="unix:///run/user/$CUADRABOT_EXECUTOR_UID/docker.sock"
"$CUADRABOT_LIBEXEC/wait-for-docker.sh"

if [[ ! -d "$release_dir" ]]; then
  incoming="$(mktemp -d "$CUADRABOT_ROOT/releases/.incoming-${commit}.XXXXXX")"
  chown "$CUADRABOT_DEPLOY_USER:$CUADRABOT_DEPLOY_USER" "$incoming"
  runuser -u "$CUADRABOT_DEPLOY_USER" -- env HOME="$CUADRABOT_DEPLOY_HOME" \
    git clone --filter=blob:none --no-checkout "$REPOSITORY_URL" "$incoming"
  runuser -u "$CUADRABOT_DEPLOY_USER" -- env HOME="$CUADRABOT_DEPLOY_HOME" \
    git -C "$incoming" fetch --depth=1 origin "$commit"
  runuser -u "$CUADRABOT_DEPLOY_USER" -- env HOME="$CUADRABOT_DEPLOY_HOME" \
    git -C "$incoming" checkout --detach "$commit"
  [[ "$(runuser -u "$CUADRABOT_DEPLOY_USER" -- git -C "$incoming" rev-parse HEAD)" == "$commit" ]] || die "Fetched commit does not match request"
  [[ -f "$incoming/executor/src/broker-main.mjs" ]] || die "Release lacks executor broker"
  [[ -f "$incoming/executor/src/egress-main.mjs" ]] || die "Release lacks executor egress"
  [[ -f "$incoming/executor/bin/codex-egress" ]] || die "Release lacks the provider wrapper"
  [[ -f "$incoming/executor/Dockerfile.egress" ]] || die "Release lacks the egress image definition"
  [[ -f "$incoming/executor/Dockerfile.processor" ]] || die "Release lacks the isolated processor image definition"
  runuser -u "$CUADRABOT_DEPLOY_USER" -- env HOME="$CUADRABOT_DEPLOY_HOME" \
    "$NPM_BIN" --prefix "$incoming" ci --no-audit --no-fund
  runuser -u "$CUADRABOT_DEPLOY_USER" -- env HOME="$CUADRABOT_DEPLOY_HOME" \
    "$NPM_BIN" --prefix "$incoming" test
  runuser -u "$CUADRABOT_DEPLOY_USER" -- env HOME="$CUADRABOT_DEPLOY_HOME" \
    "$NPM_BIN" --prefix "$incoming" run test:executor
  chmod 0755 "$incoming"
  mv -- "$incoming" "$release_dir"
fi

normalize_release_tree "$release_dir"

[[ "$(runuser -u "$CUADRABOT_DEPLOY_USER" -- git -C "$release_dir" rev-parse HEAD)" == "$commit" ]] || die "Existing release directory has the wrong commit"
[[ -z "$(runuser -u "$CUADRABOT_DEPLOY_USER" -- git -C "$release_dir" status --short)" ]] || die "Release worktree is not clean"
runuser -u "$CUADRABOT_WORKER_USER" -- test -r "$release_dir/worker/src/index.ts" || die "worker cannot read its release entrypoint"
runuser -u "$CUADRABOT_EXECUTOR_USER" -- test -r "$release_dir/executor/src/broker-main.mjs" || die "executor cannot read its release entrypoint"
runuser -u "$CUADRABOT_WORKER_USER" -- test ! -w "$release_dir" || die "worker can write the immutable release"
runuser -u "$CUADRABOT_EXECUTOR_USER" -- test ! -w "$release_dir" || die "executor can write the immutable release"

runuser -u "$CUADRABOT_EXECUTOR_USER" -- env \
  HOME="$CUADRABOT_EXECUTOR_HOME" DOCKER_HOST="$DOCKER_HOST" \
  DOCKER_CONFIG="$DOCKER_CONFIG" \
  /usr/bin/docker pull "$EXECUTOR_IMAGE"
runuser -u "$CUADRABOT_EXECUTOR_USER" -- env \
  HOME="$CUADRABOT_EXECUTOR_HOME" DOCKER_HOST="$DOCKER_HOST" \
  DOCKER_CONFIG="$DOCKER_CONFIG" \
  /usr/bin/docker pull "$EXECUTOR_PROCESSOR_IMAGE"
/usr/bin/docker image inspect "$EXECUTOR_IMAGE" >/dev/null
/usr/bin/docker image inspect "$EXECUTOR_PROCESSOR_IMAGE" >/dev/null

manifest="$CUADRABOT_ROOT/manifests/$commit.env"
if [[ -e "$manifest" ]]; then
  [[ -f "$manifest" && ! -L "$manifest" ]] || die "existing release manifest is not a regular file"
  [[ "$(sed -n 's/^RELEASE_COMMIT=//p' "$manifest")" == "$commit" ]] || die "existing release manifest commit mismatch"
  [[ "$(sed -n 's/^EXECUTOR_IMAGE=//p' "$manifest")" == "$EXECUTOR_IMAGE" ]] || die "refusing to replace immutable egress image manifest"
  [[ "$(sed -n 's/^EXECUTOR_PROCESSOR_IMAGE=//p' "$manifest")" == "$EXECUTOR_PROCESSOR_IMAGE" ]] || die "refusing to replace immutable processor image manifest"
else
  umask 077
  printf 'RELEASE_COMMIT=%s\nEXECUTOR_IMAGE=%s\nEXECUTOR_PROCESSOR_IMAGE=%s\nCREATED_AT=%s\n' \
    "$commit" "$EXECUTOR_IMAGE" "$EXECUTOR_PROCESSOR_IMAGE" "$(date -u +%FT%TZ)" \
    > "$manifest"
  chown root:root "$manifest"
fi

previous_target=""
previous_manifest=""
if [[ -L "$CUADRABOT_RELEASE" ]]; then
  previous_target="$(readlink -f -- "$CUADRABOT_RELEASE")"
  [[ "$previous_target" == "$CUADRABOT_ROOT/releases/"* ]] || die "current symlink escapes releases"
  previous_manifest="$CUADRABOT_ROOT/manifests/$(basename -- "$previous_target").env"
  [[ -f "$previous_manifest" && ! -L "$previous_manifest" ]] || die "current release has no immutable image manifest"
fi

# Stop intake first so the active-job check cannot race a newly claimed job.
systemctl stop cuadrabot-worker.service >/dev/null 2>&1 || true
active_jobs="$(/usr/bin/docker ps --format '{{.Names}}' | grep '^cuadrabot-takeoff-' || true)"
if [[ -n "$active_jobs" ]]; then
  echo "Refusing to activate while a processor job is running; worker remains stopped" >&2
  exit 6
fi
systemctl stop cuadrabot-broker.service cuadrabot-egress.service >/dev/null 2>&1 || true

if [[ -n "$previous_target" ]]; then
  ln -sfn -- "$previous_target" "$CUADRABOT_ROOT/previous"
fi
activation_link="$CUADRABOT_ROOT/.current-${commit}"
ln -s -- "$release_dir" "$activation_link"
mv -Tf -- "$activation_link" "$CUADRABOT_RELEASE"

if ! systemctl enable --now \
  cuadrabot-egress.service \
  cuadrabot-broker.service \
  cuadrabot-worker.service \
  cuadrabot-reconcile.timer \
  cuadrabot-retention.timer \
  cuadrabot-archive-integrity.timer; then
  if [[ -n "$previous_target" ]]; then
    "$CUADRABOT_LIBEXEC/apply-image-manifest.sh" "$previous_manifest" "$config_file"
    rollback_link="$CUADRABOT_ROOT/.rollback-${commit}"
    ln -s -- "$previous_target" "$rollback_link"
    mv -Tf -- "$rollback_link" "$CUADRABOT_RELEASE"
    systemctl restart cuadrabot-egress.service cuadrabot-broker.service cuadrabot-worker.service || true
  fi
  die "Service activation failed; previous release was restored when available"
fi

for _ in $(seq 1 30); do
  if systemctl is-active --quiet cuadrabot-egress.service \
    && systemctl is-active --quiet cuadrabot-broker.service \
    && systemctl is-active --quiet cuadrabot-worker.service \
    && curl --fail --silent http://127.0.0.1:8092/readyz >/dev/null \
    && curl --fail --silent http://127.0.0.1:8090/readyz >/dev/null; then
    echo "Release $commit is active and ready."
    exit 0
  fi
  sleep 2
done

if [[ -n "$previous_target" ]]; then
  systemctl stop cuadrabot-worker.service cuadrabot-broker.service cuadrabot-egress.service || true
  "$CUADRABOT_LIBEXEC/apply-image-manifest.sh" "$previous_manifest" "$config_file"
  rollback_link="$CUADRABOT_ROOT/.rollback-${commit}"
  ln -s -- "$previous_target" "$rollback_link"
  mv -Tf -- "$rollback_link" "$CUADRABOT_RELEASE"
  systemctl restart cuadrabot-egress.service cuadrabot-broker.service cuadrabot-worker.service || true
fi
die "Readiness failed; previous release was restored when available"
