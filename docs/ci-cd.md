# Continuous integration and delivery

The Bun version comes from `packageManager` in the root `package.json`. The workflows use Node.js 22 and a frozen `bun.lock`. The hoisted layout in `bunfig.toml` lets Size Limit resolve its plugin from the workspace.

## GitHub Actions

| Workflow | Trigger | Checks and outputs |
| --- | --- | --- |
| [CI](../.github/workflows/ci.yml) | Push to `main` or pull request targeting `main` | Industrial typecheck, lint, build, coverage, shadcn registry validation and types, docs build, bundle size, and package dry runs. A separate job runs the performance benchmarks. Browser jobs cover Canvas2D and WebGPU when available, plus compact rendering in Chromium, Firefox, WebKit, and Edge. |
| [Dashboard charts](../.github/workflows/charts-ui.yml) | Push or pull request affecting the dashboard workspace or shared installation inputs | Typecheck, palette checks, and validation of the `pitant-charts` archive, including exports and license files. |
| [Chart catalog](../.github/workflows/chart-catalog.yml) | Push to `main` or pull request targeting `main` with catalog or shared build changes | Version alignment, catalog tests, production builds, and validation of the archive. A push to `main` uploads `chart-catalog-site-<commit>` from `dist/`. |
| [Publish industrial packages](../.github/workflows/publish.yml) | Manual dispatch or a published GitHub Release with an `industrial-v<version>` tag | Release and registry smoke checks. A manual run defaults to npm dry-run. A real publish checks the tag against both industrial package manifests and uses the repository’s `NPM_TOKEN` to publish with provenance. |

Benchmark failures are reported independently of the build job. GitHub-hosted runners use `PITANT_BENCH_PROFILE=ci`. Local performance verification uses the strict profile by default. The browser checks cover rendering, and per-example notes record which catalog comparisons have been verified. [Catalog parity evidence](../apps/chart-catalog/PARITY.md)

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
2. Build locally with `bun run catalog:site`, or use the verified artifact for that commit. The result is `dist/` with `index.html`, static assets, and third-party notices and licenses. `.openai/hosting.json` binds the checkout to the existing private Sites project.
3. Use the Sites publishing workflow to sync the exact source commit, package the matching build, and deploy it to the existing private gallery.
4. Confirm the deployed source commit and open a chart, its **Compare** tab, and the parity view. To roll back, redeploy a previously verified version of the same Site.

The GitHub workflow builds and stores the artifact. A Sites deployment uses the existing Site’s permissions and publishing workflow. [Private chart gallery](https://chart-library-catalog.stony-boar-2041.chatgpt.site)
