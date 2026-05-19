# Phase 5 Release Candidate Evidence

**Date:** 2026-05-19
**Status:** Local release candidate complete; GitHub Actions evidence pending.

## Package Evidence

`@pitant/charts` and `@pitant/charts-react` are both set to `1.0.0` with npm
public/provenance metadata, npm-safe repository URLs, README files, package
changelogs, MIT licenses, and npm publish file lists.

| Package | Dry-run version | Packed size | Files | Notable included files |
|---|---:|---:|---:|---|
| `@pitant/charts` | `1.0.0` | 125.9 kB | 22 | `README.md`, `CHANGELOG.md`, `LICENSE`, `dist`, `styles/tokens.css` |
| `@pitant/charts-react` | `1.0.0` | 75.6 kB | 7 | `README.md`, `CHANGELOG.md`, `LICENSE`, `dist` |

## Local Release Gates

All commands below passed on 2026-05-19.

```sh
bun install
bun run lint
bun run typecheck
bun run pack:dry-run
npm publish ./packages/charts --dry-run --access public
npm publish ./packages/charts-react --dry-run --access public
bun run registry:smoke
bun run release:check
git diff --check
```

`npm publish --dry-run` produced the expected npm login warning because this
machine is not authenticated to npm, but both dry-run publish commands
completed successfully and printed the `+ @pitant/...@1.0.0` publish summary.

## Registry Smoke Evidence

`bun run registry:smoke` passed. The script built registry item JSON, initialized
a fresh Vite consumer through the real shadcn CLI, dry-ran public dependencies,
installed local package tarballs for all eight registry blocks, generated a
consumer app importing every installed block, and passed consumer typecheck and
build.

Installed block count: 8.

## Browser Evidence

Local Playwright browser engines were installed for Chromium, Firefox, and
WebKit. The compact Canvas2D render smoke passed for all three local engines.

```sh
bunx playwright install chromium firefox webkit
bun run harness:build
bun run harness:cross-browser -- --browser=chromium,firefox,webkit --renderer=canvas2d --profile=compact
```

Observed result:

```text
PASS chromium/canvas2d/compact analog=234576 digital=106428
PASS firefox/canvas2d/compact analog=234576 digital=106428
PASS webkit/canvas2d/compact analog=233490 digital=106428
```

Microsoft Edge is not installed on this macOS workstation. Edge remains covered
by the configured Windows GitHub Actions matrix after the workflow file is
committed and pushed.

## GitHub Actions Status

`gh auth status` is valid for `github.com` with `repo` and `workflow` scopes.
`gh workflow list` currently reports only the remote `CI` workflow because
`.github/workflows/publish.yml` exists locally but has not been committed and
pushed to `origin/main`.

Do not dispatch the publish dry-run workflow until the local release candidate
changes are committed and pushed; dispatching now would test the remote branch,
not this working tree.

## Remaining External Evidence

- Commit and push the Phase 5 release candidate.
- Confirm the GitHub CI matrix passes, including Firefox, WebKit/Safari
  runtime, and Microsoft Edge.
- Dispatch `.github/workflows/publish.yml` with `dry_run=true`.
- Attach the GitHub Actions run URL before claiming external Phase 5 closure.
