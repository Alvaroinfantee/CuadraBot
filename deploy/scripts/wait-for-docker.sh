#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

for _ in $(seq 1 60); do
  if /usr/bin/docker info >/dev/null 2>&1; then
    security_options="$(/usr/bin/docker info --format '{{json .SecurityOptions}}')"
    [[ "$security_options" == *rootless* ]] || {
      echo "Docker daemon is not rootless" >&2
      exit 1
    }
    [[ "$(/usr/bin/docker info --format '{{.CgroupDriver}}')" == "systemd" ]] || {
      echo "Rootless Docker is not using the systemd cgroup driver" >&2
      exit 1
    }
    exit 0
  fi
  sleep 1
done

echo "Rootless Docker did not become ready in 60 seconds" >&2
exit 1
