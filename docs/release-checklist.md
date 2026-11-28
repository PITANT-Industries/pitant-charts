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

3. Install the relevant archive in a React app and exercise the affected charts and styles. Confirm the archive includes its MPL license, corresponding source, and third-party notices where applicable.
4. For a gallery update, pin the verified Charts `main` commit in the PITANT Open Source GitHub Pages workflow. [Gallery delivery](ci-cd.md#deliver-the-chart-catalog)

## Industrial npm release

1. Update the root and package changelogs and set the same SemVer version in `packages/charts/package.json` and `packages/charts-react/package.json`.
2. Run the release checks from a clean checkout.

   ```sh
   bun install --frozen-lockfile
   bun run release:check
   bun run registry:smoke
   ```

3. Run **Publish industrial packages** in GitHub Actions with `dry_run=true`. Check the release gate, registry smoke, and both npm dry runs. GitHub uses its CI benchmark profile. Local `release:check` defaults to strict targets.
4. Confirm the intended commit and create the matching `industrial-v<version>` tag, such as `industrial-v1.1.0`. Attach both `.tgz` files to the GitHub Release. The release runs the validation workflow and publishes to npm with provenance when `NPM_TOKEN` is configured. For manual npm publication, run the workflow on the matching tag with `dry_run=false`.
5. Install both release archives into a fresh React app and verify a `TimeSeries`, a `DigitalChannel`, one shadcn registry block, and PNG and SVG exports. The registry smoke task validates the archive install path. If npm publication ran, check both exact versions on npm and confirm their provenance.

## Recover from a failed release

- For a gallery issue, restore a verified Charts revision in the PITANT Open Source GitHub Pages workflow and check the deployed catalog.
- If npm fails before either package publishes, fix the error and repeat the release workflow. If one package is already available, inspect npm for both exact versions and publish the missing package from the same verified commit and tag using npm provenance. Confirm both before announcing the release.
- If a broken package version reaches npm, deprecate it with a clear message and publish a patch.
