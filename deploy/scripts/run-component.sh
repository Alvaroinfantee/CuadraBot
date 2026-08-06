#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

component="${1:-}"
release="${CUADRABOT_RELEASE:-/srv/cuadrabot/current}"
node_bin="${NODE_BIN:-/usr/local/bin/node}"
npm_bin="${NPM_BIN:-/usr/local/bin/npm}"

case "$component" in
  worker)
    cd -- "$release"
    exec "$npm_bin" run worker
    ;;
  broker)
    cd -- "$release"
    exec "$node_bin" executor/src/broker-main.mjs
    ;;
  *)
    echo "component must be worker or broker" >&2
    exit 2
    ;;
esac
