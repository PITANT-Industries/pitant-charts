# Release checklist

The dashboard package and catalog workspace share a version. The industrial core and React bindings use a separate version and publish together. [Workflow and deployment details](ci-cd.md)

## Dashboard and catalog

1. Update `packages/charts-ui/package.json` and `apps/chart-catalog/package.json` together when releasing this pair. Refresh `bun.lock` with the repository’s Bun version.
2. Build and check both archives from the workspace root.

   ```sh
   bun install --frozen-lockfile
   bun run --filter pitant-charts check
   bun run --filter pitant-charts palette:check
   (cd packages/charts-ui && bun pm pack --quiet && bun scripts/check-package.ts pitant-charts-*.tgz)
   bun run --filter @pitant/chart-catalog test
   bun run catalog:build
   node apps/chart-catalog/scripts/check-workspace.mjs --pack
   npm pack --ignore-scripts ./apps/chart-catalog
   ```

3. Install the relevant archive in a React app and exercise the affected charts and styles. Check license and notice files in what you distribute.
4. For a gallery update, use the verified build and exact `main` commit with the private Sites workflow. [Gallery delivery](ci-cd.md#deliver-the-chart-catalog)

## Industrial npm release

1. Update the root and package changelogs and set the same SemVer version in `packages/charts/package.json` and `packages/charts-react/package.json`.
2. Run the release checks from a clean checkout.

   ```sh
   bun install --frozen-lockfile
   bun run release:check
   bun run registry:smoke
   ```

3. Run **Publish industrial packages** in GitHub Actions with `dry_run=true`. Check the release gate, registry smoke, and both npm dry runs. GitHub uses its CI benchmark profile. Local `release:check` defaults to strict targets.
4. Confirm the intended commit and create the matching `industrial-v<version>` tag, such as `industrial-v1.0.0`. A published GitHub Release with that tag triggers publication. For manual publication, run the workflow on the matching tag with `dry_run=false`. The publishing step uses the repository’s `NPM_TOKEN` secret.
5. Check both exact versions on npm and confirm their provenance. Install both into a fresh React app and verify a `TimeSeries`, a `DigitalChannel`, one shadcn registry block, and PNG and SVG exports. The registry smoke task validates the local archive install path.

## Recover from a failed release

- For a private gallery issue, redeploy a previously verified version of the same Site and confirm its source commit.
- If npm fails before either package publishes, fix the error and repeat the release workflow. If one package is already available, inspect npm for both exact versions and publish the missing package from the same verified commit and tag using npm provenance. Confirm both before announcing the release.
- If a broken package version reaches npm, deprecate it with a clear message and publish a patch.
