# Contributing to PITANT Charts

Install Bun 1.4.4 and Node.js 22.12 or later. GitHub Actions uses the Bun version in the root `package.json` and Node.js 22.

```sh
git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
```

## Run the checks for your change

| Area | Commands from the repository root |
| --- | --- |
| Industrial core or React bindings | `bun run typecheck`, `bun run lint`, `bun run test` |
| Industrial rendering | `bun run harness:build`, then `bun run harness:verify -- --renderers=canvas2d` |
| Dashboard charts | `bun run --filter pitant-charts check` and `bun run --filter pitant-charts palette:check` |
| Chart catalog | `bun run --filter @pitant/chart-catalog test`, `bun run catalog:build`, and `node apps/chart-catalog/scripts/check-workspace.mjs --pack` |
| shadcn registry blocks | `bun run build`, `bun run registry:validate`, and `bun run registry:typecheck` |

The browser harness needs Chrome or Chromium. Set `CHROME_BIN` if the script cannot find it. Run `bun run registry:smoke` for changes to registry items or the package API they use. The smoke test installs the blocks into a fresh Vite app and builds it.

Use `bunx lefthook install` to enable local pre-commit hooks if needed. The hooks check Biome formatting and lint on staged source files and run the industrial typecheck. Catalog source is outside the root Biome scope and has its own typecheck, build, and catalog tests.

## Document a chart change

- Document package API and behavior changes in that package’s README or public API example. Include an installable example if the change affects consumers.
- For a catalog example, compare it with the reference at the widths and themes affected by the change. Record the checked behavior and any open differences in `apps/chart-catalog/src/gallery/parity-notes.json`. Check keyboard and pointer or touch states when the variant supports them.
- Preserve license and attribution files for borrowed code or assets. Update the relevant third-party notices when adding a dependency or adapting upstream source. [Licensing scope](docs/licensing.md)

Open a pull request against `main` and include the verification you ran. Contributions to PITANT-owned source are offered under MPL-2.0. Make sure you have the rights to contribute the material you submit. For packaging and deployment procedures, see the [CI and delivery guide](docs/ci-cd.md) and [release checklist](docs/release-checklist.md).
