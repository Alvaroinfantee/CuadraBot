# CuadraBot executor operations runbook

## 1. Provision and attest the host

Choose one explicit host profile before provisioning:

- `standard`: the 16 GiB / 8 vCPU shape below, for normal production capacity;
- `budget`: 2 GiB / 1 vCPU, a 10 GiB encrypted volume, no paid Droplet backups,
  and the exact limits in `config/budget-host.env.example`. This is a
  low-volume launch profile and may fail large or dense drawing sets.

Never mix the standard host size with budget container limits, or the budget
host size with standard 6 GiB processor limits. The bootstrap, component
preflight, and host validator reject mixed profiles.

In the DigitalOcean UI create these exact resources in `lon1`:

1. Ubuntu 24.04 LTS Basic Regular Droplet, 16 GiB RAM / 8 vCPU, with monitoring
   and weekly backups enabled.
2. A new 100 GiB ext4 Block Storage volume named/labeled
   `cuadrabot-prod`, attached to that Droplet. Do not reuse an unidentified
   volume. Record that DigitalOcean identifies it as Block Storage and set
   `DO_VOLUME_ENCRYPTION_AT_REST_CONFIRMED=true` only after that check.
3. A Cloud Firewall applied before enabling workloads. Inbound is TCP/22 from
   the operator's fixed CIDR only. Do not add 80, 443, 8090, 8091, 8092, or a
   processor port. Outbound needs DNS, NTP, HTTP for OS mirrors, and HTTPS.
   Record the same source in `ADMIN_SSH_CIDR` and set
   `DO_CLOUD_FIREWALL_SSH_ONLY_CONFIRMED=true` only after inspecting the
   attached firewall in the control plane.
4. Use an SSH public key. Root login and password authentication are disabled
   by `cloud-init.yaml`; the `cuadrabot` account is the only allowed SSH user.

Copy `config/provision.env.example` outside the repository and replace the SSH
key placeholder while retaining the single quotes around the complete public
key line. The file is sourced as trusted Bash configuration, so do not paste an
unquoted key or add shell commands. Render cloud-init locally and paste/upload
the rendered file, never a secret:

```bash
bash deploy/scripts/render-cloud-init.sh \
  --config /secure/path/provision.env \
  --output /secure/path/cuadrabot-cloud-init.yaml
```

The alternative `provision-do.sh` is dry-run by default, but the signed-in UI
is acceptable. After creation, verify cloud-init and the two firewalls:

```bash
sudo cloud-init status --wait
sudo ufw status verbose
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|allowusers'
```

## 2. Publish immutable images

In GitHub Actions, run **CI** against the exact release branch/commit with
`publish_images=true`. The publisher never runs on pull requests and has
`packages:write` only in its gated job. It builds:

- the pinned takeoff base;
- the final disposable processor, which adds `executor/bin/codex-egress`;
- the non-root egress image.

Download `production-image-digests-COMMIT` and verify its `RELEASE_COMMIT` is
the intended 40-character commit. Copy only the two `@sha256:` references into
`host.env`; never substitute tags or `latest`.

If GHCR packages are private, authenticate the rootless client once. Keep the
Docker credential file on the encrypted Block Storage volume:

```bash
printf '%s' "$GHCR_READ_TOKEN" | sudo -u cuadraexec env \
  HOME=/home/cuadraexec \
  DOCKER_HOST=unix:///run/user/10002/docker.sock \
  DOCKER_CONFIG=/srv/cuadrabot/executor/docker-config \
  docker login ghcr.io -u GITHUB_USER --password-stdin
unset GHCR_READ_TOKEN
sudo chmod 0700 /srv/cuadrabot/executor/docker-config
sudo chmod 0600 /srv/cuadrabot/executor/docker-config/config.json
```

Use a read-packages-only token. Do not put it in `host.env` or systemd.

## 3. Bootstrap and configure

Copy `host.env.example` to a secure host path and fill the digest references.
The bootstrap defaults to a read-only plan and never formats a device:

```bash
sudo bash deploy/scripts/bootstrap-host.sh --config /secure/path/host.env
sudo bash deploy/scripts/bootstrap-host.sh --config /secure/path/host.env --apply
```

Confirm the reported by-id device and filesystem UUID before `--apply`. Copy
the four runtime examples to names without `.example`, fill them, then enforce:

```bash
sudo chown root:root /srv/cuadrabot/secrets /srv/cuadrabot/secrets/*.env
sudo chmod 0600 /srv/cuadrabot/secrets/*.env
sudo chmod 0700 /srv/cuadrabot/secrets
```

Systemd PID 1 reads these root-only environment files and then starts each
service as its dedicated UID: `cuadraworker` for the worker, `cuadracron` for
maintenance calls, and `cuadraexec` for the trusted broker/egress/Docker control
plane. Egress gets a service-lifetime copy at
`/run/cuadrabot-executor/egress.env`; it is removed when the unit stops. Never
grant the worker or cron user membership in the executor group.

Secret equality requirements:

- app `WORKER_SHARED_SECRET` = worker `WORKER_SHARED_SECRET`;
- worker `TAKEOFF_SERVICE_API_TOKEN` = broker `EXECUTOR_BROKER_TOKEN`;
- broker `EXECUTOR_EGRESS_CONTROL_TOKEN` = egress `EGRESS_CONTROL_TOKEN`;
- app `CRON_SECRET` = cron `CRON_SECRET`.

