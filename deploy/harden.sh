#!/usr/bin/env bash
# Harden a Rocky Linux 9 or 10 server running Drop Drop Drop. Safe to run
# again. Each step checks before it changes anything, and the two steps that
# could cut off access (SSH and the web service sandbox) are tested and
# rolled back if they fail.
#
#   sudo deploy/harden.sh              apply everything
#   sudo deploy/harden.sh --dry-run    show what would change
#   sudo deploy/harden.sh --skip-ssh   leave SSH settings alone
set -euo pipefail

HERE=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
# shellcheck source=lib.sh
. "$HERE/lib.sh"

DRY=0
SKIP_SSH=0
for arg in "$@"; do
	case "$arg" in
		--dry-run) DRY=1 ;;
		--skip-ssh) SKIP_SSH=1 ;;
		-h | --help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) die "Unknown option: $arg" ;;
	esac
done

need_root "$@"
need_rocky
[ "$SHARED" = 1 ] && die "This server is shared (install.sh --shared): its own project looks after SSH, the firewall, fail2ban and Caddy. harden.sh would change them for every site, so it doesn't run here."

# Run a command, or only print it with --dry-run.
run() {
	if [ "$DRY" = 1 ]; then printf '    would run: %s\n' "$*"; else "$@"; fi
}

# Write stdin to a file, or only say so with --dry-run.
write() {
	if [ "$DRY" = 1 ]; then printf '    would write: %s\n' "$1"; cat >/dev/null; else cat >"$1"; fi
}

SSH_DROPIN=/etc/ssh/sshd_config.d/00-drop-drop-drop.conf
CADDY_DROPIN=/etc/systemd/system/$SERVICE.service.d/hardening.conf

updates() {
	say "Security updates: install now, then automatically"
	run dnf -y upgrade --security
	run dnf -y install dnf-automatic
	if [ "$DRY" = 1 ]; then
		echo "    would set upgrade_type = security and apply_updates = yes in /etc/dnf/automatic.conf"
	else
		sed -i -e 's/^upgrade_type *=.*/upgrade_type = security/' \
			-e 's/^apply_updates *=.*/apply_updates = yes/' /etc/dnf/automatic.conf
	fi
	run systemctl enable --now dnf-automatic.timer
}

firewall() {
	say "Firewall: allow SSH and web traffic only"
	run dnf -y install firewalld
	run systemctl enable --now firewalld
	local zone svc
	zone=$(firewall-cmd --get-default-zone 2>/dev/null || echo public)
	run firewall-cmd --quiet --permanent --zone="$zone" --add-service=ssh --add-service=http --add-service=https
	run firewall-cmd --quiet --permanent --zone="$zone" --add-port=443/udp
	# Rocky opens these by default; nothing here uses them.
	for svc in cockpit dhcpv6-client; do
		if firewall-cmd --quiet --permanent --zone="$zone" --query-service="$svc" 2>/dev/null; then
			run firewall-cmd --quiet --permanent --zone="$zone" --remove-service="$svc"
		fi
	done
	run firewall-cmd --quiet --reload
}

# A user who can log in with a key and become root, so disabling root and
# password logins cannot lock the server.
admin_with_key() {
	local user home
	for user in $(getent group wheel | cut -d: -f4 | tr ',' ' '); do
		[ "$user" = root ] && continue
		home=$(getent passwd "$user" | cut -d: -f6)
		if [ -n "$home" ] && [ -s "$home/.ssh/authorized_keys" ]; then
			printf '%s\n' "$user"
			return 0
		fi
	done
	return 1
}

ssh_hardening() {
	say "SSH: keys only, no root login"
	if [ "$SKIP_SSH" = 1 ]; then
		echo "    skipped (--skip-ssh)"
		return 0
	fi
	local admin
	if ! admin=$(admin_with_key); then
		warn "SSH left unchanged: no user in the wheel group has an SSH key."
		warn "Create one first, check you can log in and sudo with it, then run this again:"
		warn "  useradd -m -G wheel <name> && passwd <name>"
		warn "  install -d -m 700 -o <name> -g <name> /home/<name>/.ssh"
		warn "  copy your public key to /home/<name>/.ssh/authorized_keys (mode 600, owned by <name>)"
		return 0
	fi
	echo "    admin user with a key: $admin"
	grep -Eq '^\s*Include\s+/etc/ssh/sshd_config\.d/' /etc/ssh/sshd_config \
		|| { warn "SSH left unchanged: /etc/ssh/sshd_config does not include sshd_config.d."; return 0; }

	# The first value sshd reads wins, so this file sorts ahead of the others.
	write "$SSH_DROPIN" <<'CONF'
# Drop Drop Drop hardening. Written by deploy/harden.sh.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
CONF
	[ "$DRY" = 1 ] && return 0
	chmod 600 "$SSH_DROPIN"
	if ! sshd -t; then
		rm -f "$SSH_DROPIN"
		warn "SSH left unchanged: the new settings failed sshd's own check."
		return 0
	fi
	systemctl reload sshd
	echo "    Open a NEW terminal and check you can still log in as $admin before closing this one."
	echo "    To undo: rm $SSH_DROPIN && systemctl reload sshd"
}

