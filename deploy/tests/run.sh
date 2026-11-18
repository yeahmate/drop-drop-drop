#!/usr/bin/env bash
# Tests for the deployment scripts. Runs without root, systemd or a real
# server: DDD_TEST=1 points dddctl at a scratch directory.
#
#   deploy/tests/run.sh
set -uo pipefail

HERE=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")
DEPLOY=$(dirname "$HERE")
WORK=$(mktemp -d)
trap 'rm -rf -- "$WORK"' EXIT

export DDD_TEST=1
export DDD_CONF="$WORK/ddd.conf"
export DDD_SKIP_CHECK=1
WEB="$WORK/www"
REPO="$WORK/repo"
ORIGIN="$WORK/origin"
cat >"$DDD_CONF" <<CONF
DOMAIN='marks.example.org'
BRANCH='main'
KEEP=2
WEB_ROOT='$WEB'
REPO_DIR='$REPO'
CONF
mkdir -p "$WEB/releases"

PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }
check() { if "${@:2}" >/dev/null 2>&1; then ok "$1"; else bad "$1"; fi; }
refuse() { if "${@:2}" >/dev/null 2>&1; then bad "$1"; else ok "$1"; fi; }
ctl() { "$DEPLOY/dddctl" "$@"; }
live() { basename "$(readlink "$WEB/current")"; }

site() { mkdir -p "$WORK/$1"; echo "$1" >"$WORK/$1/index.html"; }

# --- syntax -----------------------------------------------------------------
for f in lib.sh dddctl install.sh harden.sh tests/run.sh; do
	check "syntax: $f" bash -n "$DEPLOY/$f"
done

# --- validators -------------------------------------------------------------
# shellcheck source=../lib.sh
. "$DEPLOY/lib.sh"
check "domain accepted" valid_domain marks.example.org
refuse "domain with a path refused" valid_domain 'example.org/x'
refuse "domain with shell characters refused" valid_domain 'a.org;reboot'
refuse "bare word refused as a domain" valid_domain localhost
check "email accepted" valid_email you@example.org
refuse "email with a quote refused" valid_email "you'@example.org"
check "release name accepted" valid_release 20261116-211500-abc1234
refuse "path refused as a release name" valid_release ../../etc
refuse "empty release name refused" valid_release ''

# --- releases ---------------------------------------------------------------
site a; site b; site c; site d
check "first release goes live" ctl _activate "$WORK/a" 20260101-000000-aaaaaaa
[ "$(live)" = 20260101-000000-aaaaaaa ] && ok "current points at it" || bad "current points at it"
[ "$(cat "$WEB/current/index.html")" = a ] && ok "site is served from current" || bad "site is served from current"

check "second release goes live" ctl _activate "$WORK/b" 20260102-000000-bbbbbbb
check "third release goes live" ctl _activate "$WORK/c" 20260103-000000-ccccccc
[ "$(live)" = 20260103-000000-ccccccc ] && ok "newest is live" || bad "newest is live"
[ ! -e "$WEB/releases/20260101-000000-aaaaaaa" ] && ok "oldest pruned beyond KEEP=2" || bad "oldest pruned beyond KEEP=2"
[ -d "$WEB/releases/20260102-000000-bbbbbbb" ] && ok "previous release kept" || bad "previous release kept"

mkdir -p "$WORK/empty"
refuse "build without index.html refused" ctl _activate "$WORK/empty" 20260104-000000-ddddddd
[ "$(live)" = 20260103-000000-ccccccc ] && ok "live site untouched by a refused build" || bad "live site untouched by a refused build"
refuse "bad release name refused" ctl _activate "$WORK/d" '../escape'
refuse "duplicate release refused" ctl _activate "$WORK/d" 20260103-000000-ccccccc

ctl releases | grep -q '^\* 20260103-000000-ccccccc (live)$' && ok "releases marks the live one" || bad "releases marks the live one"

check "rollback" ctl rollback
[ "$(live)" = 20260102-000000-bbbbbbb ] && ok "rollback went to the previous release" || bad "rollback went to the previous release"
refuse "rollback with nothing earlier refused" ctl rollback
check "rollback to a named release" ctl rollback 20260103-000000-ccccccc
[ "$(live)" = 20260103-000000-ccccccc ] && ok "named rollback applied" || bad "named rollback applied"
refuse "rollback to a missing release refused" ctl rollback 20250101-000000-fffffff
refuse "rollback to a path refused" ctl rollback ../../etc

# A live release older than the newest KEEP must survive pruning.
ctl rollback 20260102-000000-bbbbbbb >/dev/null
ctl _activate "$WORK/d" 20260105-000000-ddddddd >/dev/null
ctl rollback 20260102-000000-bbbbbbb >/dev/null 2>&1
site e; site f
ctl _activate "$WORK/e" 20260106-000000-eeeeeee >/dev/null
ctl rollback 20260102-000000-bbbbbbb >/dev/null 2>&1 || true
[ -f "$WEB/current/index.html" ] && ok "current always resolves to a complete site" || bad "current always resolves to a complete site"

# --- update: fetch, test, build, switch ---------------------------------------
git init --quiet --initial-branch=main "$ORIGIN"
(
	cd "$ORIGIN" || exit 1
	git config user.email test@example.org
	git config user.name Test
	cat >package.json <<'JSON'
{
  "name": "fake-site",
  "version": "1.0.0",
  "scripts": {
    "test": "node -e \"process.exit(require('fs').existsSync('broken') ? 1 : 0)\"",
    "build": "node -e \"require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/index.html',require('fs').readFileSync('page.txt'))\""
  }
}
JSON
	cat >package-lock.json <<'JSON'
{
  "name": "fake-site",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": { "": { "name": "fake-site", "version": "1.0.0" } }
}
JSON
	echo one >page.txt
	git add . && git commit --quiet -m one
) >/dev/null 2>&1
git clone --quiet "$ORIGIN" "$REPO" 2>/dev/null

