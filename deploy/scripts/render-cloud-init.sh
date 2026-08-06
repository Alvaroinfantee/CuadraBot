#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF'
Usage: render-cloud-init.sh --config /secure/path/provision.env [--output FILE]

Renders public SSH data into cloud-init. The input file is sourced as trusted
operator configuration. The output defaults to stdout.
EOF
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_dir="$(cd -- "$script_dir/.." && pwd -P)"
config_file=""
output_file=""

while (($#)); do
  case "$1" in
    --config)
      config_file="${2:-}"
      shift 2
      ;;
    --output)
      output_file="${2:-}"
      shift 2
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
  echo "--config must name a readable provision environment file" >&2
  exit 2
}

# shellcheck disable=SC1090
source "$config_file"
: "${ADMIN_SSH_PUBLIC_KEY:?ADMIN_SSH_PUBLIC_KEY is required}"
: "${ADMIN_SSH_CIDR:?ADMIN_SSH_CIDR is required}"

if [[ ! "$ADMIN_SSH_PUBLIC_KEY" =~ ^(ssh-ed25519|sk-ssh-ed25519@openssh.com|ecdsa-sha2-nistp256|sk-ecdsa-sha2-nistp256@openssh.com)[[:space:]][A-Za-z0-9+/=]+([[:space:]][^[:cntrl:]]+)?$ ]]; then
  echo "ADMIN_SSH_PUBLIC_KEY must be one supported public key line" >&2
  exit 2
fi
if [[ "$ADMIN_SSH_PUBLIC_KEY" == *$'\n'* || "$ADMIN_SSH_PUBLIC_KEY" == *$'\r'* ]]; then
  echo "ADMIN_SSH_PUBLIC_KEY must not contain a newline" >&2
  exit 2
fi

python_bin=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 \
    && "$candidate" -c 'import sys; raise SystemExit(sys.version_info.major != 3)' >/dev/null 2>&1; then
    python_bin="$candidate"
    break
  fi
done
[[ -n "$python_bin" ]] || {
  echo "Python 3 is required to render cloud-init" >&2
  exit 2
}

"$python_bin" - "$ADMIN_SSH_CIDR" <<'PY'
import ipaddress
import sys

network = ipaddress.ip_network(sys.argv[1], strict=False)
if network.version != 4:
    raise SystemExit("ADMIN_SSH_CIDR must be an IPv4 CIDR")
PY

rendered="$("$python_bin" - "$deploy_dir/cloud-init.yaml" "$ADMIN_SSH_PUBLIC_KEY" "$ADMIN_SSH_CIDR" <<'PY'
from pathlib import Path
import sys

template = Path(sys.argv[1]).read_text(encoding="utf-8")
public_key, cidr = sys.argv[2], sys.argv[3]
if "__ADMIN_SSH_PUBLIC_KEY__" not in template or "__ADMIN_SSH_CIDR__" not in template:
    raise SystemExit("cloud-init template placeholders are missing")
rendered = template.replace("__ADMIN_SSH_PUBLIC_KEY__", public_key)
rendered = rendered.replace("__ADMIN_SSH_CIDR__", cidr)
if "__ADMIN_" in rendered:
    raise SystemExit("cloud-init still contains an unresolved admin placeholder")
sys.stdout.write(rendered)
PY
)"

if [[ -n "$output_file" ]]; then
  umask 077
  printf '%s\n' "$rendered" > "$output_file"
else
  printf '%s\n' "$rendered"
fi
