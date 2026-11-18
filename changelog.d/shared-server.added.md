- `install.sh --shared` hosts the app on a server whose Caddy belongs to
  another project: the site is one file in `/etc/caddy/sites`, Caddy is
  reloaded instead of restarted, and nothing server-wide changes. `dddctl
  start` and `stop` then switch only this site on and off.
