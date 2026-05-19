# Release Checklist

This checklist is the repeatable v1 release gate for `@pitant/charts`,
`@pitant/charts-react`, and the shadcn registry blocks.

## Preconditions

- `CHANGELOG.md` has an entry for the release version.
- `packages/charts/package.json` and `packages/charts-react/package.json` use
  the intended SemVer version.
- `bun.lock` is current and the worktree has no unrelated release changes.
- `NPM_TOKEN` is configured in GitHub Actions for provenance publishing.

## Local Gate

Run from a clean checkout:

```bash
bun install --frozen-lockfile
bun run release:check
bun run registry:smoke
```

The release is blocked if any test, benchmark, docs build, registry check,
bundle-size gate, or package dry-run fails.

`registry:smoke` is intentionally not part of the default PR `release:check`
script because it downloads and runs the external shadcn CLI, initializes a
fresh Vite consumer, and packs local tarballs. It is mandatory for maintainer
release dry-runs and publish runs, and optional for ordinary feature PRs unless
registry files or package metadata changed.

## Publish Gate

1. Create or update the GitHub release notes from `CHANGELOG.md`.
2. Commit and push the release candidate so `.github/workflows/publish.yml`
   exists on the target branch.
3. Trigger `.github/workflows/publish.yml` with `dry_run=true`.
4. Confirm both packages pass `npm publish --dry-run`.
5. Publish a GitHub release or rerun the workflow with `dry_run=false`.
6. Confirm npm provenance is visible for both published packages.

## Post-Publish Smoke

Run the registry smoke test after packages are visible:

```bash
bun run registry:smoke
```

Then install the packages into a fresh Vite app and render:

- one `TimeSeries` chart,
- one `DigitalChannel` chart,
- one shadcn registry block,
- one PNG export,
- one SVG export.

## Rollback

- If npm publish fails before either package is published, fix and rerun.
- If only one package is published, publish the missing package at the same
  version before making downstream registry claims.
- If a broken version reaches npm, deprecate it with a clear message and ship a
  patch version; do not unpublish unless the package contains secrets or
  legally restricted content.
