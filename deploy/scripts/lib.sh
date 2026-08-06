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

check_docker_data_dir() {
  local path="$1" owner="$2" group="$3"
  local mode group_entry group_gid group_members primary_gid_users
  [[ -d "$path" && ! -L "$path" ]] || return 1
  [[ "$(stat -c '%U:%G' "$path")" == "$owner:$group" ]] || return 1
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" == 700 ]] && return 0

  # Docker 29 on Ubuntu 24.04 restores its rootless data directory to 0710 on
  # every daemon start. Permit only that exact alternate mode, and only while
  # the user-private group has no supplemental members or shared primary GID.
  [[ "$mode" == 710 ]] || return 1
  group_entry="$(getent group "$group" 2>/dev/null || true)"
  [[ -n "$group_entry" ]] || return 1
  IFS=: read -r _ _ group_gid group_members <<<"$group_entry"
  [[ -n "$group_gid" && -z "$group_members" ]] || return 1
  primary_gid_users="$(getent passwd | awk -F: -v gid="$group_gid" '$4 == gid {print $1}')"
  [[ "$primary_gid_users" == "$owner" ]]
}

# Ubuntu 24.04's UFW output has shipped in both of these forms:
#   22/tcp  ALLOW     198.51.100.10
#   22/tcp  ALLOW IN  198.51.100.10
# IPv6 rows insert "(v6)" before the action. Normalize every permissive inbound
# action, including LIMIT, so callers can require one exact ALLOW rule without
# depending on presentation and without overlooking an additional LIMIT rule.
parse_ufw_inbound_permit_rules() {
  awk '
    $2 == "ALLOW" || $2 == "LIMIT" {
      if ($3 == "OUT" || $3 == "FWD") next
      if ($3 == "IN") print $2 " " $1 " " $4
      else print $2 " " $1 " " $3
      next
    }
    $3 == "ALLOW" || $3 == "LIMIT" {
      if ($4 == "OUT" || $4 == "FWD") next
      if ($4 == "IN") print $3 " " $1 " " $5
      else print $3 " " $1 " " $4
    }
  '
}

ufw_default_denies_incoming() {
  grep -Eq '^Default: deny \(incoming\)(,|$)'
}
