# CuadraBot public executor deployment

This bundle deploys the private multi-tenant takeoff executor to one hardened
DigitalOcean Droplet. It deliberately does **not** expose an HTTP application
port. The existing App Platform web application remains public; the worker on
this host calls it over HTTPS.

## Production profiles

The default `standard` profile remains the fully sized production shape. A
separate `budget` profile is available for low-volume launch traffic when the
monthly hosting ceiling is more important than throughput. Both profiles keep
the same rootless-Docker, loopback broker, short-lived provider credential,
disposable processor, and deny-by-default network boundaries.

The budget profile is intentionally constrained to one job, one processor CPU,
1 GiB processor memory, a 128 MiB processor tmpfs, and a 256 MiB egress proxy.
It can be slower and can reject or exhaust unusually large or dense drawing
sets. Do not silently use it as evidence that the standard capacity is no
longer required; promote back to `standard` when real jobs show memory or
latency pressure.

### Standard profile

- DigitalOcean `lon1`, Ubuntu 24.04 LTS.
- Basic Regular `s-8vcpu-16gb` Droplet (8 shared vCPU, 16 GiB RAM).
- One processor job at a time, limited to 2 CPU, 6 GiB RAM, 6 GiB combined
  memory+swap, and 256 PIDs. Equal memory and memory-swap limits prohibit
  container swap usage.
- No host swap. Sixteen GiB leaves headroom for the rootless daemon, broker,
  egress proxy, worker, OS, raster tools, and page cache.
- A separately attached 100 GiB ext4 DigitalOcean Block Storage volume mounted
  at `/srv/cuadrabot`. Job state, Docker data, and secret files live there.
- Rootless Docker owned by the non-login `cuadraexec` executor user. Resource
  limits are a launch gate: validation requires cgroup v2, the systemd cgroup
  driver, and delegated CPU, IO, memory, and PID controllers.
- DigitalOcean Cloud Firewall and UFW admit TCP/22 only from the operator CIDR.
  There are no public broker, proxy, processor, or application ports.
- Weekly Droplet backups protect the boot disk. They do not include the
  Block Storage volume; use the encrypted off-host Restic workflow or volume
  snapshots separately.

