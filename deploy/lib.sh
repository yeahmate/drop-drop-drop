#!/usr/bin/env bash
# Shared settings and helpers for the deployment scripts. Sourced, not run.
# shellcheck disable=SC2034  # the settings are used by the scripts that source this

CONF_FILE=${DDD_CONF:-/etc/drop-drop-drop.conf}

# Defaults; install.sh writes the real values to $CONF_FILE.
DOMAIN=
EMAIL=
REPO_URL=https://github.com/yeahmate/drop-drop-drop.git
BRANCH=main
KEEP=5
DEPLOY_USER=ddd
REPO_DIR=/opt/drop-drop-drop/repo
WEB_ROOT=/var/www/drop-drop-drop
SERVICE=caddy
ACCESS_LOG=/var/log/caddy/drop-drop-drop.log

# shellcheck source=/dev/null
[ -r "$CONF_FILE" ] && . "$CONF_FILE"

# DDD_TEST=1 lets the test suite exercise release handling without root,
# systemd, SELinux or a deploy user.
TEST_MODE=${DDD_TEST:-0}

say() { printf '==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

need_root() {
	[ "$TEST_MODE" = 1 ] && return 0
	[ "$(id -u)" -eq 0 ] || die "Run this as root (sudo $0 $*)."
}

# Rocky Linux 9 or 10. Rocky 8's OpenSSH and Node.js are too old for these scripts.
need_rocky() {
	[ "$TEST_MODE" = 1 ] && return 0
	[ -r /etc/os-release ] || die "Cannot read /etc/os-release."
	# shellcheck source=/dev/null
	. /etc/os-release
	case "${ID:-}:${VERSION_ID%%.*}" in
		rocky:9 | rocky:10) ;;
		*) die "These scripts support Rocky Linux 9 and 10. Found: ${PRETTY_NAME:-unknown}." ;;
	esac
}

# Run a command as the unprivileged deploy user.
as_deploy() {
	if [ "$TEST_MODE" = 1 ]; then
		"$@"
	else
		runuser -u "$DEPLOY_USER" -- "$@"
	fi
}

valid_domain() {
	[[ "$1" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]
}

valid_email() {
	[[ "$1" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]
}

# Release names are made by dddctl: UTC timestamp, then the commit.
valid_release() {
	[[ "$1" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{7,40}$ ]]
}
