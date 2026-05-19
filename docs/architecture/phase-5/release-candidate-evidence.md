# Phase 5 Release Candidate Evidence

**Date:** 2026-05-19
**Status:** Release candidate closed; PR CI, main CI, and publish dry-run passed.

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

Draft PR: https://github.com/PITANT-Industries/pitant-charts/pull/1

First PR CI run, failed:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26088799878

Second PR CI run, failed before browser verifier/runtime fixes:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089123123

Passing PR CI run before the evidence-only commit:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089497306

Captured passing PR CI run after verifier/runtime fixes:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089639951

Final passing PR CI run after evidence cleanup:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089906506

Merged PR:
https://github.com/PITANT-Industries/pitant-charts/pull/1

Passing main CI run after merge:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090111139

Passing main CI run after publish-workflow benchmark-profile fix:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090260058

Passing run coverage:

- `build (22)`: typecheck, lint, build, tests, CI benchmark profile, registry
  validation/typecheck, docs build, bundle-size gate, and package dry-run.
- `browser-smoke (canvas2d)`: harness build, pixel smoke, FPS smoke.
- `browser-smoke (webgpu)`: harness build, pixel/FPS smoke with capability
  skip where `navigator.gpu` is unavailable.
- `cross-browser-smoke`: Chromium, Firefox, WebKit/Safari runtime, and
  Microsoft Edge compact Canvas2D render output.

Observed failures and fixes:

- Browser harness jobs failed on a fresh checkout because `harness:build`
  compiled `apps/render-harness` before package `dist` declarations existed.
  The root `harness:build` script now rebuilds `@pitant/charts` and
  `@pitant/charts-react` before compiling the harness.
- Browser pixel smoke then reached the verifier but failed before rendering
  because GitHub's shell `node` was v20.20.2 and did not provide global
  `WebSocket` for the CDP client. The CDP verifier scripts now run under Bun,
  while the Playwright cross-browser script remains on Node.
- The Windows Edge job rendered a valid compact Canvas2D chart but stayed alive
  until run cancellation because the spawned Vite process tree was not torn down
  on Windows. Browser harness cleanup now uses `taskkill /T /F` for Windows
  child process trees.
- The build job failed in `bun run bench` on shared GitHub runners for
  `007_streaming_append`, `016_data_source_live_append_query_4pens`, and
  `019_cursor_propagation_4panels_latency`. The strict local benchmark remains
  the release-candidate performance gate. CI now sets
  `PITANT_BENCH_PROFILE=ci`, which only relaxes those noisy shared-runner
  latency gates and refuses baseline updates outside strict mode.
- The first publish workflow dry-run failed in the same strict hosted-runner
  benchmark path before npm dry-run. The publish workflow release gate now uses
  `PITANT_BENCH_PROFILE=ci` for GitHub-hosted runner variance while preserving
  strict local `bun run release:check` as the performance claim.

Local verification after the CI-fix patch:

```sh
bun run lint
bun run typecheck
bun run bench
PITANT_BENCH_PROFILE=ci bun run bench
bun run harness:build
bun run harness:verify -- --renderers=canvas2d
bun run harness:fps -- --renderers=canvas2d
bun run harness:cross-browser -- --browser=chromium --renderer=canvas2d --profile=compact
```

All listed commands passed on 2026-05-19.

`gh workflow list` reports the remote `CI` and `Publish` workflows after the
release-candidate PR was merged to `main`.

## External Publish Evidence

First publish dry-run attempt, failed in the hosted-runner strict benchmark
gate before package dry-run:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090129223

Passing publish dry-run after aligning the workflow benchmark profile with CI:
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090262210

Passing publish dry-run coverage:

- `Release gate`: build, typecheck, lint, tests, CI benchmark profile, registry
  validation/typecheck, docs build, bundle-size gate, and package dry-run.
- `Registry smoke gate`: shadcn registry consumer smoke with all eight blocks.
- `Publish dry run`: `npm publish ./packages/charts --dry-run --access public`
  and `npm publish ./packages/charts-react --dry-run --access public`.
- `Publish with npm provenance`: skipped because the workflow was dispatched
  with `dry_run=true`.
