# Continuous integration and delivery

The Bun version comes from `packageManager` in the root `package.json`. The workflows use Node.js 22 and a frozen `bun.lock`. The hoisted layout in `bunfig.toml` lets Size Limit resolve its plugin from the workspace.

## GitHub Actions

| Workflow | Trigger | Checks and outputs |
| --- | --- | --- |
| [CI](../.github/workflows/ci.yml) | Push to `main` or pull request targeting `main` | Industrial typecheck, lint, build, coverage, shadcn registry validation and types, docs build, bundle size, and package dry runs. A separate job runs the performance benchmarks. Browser jobs cover Canvas2D and WebGPU when available, plus compact rendering in Chromium, Firefox, WebKit, and Edge. |
| [Dashboard charts](../.github/workflows/charts-ui.yml) | Push or pull request affecting the dashboard workspace or shared installation inputs | Typecheck, palette checks, and validation of the `pitant-charts` archive, including exports and license files. |
| [Chart catalog](../.github/workflows/chart-catalog.yml) | Push to `main` or pull request targeting `main` with catalog or shared build changes | Version alignment, catalog tests, production builds, and validation of the archive. A push to `main` uploads `chart-catalog-site-<commit>` from `dist/`. |
| [Publish industrial packages](../.github/workflows/publish.yml) | Manual dispatch or a published GitHub Release with an `industrial-v<version>` tag | Release and registry smoke checks. A manual run defaults to npm dry-run. A real publish checks the tag against both manifests and requires `NPM_TOKEN` to publish with provenance. GitHub Release archives are available even when npm publishing is unconfigured. |

GitHub-hosted runners use `PITANT_BENCH_PROFILE=ci`. Local performance verification uses the strict profile by default. The catalog browser audit covers all 338 examples at desktop and mobile widths in light and dark themes.

## Reproduce checks locally

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test:coverage
bun run release:check
```

`bun run release:check` includes strict benchmarks, registry validation and typechecking, the docs build, the size check, and industrial pack dry runs. Run `bun run registry:smoke` for the fresh consumer check. For a renderer failure, build the harness, then run the affected profile with `bun run harness:verify -- --renderers=canvas2d --profiles=scatter`. Set `CHROME_BIN` to your Chrome binary if needed.

## Deliver the chart catalog

1. Use the intended `main` commit after the chart catalog check passes. The workflow artifact is named `chart-catalog-site-<commit>` so the build can be traced to its source.
2. Build locally with `bun run catalog:site`, or use the verified artifact for that commit. The result is `dist/` with `index.html`, static assets, the license, third-party notices, and `chart-catalog-source.tgz`. The gallery footer links to these files.
3. Update the Charts source revision in the PITANT Open Source GitHub Pages workflow. The workflow builds the catalog from that commit and publishes it to `/charts/`. [Open-source hub workflow](https://github.com/PITANT-Industries/pitant-open-source/blob/main/.github/workflows/pages.yml)
4. Confirm that the deployed catalog opens the correct chart guide and that the source archive, license, and notices links work. To roll back, restore a verified Charts revision in the hub workflow. [PITANT Charts](https://opensource.pitant.de/charts/)