DigitalOcean documents [Block Storage LUKS encryption at rest and encrypted
snapshots](https://docs.digitalocean.com/products/volumes/details/features/).
It also documents that [Droplet backups do not include attached
volumes](https://docs.digitalocean.com/products/backups/details/features/).

## Trust and network boundaries

```text
CuadraBot App Platform (public HTTPS)
          ^
          | outbound HTTPS
          |
   worker (host process, no Docker socket)
          |
          | 127.0.0.1:8090 + broker bearer token
          v
   broker (host process, rootless Docker socket)
          |
          +-- 127.0.0.1:8092 egress control plane
          |
          +-- one disposable processor container
                 - only an engine-assigned 127.0.0.1 host port to container 8000
                 - read-only root
                 - unique job-only bind and internal network
                 - no default route/general egress
                 - non-root UID, dropped capabilities, PID/CPU/RAM limits
                           |
                           | reverse API route on job-only network
                           v
                    egress proxy container
                    - only component with internet egress
                    - master OpenAI key exists only here
                    - data port 8091 is never host-published
                    - control port is host-published on 127.0.0.1:8092 only
```

The broker creates a fresh `--internal` Docker network per job, temporarily
connects the egress proxy under the `openai-egress` alias, and destroys the
processor container, network, token, and job directory at completion or TTL.
The validation script fails if an active job is attached to a non-internal
network or publishes anything except one engine-assigned
`127.0.0.1:<dynamic>:8000` mapping. There are no non-loopback/public processor
ports.

Host duties are split across four identities: `cuadrabot` (SSH/deployment),
`cuadraexec` (the trusted broker, egress, and rootless-Docker control plane),
`cuadraworker` (queue worker), and `cuadracron` (HTTPS maintenance caller).
Broker and egress intentionally share one trusted executor boundary because
both can control the same Docker daemon; worker and cron have neither socket
access nor filesystem traversal into executor state or secrets. Service units
also use `ProtectProc=invisible` and `ProcSubset=pid`.

## Files and secret handling

- `cloud-init.yaml` establishes SSH, UFW, fail2ban, unattended security
  updates, cgroup delegation, and the four least-privilege users.
- `scripts/provision-do.sh` is dry-run by default and creates the firewall,
  encrypted volume, and Droplet only with `--apply` plus an exact confirmation.
- `scripts/bootstrap-host.sh` is dry-run by default. It mounts the already
  formatted exact volume, installs Node 22 and rootless Docker, and installs
  systemd units. It never formats a device.
- `scripts/deploy-release.sh` installs an exact 40-character Git commit and
  immutable executor/processor image references, then atomically activates it.
- `scripts/validate-host.sh` is read-only. Run it before activation and after
  every host or image change.
- `scripts/rollback.sh` switches only to a previously validated local release
  and refuses to interrupt an active processor job.
- `RUNBOOK.md` covers rollout, backup, restore, incidents, and rollback.

Runtime secret files live at `/srv/cuadrabot/secrets`, owned by `root:root`,
with directory mode `0700` and file mode `0600`. PID 1 reads only the
`EnvironmentFile` assigned to each service before dropping privileges. The
egress unit stages only `egress.env` into a private `/run` directory readable by
`cuadraexec`; the worker never receives the OpenAI key or Docker configuration.
Example files contain no usable credentials. Do not place secrets in Git,
cloud-init, image layers, systemd unit text, shell arguments, or deployment
manifests.

## Deployment sequence

1. Copy `config/provision.env.example` to an ignored file outside the repo and
   set the SSH public key, its DigitalOcean fingerprint, and the operator CIDR.
   This file is sourced by Bash: keep the complete public-key line inside the
   existing single quotes so its spaces remain one shell value.
2. Run `scripts/provision-do.sh --config /secure/path/provision.env` to inspect
   the plan. Re-run with `--apply` only after reviewing the exact resources.
3. Wait for cloud-init, SSH as `cuadrabot`, copy a clean release candidate to
   the host, and run `sudo deploy/scripts/bootstrap-host.sh` for its dry run.
4. Re-run bootstrap with `--apply`. It installs examples but leaves application
   services disabled.
5. Populate `/srv/cuadrabot/secrets/{host,worker,broker,egress,cron}.env`, set
   ownership/modes, and configure optional `backup.env` if using Restic.
6. Run `sudo deploy/scripts/validate-host.sh --preflight`, then run
   `sudo deploy/scripts/deploy-release.sh COMMIT_SHA` without `--apply`.
7. Resolve every reported precondition, repeat deployment with `--apply`, and
   run the full validation again before routing public jobs.

For the budget profile, start from
`config/budget-provision.env.example` and
`config/budget-host.env.example`. It uses a 1 vCPU / 2 GiB Basic Droplet, a
10 GiB encrypted Block Storage volume, and deliberately disables paid Droplet
backups because the executor is rebuildable and authoritative inputs/results
remain outside the host. Take a temporary snapshot before risky maintenance if
needed, then remove it when the maintenance window is closed.

## Recurring DigitalOcean resources

Prices verified 6 August 2026:

| Resource | Monthly estimate | Rationale |
|---|---:|---|
| 16 GiB / 8 vCPU Basic Regular Droplet | $96.00 | Smallest selected host with comfortable headroom around a 6 GiB job |
| Weekly basic Droplet backups | $19.20 | 20% of Droplet price; boot disk only |
| 100 GiB Block Storage volume | $10.00 | $0.10/GiB-month; encrypted persistent Docker/job state |
| Cloud Firewall | $0.00 | Included |
| Optional Spaces Standard for Restic | $5.00 | Includes 250 GiB; client-side Restic encryption |
| **Required subtotal** | **$125.20** | Excludes OpenAI usage, tax, and overage |
| **With optional off-host Restic target** | **$130.20** | Recommended because Droplet backups omit volumes |

Low-volume launch profile:

| Resource | Monthly estimate | Rationale |
|---|---:|---|
| 2 GiB / 1 vCPU Basic Regular Droplet | $12.00 | Lowest profile with enough RAM to attempt one constrained processor job |
| 10 GiB encrypted Block Storage volume | $1.00 | Secrets, immutable manifests, rootless-Docker state, and transient job state |
| Droplet backups | $0.00 | Disabled; the executor is rebuildable and source/results are external |
| **Budget executor subtotal** | **$13.00** | Excludes OpenAI usage, tax, and temporary snapshots |
| Existing App Platform web service | $10.00 | Current minimum web-service plan shown by the DigitalOcean control panel |
| **Budget total baseline** | **$23.00** | The executor itself stays below $20; App Platform prevents a sub-$20 combined total |

Sources: [Droplet pricing](https://www.digitalocean.com/pricing/droplets),
[backup pricing](https://docs.digitalocean.com/products/backups/details/pricing/),
[volume pricing](https://docs.digitalocean.com/products/volumes/details/pricing/),
[Cloud Firewall pricing/behavior](https://docs.digitalocean.com/products/networking/firewalls/details/limits/),
and [Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/).
Confirm the selected slug is available in `lon1` with
`doctl compute size list --region lon1` immediately before creation.
