#!/usr/bin/env bash

die() {
  echo "ERROR: $*" >&2
  exit 1
}

is_image_digest() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9._/-]*(@sha256:)[a-f0-9]{64}$ ]]
}

require_exact_file_mode() {
  local file="$1" expected_owner="$2" expected_mode="$3" expected_group="${4:-$2}"
  [[ -f "$file" && ! -L "$file" ]] || die "Required regular file missing: $file"
  [[ "$(stat -c '%U' "$file")" == "$expected_owner" ]] || die "$file must be owned by $expected_owner"
  [[ "$(stat -c '%G' "$file")" == "$expected_group" ]] || die "$file must have group $expected_group"
  [[ "$(stat -c '%a' "$file")" == "$expected_mode" ]] || die "$file must have mode $expected_mode"
}

require_env_key() {
  local file="$1" key="$2"
  local value
  value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1)"
  [[ -n "$value" ]] || die "$key is blank or missing in $file"
  [[ "$value" != replace-* && "$value" != *replace-with* ]] || die "$key still has an example value in $file"
  [[ "$value" != *$'\r'* && "$value" != *$'\n'* ]] || die "$key contains a newline"
}

require_secret_key() {
  local file="$1" key="$2"
  require_env_key "$file" "$key"
  local value
  value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1)"
  [[ ${#value} -ge 32 ]] || die "$key must be at least 32 characters"
  [[ "$value" =~ ^[A-Za-z0-9._:/+=@-]+$ ]] || die "$key contains unsupported control or shell characters"
}

rootless_docker() {
  local uid="${CUADRABOT_EXECUTOR_UID:-10002}"
  DOCKER_HOST="unix:///run/user/${uid}/docker.sock" /usr/bin/docker "$@"
}

resolve_fstab_source() {
  local source="$1"
  local resolved
  resolved="$(findfs "$source" 2>/dev/null || readlink -f -- "$source" 2>/dev/null || true)"
  [[ -n "$resolved" ]] && readlink -f -- "$resolved" 2>/dev/null || true
}

filter_fstab_for_device() {
  local input_file="$1" resolved_device="$2"
  local fstab_line fstab_content fstab_source fstab_device
  while IFS= read -r fstab_line || [[ -n "$fstab_line" ]]; do
    fstab_content="${fstab_line%%#*}"
    fstab_source=""
    IFS=$' \t' read -r fstab_source _ <<<"$fstab_content" || true
    if [[ -n "$fstab_source" ]]; then
      fstab_device="$(resolve_fstab_source "$fstab_source")"
      if [[ "$fstab_device" == "$resolved_device" ]]; then
        continue
      fi
    fi
    printf '%s\n' "$fstab_line"
  done < "$input_file"
}
