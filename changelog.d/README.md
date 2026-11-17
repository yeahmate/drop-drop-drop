# Changelog fragments

Every pull request that changes what a user or host would notice adds one
small file here instead of editing `CHANGELOG.md`. Each change has its own
file, so two branches never conflict.

## Adding one

Name the file `<short-name>.<type>.md`, lower case with hyphens:

```
changelog.d/magnetic-variation.added.md
```

| Type | For |
| --- | --- |
| `added` | New features |
| `changed` | Changes to how something existing works |
| `fixed` | Bug fixes |
| `removed` | Features taken out |
| `security` | Fixes and hardening that hosts should know about |

The file holds one or more bullets, written for someone using the app:

```md
- Bearings can be shown as magnetic or true, with variation worked out from
  the reference position.
```

No headings; the release step adds them. A change with two types gets two
files with the same short name.

## Checking

`npm test` fails if a fragment is misnamed or malformed. To look at what is
pending:

```sh
npm run changelog -- check
npm run changelog -- preview
```

## Releasing

```sh
npm run changelog -- release 0.2.0
```

This writes a dated section at the top of `CHANGELOG.md`, grouped by type,
and deletes the fragments. Review the result and commit it with the version
bump.
