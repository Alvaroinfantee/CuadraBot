#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF'
Usage: provision-do.sh --config /secure/path/provision.env [--apply]

Default: validate inputs and print the immutable production plan. No remote
resource is created. --apply additionally requires:

  CONFIRM_PRODUCTION_CREATE=cuadrabot-executor-lon1

Authenticate doctl separately; never put a DigitalOcean API token in this file.
EOF
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
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
  echo "--config must name a readable provision environment file" >&2
  exit 2
}

# shellcheck disable=SC1090
source "$config_file"
: "${DOCTL_CONTEXT:=default}"
: "${CUADRABOT_HOST_PROFILE:=standard}"
: "${DO_SSH_KEY_FINGERPRINT:?DO_SSH_KEY_FINGERPRINT is required}"
: "${DROPLET_NAME:=cuadrabot-executor-prod-1}"
: "${DROPLET_REGION:=lon1}"
: "${DROPLET_SIZE:=s-8vcpu-16gb}"
: "${DROPLET_IMAGE:=ubuntu-24-04-x64}"
: "${DROPLET_TAG:=cuadrabot-executor}"
: "${FIREWALL_NAME:=cuadrabot-executor-ssh-only}"
: "${VOLUME_NAME:=cuadrabot-prod}"
: "${VOLUME_SIZE:=100GiB}"
: "${VOLUME_FS_LABEL:=cuadrabot-prod}"

[[ "$DROPLET_REGION" == "lon1" ]] || { echo "DROPLET_REGION must be lon1" >&2; exit 2; }
[[ "$DROPLET_IMAGE" == "ubuntu-24-04-x64" ]] || { echo "DROPLET_IMAGE must be ubuntu-24-04-x64" >&2; exit 2; }
case "$CUADRABOT_HOST_PROFILE" in
  standard)
    [[ "$DROPLET_SIZE" == "s-8vcpu-16gb" ]] || { echo "The standard profile requires s-8vcpu-16gb" >&2; exit 2; }
    [[ "$VOLUME_SIZE" == "100GiB" ]] || { echo "The standard profile requires a 100GiB volume" >&2; exit 2; }
    [[ "$VOLUME_NAME" == "cuadrabot-prod" ]] || { echo "The standard volume must be cuadrabot-prod" >&2; exit 2; }
    enable_backups=true
    ;;
  budget)
    [[ "$DROPLET_SIZE" == "s-1vcpu-2gb" ]] || { echo "The budget profile requires s-1vcpu-2gb" >&2; exit 2; }
    [[ "$VOLUME_SIZE" == "10GiB" ]] || { echo "The budget profile requires a 10GiB volume" >&2; exit 2; }
    [[ "$VOLUME_NAME" == "cuadrabot-bgt" ]] || { echo "The budget volume must be cuadrabot-bgt" >&2; exit 2; }
    enable_backups=false
    ;;
  *) echo "CUADRABOT_HOST_PROFILE must be standard or budget" >&2; exit 2 ;;
esac
[[ "$VOLUME_FS_LABEL" == "$VOLUME_NAME" ]] || { echo "VOLUME_FS_LABEL must equal VOLUME_NAME" >&2; exit 2; }
[[ "$DROPLET_NAME" =~ ^[a-z0-9][a-z0-9-]{2,62}$ ]] || { echo "Invalid DROPLET_NAME" >&2; exit 2; }
[[ "$DROPLET_TAG" =~ ^[A-Za-z0-9:_-]{1,255}$ ]] || { echo "Invalid DROPLET_TAG" >&2; exit 2; }
[[ "$VOLUME_NAME" =~ ^[a-z][a-z0-9-]{1,63}$ ]] || { echo "Invalid VOLUME_NAME" >&2; exit 2; }
[[ "$VOLUME_FS_LABEL" =~ ^[A-Za-z0-9._-]{1,16}$ ]] || { echo "Invalid ext4 VOLUME_FS_LABEL" >&2; exit 2; }

cloud_init="$(mktemp)"
trap 'rm -f -- "$cloud_init"' EXIT
bash "$script_dir/render-cloud-init.sh" --config "$config_file" --output "$cloud_init"

