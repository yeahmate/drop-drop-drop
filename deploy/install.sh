#!/usr/bin/env bash
# Set up a Rocky Linux 9 or 10 server to host Drop Drop Drop: Caddy with
# automatic Let's Encrypt HTTPS, Node.js for building, a deploy user, and the
# dddctl command. Safe to run again; it only changes what is not already set.
#
#   sudo deploy/install.sh --domain marks.example.org --email you@example.org
#
# On a server whose Caddy belongs to another project, add --shared: the site
# becomes one file in /etc/caddy/sites, Caddy is reloaded rather than
# restarted, and the Caddyfile and firewall are left alone.
set -euo pipefail

HERE=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
# shellcheck source=lib.sh
. "$HERE/lib.sh"

usage() {
	cat <<USAGE
Usage: sudo deploy/install.sh --domain <name> --email <address> [options]

  --domain <name>    Domain already pointing at this server (needed for HTTPS)
  --email <address>  Contact for Let's Encrypt expiry notices
  --branch <name>    Branch to deploy (default: $BRANCH)
  --repo <url>       Git repository (default: $REPO_URL)
  --no-deploy        Set everything up but do not build and publish yet
  --shared           Another project runs this server's Caddy: add this site
                     as $SITE_FILE and change nothing
                     server-wide (needs the Caddyfile to import $SITES_DIR/*.caddy)
USAGE
}

DEPLOY=1
while [ $# -gt 0 ]; do
	case "$1" in
		--domain) DOMAIN=${2:-}; shift ;;
		--email) EMAIL=${2:-}; shift ;;
		--branch) BRANCH=${2:-}; shift ;;
		--repo) REPO_URL=${2:-}; shift ;;
		--no-deploy) DEPLOY=0 ;;
		--shared) SHARED=1 ;;
		-h | --help) usage; exit 0 ;;
		*) usage >&2; exit 2 ;;
	esac
	shift
done

need_root "$@"
need_rocky
valid_domain "$DOMAIN" || die "Give the site's domain: --domain marks.example.org"
valid_email "$EMAIL" || die "Give a contact email for Let's Encrypt: --email you@example.org"
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "Not a branch name: $BRANCH"
[[ "$REPO_URL" =~ ^https://[A-Za-z0-9._/:-]+$ ]] || die "The repository must be an https:// URL."

if [ "$SHARED" = 1 ]; then
	command -v caddy >/dev/null || die "--shared needs Caddy already installed and running."
	grep -Eq "^[[:space:]]*import[[:space:]]+$SITES_DIR/\*\.caddy" /etc/caddy/Caddyfile 2>/dev/null \
		|| die "/etc/caddy/Caddyfile doesn't import $SITES_DIR/*.caddy. Update the project that owns it, or add that line at its end, then run this again."
	# Only an access log of its own, in the journal; nothing else of Caddy's changes.
	ACCESS_LOG=
fi

say "Installing packages"
if [ "$SHARED" = 1 ]; then
	dnf -y install git curl tar policycoreutils
else
	dnf -y install git curl tar policycoreutils firewalld 'dnf-command(copr)'
fi
if ! command -v caddy >/dev/null; then
	# Caddy's own repository, as its documentation gives for RHEL-family systems.
	dnf -y copr enable @caddy/caddy
	dnf -y install caddy
fi

say "Installing Node.js"
if ! command -v node >/dev/null; then
	# Rocky 9 ships an old default; pick the Node.js 22 module stream where
	# streams exist. Rocky 10 has no streams and ships a current Node.js.
	dnf -y module enable nodejs:22 2>/dev/null || true
	dnf -y install nodejs npm
fi
node -e '
	const [major, minor] = process.versions.node.split(".").map(Number)
	if (major < 20 || (major === 20 && minor < 19)) {
		console.error(`Node.js ${process.versions.node} is too old; the build needs 20.19 or newer.`)
		process.exit(1)
	}
' || die "Install Node.js 22 (dnf module reset nodejs && dnf module enable nodejs:22) and run this again."

say "Creating the deploy user and directories"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
	useradd --system --home-dir /opt/drop-drop-drop --create-home --shell /sbin/nologin "$DEPLOY_USER"
fi
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 /opt/drop-drop-drop
install -d -o root -g root -m 755 "$WEB_ROOT" "$WEB_ROOT/releases"
[ -n "$ACCESS_LOG" ] && install -d -o caddy -g caddy -m 750 "$(dirname "$ACCESS_LOG")"

if [ ! -d "$REPO_DIR/.git" ]; then
	say "Cloning $REPO_URL"
	as_deploy git clone --quiet "$REPO_URL" "$REPO_DIR"
else
	as_deploy git -C "$REPO_DIR" remote set-url origin "$REPO_URL"
fi

say "Writing $CONF_FILE"
umask 022
cat >"$CONF_FILE" <<CONF
# Drop Drop Drop server settings, read by dddctl. Written by deploy/install.sh.
DOMAIN='$DOMAIN'
EMAIL='$EMAIL'
REPO_URL='$REPO_URL'
BRANCH='$BRANCH'
# Releases kept on the server for rollback.
KEEP=$KEEP
# 1: another project owns this server's Caddy (install.sh --shared).
SHARED=$SHARED
ACCESS_LOG='$ACCESS_LOG'
CONF

say "Installing dddctl"
install -d -m 755 /usr/local/lib/drop-drop-drop
install -m 644 "$HERE/lib.sh" /usr/local/lib/drop-drop-drop/lib.sh
install -m 755 "$HERE/dddctl" /usr/local/bin/dddctl

say "Configuring Caddy for $DOMAIN"
fill_template() {
	sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__EMAIL__|$EMAIL|g" \
		-e "s|__WEB_ROOT__|$WEB_ROOT|g" -e "s|__ACCESS_LOG__|$ACCESS_LOG|g" \
		"$HERE/Caddyfile.template"
}
if [ "$SHARED" = 1 ]; then
	# Write the site's file, then check the whole server's config with it. If
	# that fails, put back what was there, so the other sites are untouched.
	install -d -m 755 "$SITES_DIR"
	[ -f "$SITE_FILE" ] && cp -p "$SITE_FILE" "$SITE_FILE.before"
	rm -f "$SITE_FILE.off"
	fill_template | site_block >"$SITE_FILE"
	chmod 644 "$SITE_FILE"
	restorecon -R "$SITES_DIR" "$WEB_ROOT" 2>/dev/null || true
	if ! runuser -u caddy -- caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile >/dev/null; then
		if [ -f "$SITE_FILE.before" ]; then mv "$SITE_FILE.before" "$SITE_FILE"; else rm -f "$SITE_FILE"; fi
		die "Caddy wouldn't load the config with this site; nothing was changed. See: caddy validate --config /etc/caddy/Caddyfile"
	fi
	rm -f "$SITE_FILE.before"
else
	[ -f /etc/caddy/Caddyfile ] && [ ! -f /etc/caddy/Caddyfile.before-ddd ] \
		&& cp -p /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-ddd
	fill_template >/etc/caddy/Caddyfile.new
	caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile.new >/dev/null \
		|| die "The generated Caddy configuration is invalid; left at /etc/caddy/Caddyfile.new."
	mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
	restorecon -R /etc/caddy "$WEB_ROOT" 2>/dev/null || true

	say "Opening the firewall for web traffic"
	systemctl enable --now firewalld
	firewall-cmd --quiet --permanent --add-service=http --add-service=https
	firewall-cmd --quiet --permanent --add-port=443/udp
	firewall-cmd --quiet --reload
fi

if [ "$DEPLOY" = 1 ]; then
	say "Building and publishing the first release"
	DDD_SKIP_CHECK=1 /usr/local/bin/dddctl update "$BRANCH"
fi

if [ "$SHARED" = 1 ]; then
	# A reload keeps the other sites up; Caddy keeps the old config if it fails.
	systemctl reload caddy
	NEXT="Don't run harden.sh here: the server's own project looks after SSH,
the firewall and Caddy."
else
	systemctl enable caddy
	systemctl restart caddy
	NEXT="Next: sudo deploy/harden.sh"
fi

cat <<DONE

Done. Caddy is fetching a certificate for $DOMAIN; this takes a few seconds
and needs ports 80 and 443 reachable from the internet.

  dddctl status     check the site
  dddctl logs -f    watch the certificate being issued
  dddctl update     deploy the latest $BRANCH

$NEXT
DONE