fail2ban() {
	say "fail2ban: block addresses that keep failing SSH logins"
	run dnf -y install epel-release
	run dnf -y install fail2ban fail2ban-firewalld
	write /etc/fail2ban/jail.d/drop-drop-drop.local <<'CONF'
# Written by deploy/harden.sh.
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
banaction = firewallcmd-rich-rules

[sshd]
enabled = true
CONF
	run systemctl enable --now fail2ban
	run systemctl restart fail2ban
}

selinux() {
	say "SELinux: enforcing"
	local mode
	mode=$(getenforce 2>/dev/null || echo Unknown)
	case "$mode" in
		Enforcing) echo "    already enforcing" ;;
		Permissive)
			run setenforce 1
			[ "$DRY" = 1 ] || sed -i 's/^SELINUX=.*/SELINUX=enforcing/' /etc/selinux/config
			;;
		*)
			warn "SELinux is $mode. Set SELINUX=enforcing in /etc/selinux/config and reboot;"
			warn "the first boot relabels the disk and takes a few minutes."
			;;
	esac
}

kernel() {
	say "Kernel and network settings"
	write /etc/sysctl.d/90-drop-drop-drop.conf <<'CONF'
# Drop Drop Drop hardening. Written by deploy/harden.sh.
# Ignore spoofed, redirected and source-routed packets.
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.log_martians = 1
# Hide kernel addresses and logs from ordinary users.
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
CONF
	run sysctl --quiet --system
}

# Confine the web server: it may read the site, write its own state and logs,
# and bind the web ports. Nothing else.
service_sandbox() {
	say "Web service sandbox"
	if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
		echo "    $SERVICE is not installed yet; run deploy/install.sh, then this again"
		return 0
	fi
	run install -d -m 755 "$(dirname "$CADDY_DROPIN")"
	write "$CADDY_DROPIN" <<CONF
# Drop Drop Drop hardening. Written by deploy/harden.sh.
[Service]
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/caddy $(dirname "$ACCESS_LOG")
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
UMask=0027
CONF
	[ "$DRY" = 1 ] && return 0
	systemctl daemon-reload
	if ! systemctl is-active --quiet "$SERVICE"; then
		echo "    $SERVICE is not running; the sandbox applies when it next starts"
		return 0
	fi
	systemctl restart "$SERVICE" || true
	sleep 2
	if ! systemctl is-active --quiet "$SERVICE"; then
		rm -f "$CADDY_DROPIN"
		systemctl daemon-reload
		systemctl restart "$SERVICE"
		warn "The sandbox stopped $SERVICE from starting, so it was removed and the service restarted."
		warn "See: journalctl -u $SERVICE -n 50"
	fi
}

report() {
	[ "$DRY" = 1 ] && { echo; say "Dry run: nothing was changed."; return 0; }
	echo
	say "Summary"
	printf '    SELinux:            %s\n' "$(getenforce 2>/dev/null || echo unknown)"
	printf '    Firewall services:  %s\n' "$(firewall-cmd --list-services 2>/dev/null || echo unknown)"
	printf '    Automatic updates:  %s\n' "$(systemctl is-active dnf-automatic.timer 2>/dev/null || true)"
	printf '    fail2ban:           %s\n' "$(systemctl is-active fail2ban 2>/dev/null || true)"
	printf '    SSH hardening:      %s\n' "$([ -f "$SSH_DROPIN" ] && echo applied || echo 'not applied')"
	printf '    Service sandbox:    %s\n' "$([ -f "$CADDY_DROPIN" ] && echo applied || echo 'not applied')"
	printf '    Web server:         %s\n' "$(systemctl is-active "$SERVICE" 2>/dev/null || true)"
	if command -v systemd-analyze >/dev/null && [ -f "$CADDY_DROPIN" ]; then
		printf '    Exposure score:     %s\n' "$(systemd-analyze security "$SERVICE" 2>/dev/null | tail -n 1)"
	fi
}

updates
firewall
ssh_hardening
fail2ban
selinux
kernel
service_sandbox
report
