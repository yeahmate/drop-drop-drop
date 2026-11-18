# Deploying Drop Drop Drop

Scripts for hosting the app on a Rocky Linux 9 or 10 server with Caddy, which
fetches and renews a Let's Encrypt certificate on its own. The app is static
files; there is no application server or database.

| File | Purpose |
| --- | --- |
| `install.sh` | One-time setup: Caddy, Node.js, a deploy user, the `dddctl` command, first release |
| `harden.sh` | Server and service hardening |
| `dddctl` | Day-to-day control: start, stop, logs, update, rollback |
| `Caddyfile.template` | Web server configuration, filled in by `install.sh` |
| `lib.sh` | Settings and helpers shared by the scripts |
| `tests/run.sh` | Tests for the scripts; also run by `npm test` |

## Before you start

- A Rocky Linux 9 or 10 server with ports 80 and 443 (TCP) open to the internet.
- A domain whose A (and AAAA, if used) record already points at the server.
  Let's Encrypt checks this, so the certificate fails until DNS is right.
- A non-root user in the `wheel` group who can log in with an SSH key. The
  hardening script will not touch SSH until one exists.

## Install

```sh
sudo dnf -y install git
git clone https://github.com/yeahmate/drop-drop-drop.git
cd drop-drop-drop
sudo deploy/install.sh --domain marks.example.org --email you@example.org
```

Then harden the server. Try `--dry-run` first to see what it would do.

```sh
sudo deploy/harden.sh --dry-run
sudo deploy/harden.sh
```

After hardening, open a **new** terminal and check you can still log in
before closing the one you are in.

## On a server shared with another project

If another project already runs Caddy on the server (for example Pilot Gig
Planner), install with `--shared` and **don't run `harden.sh`**: that server's
own project looks after SSH, the firewall, fail2ban and Caddy, and
`harden.sh` refuses to run there.

```sh
sudo deploy/install.sh --shared --domain marks.example.org --email you@example.org
```

With `--shared`, `install.sh`:

- needs Caddy installed already, and the server's `/etc/caddy/Caddyfile` to end
  with `import /etc/caddy/sites/*.caddy`. It never edits the Caddyfile.
- writes this site as `/etc/caddy/sites/drop-drop-drop.caddy`, without the
  template's global options. It checks the whole server's config with the new
  file in place and takes the file out again if Caddy wouldn't load it.
- **reloads** Caddy instead of restarting it, so the other sites stay up.
- leaves the firewall alone, and logs requests to Caddy's journal like the
  server's other sites, not to a file of its own.

`dddctl` then acts on this site only: `stop` switches the site off (the file
becomes `drop-drop-drop.caddy.off`) and reloads Caddy, `start` switches it back
on, `restart` reloads Caddy, and `logs` picks this domain's requests out of
Caddy's journal. `update` and `rollback` work as usual.

## Day to day

```sh
dddctl status            # service state, live release, and a check of the site
sudo dddctl update       # fetch main, test, build, switch
sudo dddctl update v1.2  # a branch, tag or commit
sudo dddctl rollback     # back to the previous release
dddctl releases          # what is kept on the server
dddctl logs              # last 50 lines of service and access logs
dddctl logs -f           # follow the service log
sudo dddctl stop         # also: start, restart
```

`update` runs the test suite and the build as an unprivileged user. If either
fails, the live site is not touched. A new release goes live in one atomic
step, and the last five are kept for rollback (`KEEP` in
`/etc/drop-drop-drop.conf`).

Installed phones pick up a new release the next time the app is opened with
a connection; the service worker then updates in the background.

## Where things live

| Path | What |
| --- | --- |
| `/var/www/drop-drop-drop/current` | Link to the live release |
| `/var/www/drop-drop-drop/releases/` | Built releases, named by time and commit |
| `/opt/drop-drop-drop/repo` | Checkout used for building, owned by the `ddd` user |
| `/etc/drop-drop-drop.conf` | Domain, branch and number of releases kept |
| `/etc/caddy/Caddyfile` | Generated web server configuration |
| `/var/log/caddy/drop-drop-drop.log` | Access log, rotated at 10 MB, five kept |

## What the hardening script does

- Installs pending security updates and turns on automatic security updates.
- Firewall: only SSH and web traffic; removes the default cockpit and
  dhcpv6-client openings.
- SSH: keys only, no root login, fewer attempts. Applied only if a `wheel`
  user with a key exists, checked with `sshd -t`, and reloaded rather than
  restarted so open sessions survive. Skip with `--skip-ssh`.
- fail2ban for repeated failed SSH logins.
- SELinux set to enforcing if it was permissive.
- Kernel network settings against spoofed and redirected packets.
- A systemd sandbox for Caddy: read-only system, no home directories, no
  devices, only the capability to bind web ports. If Caddy will not start
  under it, the sandbox is removed and Caddy restarted.

To undo the two riskier steps:

```sh
sudo rm /etc/ssh/sshd_config.d/00-drop-drop-drop.conf && sudo systemctl reload sshd
sudo rm /etc/systemd/system/caddy.service.d/hardening.conf && sudo systemctl daemon-reload && sudo systemctl restart caddy
```

## Not yet proven on a real server

The scripts are linted and their release handling is tested, but they have
not been run on Rocky Linux. On the first run, watch for:

- Caddy and SELinux: if the site returns 403, run
  `sudo ausearch -m avc -ts recent` and `sudo restorecon -Rv /var/www/drop-drop-drop`.
- The Caddy package source: `install.sh` uses Caddy's COPR repository.
- The systemd sandbox: check `dddctl status` after `harden.sh`.