before=$(live)
check "update builds and publishes" ctl update
[ "$(live)" != "$before" ] && ok "update switched the live release" || bad "update switched the live release"
[ "$(cat "$WEB/current/index.html")" = one ] && ok "update published the built page" || bad "update published the built page"

(cd "$ORIGIN" && echo two >page.txt && touch broken && git add . && git commit --quiet -m broken) >/dev/null 2>&1
before=$(live)
refuse "update stops when the tests fail" ctl update
[ "$(live)" = "$before" ] && ok "live site untouched by a failed update" || bad "live site untouched by a failed update"
[ "$(cat "$WEB/current/index.html")" = one ] && ok "old page still served after a failed update" || bad "old page still served after a failed update"

(cd "$ORIGIN" && git rm --quiet broken && git commit --quiet -m fixed && git tag v2) >/dev/null 2>&1
check "update to a tag" ctl update v2
[ "$(cat "$WEB/current/index.html")" = two ] && ok "tagged build published" || bad "tagged build published"
refuse "update with a hostile ref refused" ctl update 'main; reboot'
refuse "update to an unknown ref refused" ctl update no-such-branch

# --- command line -------------------------------------------------------------
check "help" ctl help
refuse "unknown command refused" ctl frobnicate
refuse "logs with a bad argument refused" ctl logs '$(reboot)'

# --- hardening dry run --------------------------------------------------------
out=$("$DEPLOY/harden.sh" --dry-run 2>&1)
echo "$out" | grep -q 'would run: dnf -y upgrade --security' && ok "harden --dry-run lists its steps" || bad "harden --dry-run lists its steps"
echo "$out" | grep -q 'Dry run: nothing was changed' && ok "harden --dry-run says it changed nothing" || bad "harden --dry-run says it changed nothing"
refuse "harden rejects unknown options" "$DEPLOY/harden.sh" --frobnicate
refuse "install needs a domain" "$DEPLOY/install.sh" --email you@example.org
refuse "install rejects a bad domain" "$DEPLOY/install.sh" --domain 'x;y' --email you@example.org

# --- Caddy template -----------------------------------------------------------
tpl="$DEPLOY/Caddyfile.template"
for token in __DOMAIN__ __EMAIL__ __WEB_ROOT__ __ACCESS_LOG__; do
	grep -q "$token" "$tpl" && ok "template has $token" || bad "template has $token"
done
filled=$(sed -e 's|__DOMAIN__|marks.example.org|g' -e 's|__EMAIL__|you@example.org|g' -e "s|__WEB_ROOT__|$WEB|g" -e 's|__ACCESS_LOG__|/var/log/caddy/x.log|g' "$tpl")
echo "$filled" | grep -q '__' && bad "no placeholders left after filling" || ok "no placeholders left after filling"
[ "$(echo "$filled" | tr -cd '{' | wc -c)" = "$(echo "$filled" | tr -cd '}' | wc -c)" ] && ok "template braces balance" || bad "template braces balance"

# --- shared server (install.sh --shared) ----------------------------------------
block=$(echo "$filled" | site_block)
echo "$block" | head -n 1 | grep -qx 'marks.example.org {' && ok "site block starts at the site" || bad "site block starts at the site"
echo "$block" | grep -q 'email' && bad "site block has no global options" || ok "site block has no global options"
echo "$block" | grep -qx $'\tlog' && ok "site block logs to the journal" || bad "site block logs to the journal"
echo "$block" | grep -q 'output file' && bad "site block writes no log file" || ok "site block writes no log file"
[ "$(echo "$block" | tr -cd '{' | wc -c)" = "$(echo "$block" | tr -cd '}' | wc -c)" ] && ok "site block braces balance" || bad "site block braces balance"

SHARED_CONF="$WORK/shared.conf"
mkdir -p "$WORK/sites"
cat "$DDD_CONF" >"$SHARED_CONF"
cat >>"$SHARED_CONF" <<CONF
SHARED=1
ACCESS_LOG=''
SITE_FILE='$WORK/sites/drop-drop-drop.caddy'
CONF
echo "$block" >"$WORK/sites/drop-drop-drop.caddy"
sctl() { DDD_CONF="$SHARED_CONF" "$DEPLOY/dddctl" "$@"; }
out=$(sctl stop 2>&1)
[ -f "$WORK/sites/drop-drop-drop.caddy.off" ] && [ ! -f "$WORK/sites/drop-drop-drop.caddy" ] && ok "shared stop switches the site off" || bad "shared stop switches the site off"
echo "$out" | grep -q 'systemctl reload caddy' && ok "shared stop reloads Caddy, never stops it" || bad "shared stop reloads Caddy, never stops it"
echo "$out" | grep -q 'systemctl stop' && bad "shared stop leaves Caddy running" || ok "shared stop leaves Caddy running"
check "shared stop again is harmless" sctl stop
check "shared start" sctl start
[ -f "$WORK/sites/drop-drop-drop.caddy" ] && ok "shared start switches the site on" || bad "shared start switches the site on"
sctl restart 2>&1 | grep -q 'systemctl reload caddy' && ok "shared restart reloads Caddy" || bad "shared restart reloads Caddy"
refuse "harden refuses on a shared server" env DDD_CONF="$SHARED_CONF" "$DEPLOY/harden.sh" --dry-run

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