cat <<EOF
DigitalOcean production plan (no changes made yet)
  host profile:  $CUADRABOT_HOST_PROFILE
  context:       $DOCTL_CONTEXT
  region:        $DROPLET_REGION
  droplet:       $DROPLET_NAME ($DROPLET_SIZE, $DROPLET_IMAGE)
  boot backups:  $([[ "$enable_backups" == true ]] && printf 'weekly, Sunday 02:00 UTC' || printf 'disabled; executor is rebuildable and source/results remain external')
  volume:        $VOLUME_NAME ($VOLUME_SIZE, ext4 label=$VOLUME_FS_LABEL, attached at creation)
  firewall:      $FIREWALL_NAME (inbound TCP/22 from $ADMIN_SSH_CIDR only)
  public apps:   none on this Droplet
  monitoring:    enabled
EOF

if [[ "$apply" != true ]]; then
  echo "Dry run complete. Add --apply only after reviewing this plan."
  exit 0
fi

[[ "${CONFIRM_PRODUCTION_CREATE:-}" == "cuadrabot-executor-lon1" ]] || {
  echo "Refusing: set CONFIRM_PRODUCTION_CREATE=cuadrabot-executor-lon1" >&2
  exit 3
}
command -v doctl >/dev/null || { echo "doctl is required" >&2; exit 4; }
doctl account get --context "$DOCTL_CONTEXT" >/dev/null

if doctl compute droplet list --context "$DOCTL_CONTEXT" --format Name --no-header | grep -Fxq "$DROPLET_NAME"; then
  echo "Refusing: Droplet $DROPLET_NAME already exists" >&2
  exit 5
fi
if doctl compute volume list --context "$DOCTL_CONTEXT" --format Name --no-header | grep -Fxq "$VOLUME_NAME"; then
  echo "Refusing: volume $VOLUME_NAME already exists" >&2
  exit 5
fi
if doctl compute firewall list --context "$DOCTL_CONTEXT" --format Name --no-header | grep -Fxq "$FIREWALL_NAME"; then
  echo "Refusing: firewall $FIREWALL_NAME already exists" >&2
  exit 5
fi

if ! doctl compute tag get "$DROPLET_TAG" --context "$DOCTL_CONTEXT" >/dev/null 2>&1; then
  doctl compute tag create "$DROPLET_TAG" --context "$DOCTL_CONTEXT" >/dev/null
fi

inbound_rules="protocol:tcp,ports:22,address:$ADMIN_SSH_CIDR"
outbound_rules="protocol:tcp,ports:53,address:0.0.0.0/0 protocol:udp,ports:53,address:0.0.0.0/0 protocol:udp,ports:123,address:0.0.0.0/0 protocol:tcp,ports:80,address:0.0.0.0/0 protocol:tcp,ports:443,address:0.0.0.0/0 protocol:icmp,ports:all,address:0.0.0.0/0"

firewall_id="$(doctl compute firewall create \
  --context "$DOCTL_CONTEXT" \
  --name "$FIREWALL_NAME" \
  --inbound-rules "$inbound_rules" \
  --outbound-rules "$outbound_rules" \
  --tag-names "$DROPLET_TAG" \
  --format ID --no-header)"

volume_id="$(doctl compute volume create "$VOLUME_NAME" \
  --context "$DOCTL_CONTEXT" \
  --region "$DROPLET_REGION" \
  --size "$VOLUME_SIZE" \
  --fs-type ext4 \
  --fs-label "$VOLUME_FS_LABEL" \
  --tag "$DROPLET_TAG" \
  --format ID --no-header)"

droplet_args=(
  compute droplet create "$DROPLET_NAME"
  --context "$DOCTL_CONTEXT"
  --region "$DROPLET_REGION"
  --size "$DROPLET_SIZE"
  --image "$DROPLET_IMAGE"
  --ssh-keys "$DO_SSH_KEY_FINGERPRINT"
  --tag-name "$DROPLET_TAG"
  --volumes "$volume_id"
  --user-data-file "$cloud_init"
  --enable-monitoring
  --enable-private-networking
  --wait
  --format ID,PublicIPv4,Status
  --no-header
)
if [[ "$enable_backups" == true ]]; then
  droplet_args+=(
    --enable-backups
    --backup-policy-plan weekly
    --backup-policy-weekday SUN
    --backup-policy-hour 2
  )
fi
[[ -z "${DO_PROJECT_ID:-}" ]] || droplet_args+=(--project-id "$DO_PROJECT_ID")
[[ -z "${DO_VPC_UUID:-}" ]] || droplet_args+=(--vpc-uuid "$DO_VPC_UUID")

echo "Firewall created: $firewall_id"
echo "Encrypted-at-rest volume created: $volume_id"
doctl "${droplet_args[@]}"
echo "Provisioning submitted. Wait for cloud-init before SSH/bootstrap."