Every other secret is independent. The server-owned `OPENAI_API_KEY` appears
only in `egress.env`. It must not appear in worker/broker files, images, job
directories, command lines, or logs.

## 4. Release and health gate

The release tool fetches only the exact commit, runs locked tests, pulls only
the configured digest images, stops intake, refuses active jobs, atomically
switches the symlink, and rolls back on readiness failure:

```bash
sudo bash /usr/local/lib/cuadrabot/deploy-release.sh FULL_COMMIT
sudo bash /usr/local/lib/cuadrabot/deploy-release.sh FULL_COMMIT --apply
sudo bash /usr/local/lib/cuadrabot/validate-host.sh
```

Do not route public jobs until full validation passes. Specifically verify:

- no public listener other than restricted SSH;
- broker `127.0.0.1:8090` and egress control `127.0.0.1:8092` are ready;
- data port 8091 is not host-published;
- an active processor publishes no host port, exposes its API only through the
  private `/data/processor.sock`, and has one internal job network;
- processor memory and memory+swap are both 6 GiB;
- worker, broker, egress, and three required timers are active;
- Admin Health receives fresh worker/processor/reconciler/retention/archive
  reports and cost-accounting status is healthy.

Run one controlled paid test and inspect the live container with validation
while it is processing. Confirm completion deletes the job container, internal
network, scoped token, and local job directory.

## 5. Routine operation

```bash
systemctl status cuadrabot-worker cuadrabot-broker cuadrabot-egress
systemctl list-timers 'cuadrabot-*'
journalctl -u cuadrabot-worker -u cuadrabot-broker -u cuadrabot-egress --since today
sudo bash /usr/local/lib/cuadrabot/validate-host.sh
```

Never log environment files or `docker inspect` output in a public ticket;
container environment metadata includes scoped runtime credentials.

Required schedules are UTC:

- reconciliation every ten minutes;
- generated-file retention daily at 03:15;
- source archive presence daily at 04:15.

Review unattended-upgrade and fail2ban logs weekly. Reboot for kernel/runtime
updates in a maintenance window only after stopping intake and confirming no
active processor. Re-run validation after reboot.

## 6. Backup and restore

Weekly Droplet backups protect only the boot disk. They do not contain
`/srv/cuadrabot`. For the volume, either configure the optional client-encrypted
Restic target or create explicitly retained volume snapshots. DigitalOcean
documents that volume snapshots inherit volume encryption; snapshots are not
automatic and incur separate storage charges.

Restic intentionally backs up only secrets and immutable release manifests.
It excludes active drawings, Docker layers, egress token state, and job state.
On host loss, app reconciliation safely requeues/releases the authoritative
job rather than restoring a potentially inconsistent processor runtime.
The Restic password and Spaces credentials are required to recover this backup,
so escrow a current copy in an offline password manager; do not rely on the
backup repository to contain its own decryption credentials.

```bash
sudo systemctl enable --now cuadrabot-backup.timer
sudo systemctl start cuadrabot-backup.service
sudo journalctl -u cuadrabot-backup.service -n 100
sudo bash /usr/local/lib/cuadrabot/restore.sh
sudo bash /usr/local/lib/cuadrabot/restore.sh --snapshot SNAPSHOT --apply
```

Restore always goes to `/srv/cuadrabot/restore/SNAPSHOT`; it never overwrites
live files. Rebuild a clean Droplet and volume, bootstrap, stage/inspect the
restore, reinstall the recorded commit/digests, then copy only reviewed secret
and manifest files. Rotate the OpenAI key and all internal tokens after a
disaster. Rehearse this procedure quarterly.

This runner backup is not the required independent backup of Supabase Storage
source PDFs. Maintain and restore-test that object backup separately.

## 7. Rollback

Rollback is local and fail-closed. It will stop intake and refuse to interrupt
an active processor:

```bash
sudo bash /usr/local/lib/cuadrabot/rollback.sh
sudo bash /usr/local/lib/cuadrabot/rollback.sh --apply
# Or name a previously installed full commit explicitly.
sudo bash /usr/local/lib/cuadrabot/rollback.sh FULL_COMMIT --apply
```

Database migrations are not rolled back by this script. Before a schema
release, prove backward compatibility or prepare and separately approve a
forward repair migration.

## 8. Incidents

- **Egress or key concern:** stop worker, broker, and egress; revoke/rotate the
  OpenAI key; inspect audit records without printing secrets; restart only
  after all scoped tokens/containers/networks are gone.
- **Stale job:** stop worker intake, let broker TTL cleanup run, invoke
  reconciliation, and confirm reserved credits are released or safely requeued.
- **Disk pressure:** stop worker first. Never recursively delete `/srv`.
  Use the broker cleanup contract and exact retention paths; preserve manifests
  and secrets. Expand the DigitalOcean volume if sustained capacity requires it.
- **Unexpected public listener/network:** stop all three services immediately,
  preserve logs, correct the unit/executor, and require a full validation pass.
- **Volume unavailable:** services have `RequiresMountsFor` and should fail
  closed. Do not let Docker/jobs fall back to the boot disk.
