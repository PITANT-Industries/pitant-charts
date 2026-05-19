# Session State

**Date:** 2026-05-19
**Current phase:** Phase 6 - Post-v1 Industrial Chart Packs
**Latest action:** Closed Phase 5 externally. PR #1 was merged to `main`, main
CI passed, `.github/workflows/publish.yml` became available on the default
branch, and the publish workflow dry-run passed after aligning its hosted-runner
benchmark profile with CI while preserving strict local benchmarks as the
release performance gate.

## What Exists

- Bun monorepo with `@pitant/charts`, `@pitant/charts-react`, and benchmark app.
- Render harness app with compact/large data profiles and renderer selection.
- Core render contexts for WebGPU and Canvas2D.
- Worker-backed data engine and LOD pyramid.
- Benchmark suite includes 8-pen TimeSeries and 16-channel DigitalChannel
  render-plan gates.
- Streaming append path keeps the existing `DataSource` hot path for concrete
  chart hooks and falls back to full reload only for replacement/schema changes.
- `DataSource` preserves quality flags and gap metadata through viewport query
  results with a benchmark gate for quality mapping overhead.
- High-DPI resize path is explicit: backing stores are DPR-sized, chart hooks
  invalidate on DPR changes, and Canvas2D/WebGPU receive the same DPR.
- Generic `useChart()` exposes renderer initialization failures through
  `error: Error | null` and reports unsupported generic data controls
  explicitly; concrete chart hooks already combine renderer and viewport/data
  errors.
- `TimeSeries` and `DigitalChannel` hooks expose a `layout` object with plot,
  axis, legend, overlay, and tick geometry; render plans can draw into the
  reserved plot area instead of the full canvas.
- Axis tick labels and axis titles render as screen-space text commands without
  disturbing data-space grid and series transforms.
- Historian query rows and trend fixtures can be adapted into TimeSeries
  columnar data without pulling in a runtime dependency on `pitant-historian`.
- Non-React consumers can use `TimeSeriesChart` and `DigitalChannelChart`
  directly against a `RenderContext` or create them from a canvas.
- Docs examples now cover React trend composition, digital channel lanes,
  synchronized dashboards, and core imperative chart usage.
- Initial frontend contract packs exist for historian trends, digital channels,
  and synchronized dashboards.
- Render harness accepts `?renderer=` and `?profile=` query parameters and
  publishes lightweight browser state for verification.
- Browser screenshot/pixel sanity checks cover Canvas2D and WebGPU-capable
  environments without adding a browser-test dependency.
- Visual regression checks compare cropped chart regions against checked-in
  compact and large Canvas2D baselines while skipping WebGPU when the local
  browser denies `navigator.gpu`.
- Browser FPS checks run through `scripts/verify-render-harness.mjs --fps` and
  measure interaction frame loops on Canvas2D plus WebGPU when the browser
  exposes `navigator.gpu`.
- Live-append interaction regression coverage proves `TimeSeries` can append
  streaming data through `DataSource` and still process wheel zoom through the
  mounted React interaction layer.
- Tooltip payloads and default tooltip rendering now expose quality, gap, and
  provenance metadata when upstream adapters provide it.
- Initial shadcn registry artifacts exist: root `registry.json`, four
  installable block source files under `registry/pitant/`, `registry:validate`,
  and `registry:typecheck`.
- `registry:smoke` exercises the real shadcn CLI against a fresh Vite consumer
  app and verifies all initial registry blocks can be installed, imported,
  typechecked, and bundled before npm publication.
- The expanded registry has eight installable blocks: TimeSeries,
  DigitalChannel, synchronized dashboard, DataZoom, streaming live-edge trend,
  multi-axis panels, PNG export wiring, and dashboard overview.
- Live docs app exists at `apps/docs-site` with selectable live registry block
  examples and quick-start guidance. Root scripts: `docs:dev`, `docs:build`,
  and `docs:preview`.
- First-run Markdown quick start exists at `docs/quick-start.md`.
- PNG export honors explicit CSS-pixel width, height, background, and
  pixel-ratio options for concrete chart hooks.
- SVG export for TimeSeries and DigitalChannel is command-list/vector based,
  clipped to the plot area, includes screen-space axis text, and does not embed
  raster image payloads.
- Vitest resolves `@pitant/charts` to source during tests, while root
  `typecheck` rebuilds core declarations before checking the React package.
- Release artifacts now exist: `CHANGELOG.md`, `docs/release-checklist.md`,
  `pack:dry-run`, `release:check`, and `.github/workflows/publish.yml` with
  npm provenance publishing.
- Package release artifacts now exist under both packages: `README.md`,
  `CHANGELOG.md`, `LICENSE`, v1.0.0 package metadata, npm keywords, and public
  provenance publish config.
- The release checklist declares `registry:smoke` mandatory for maintainer
  dry-runs and publish runs, but keeps it out of ordinary PR `release:check`
  because it invokes external shadcn CLI and fresh consumer project install
  work.
- Bundle-size limits cover both package entrypoints and CI now runs benchmarks,
  registry checks, docs build, package dry-run, and browser harness smoke/FPS
  checks.
- Playwright cross-browser render smoke exists through
  `scripts/verify-cross-browser.mjs`, with CI matrix coverage for Chromium,
  Firefox, WebKit/Safari runtime, and Microsoft Edge compact Canvas2D output.
- Pointer coordinate mapping helpers are exported from `@pitant/charts` and
  covered by tests for scaled DOM viewports, out-of-plot detection, clamping,
  and reverse data-to-chart mapping.
- `ChartRegionZoomLayer` is exported from `@pitant/charts-react` and is mounted
  under concrete chart components before user overlays, so legend/tool overlays
  remain clickable.
- Wheel/trackpad zoom is implemented in `ChartRegionZoomLayer` with cursor
  anchoring, axis-only range changes, full-range clamping, and focused tests.
- Hover crosshair and nearest-point tooltip payloads are implemented for
  TimeSeries and DigitalChannel using a core binary-search timestamp lookup.
- TimeSeries and DigitalChannel participate in `ChartSyncGroup` with stable
  `chartKey` identities, synchronized x-ranges, synchronized cursor tooltip
  payloads, and vertical peer cursor markers.
- `ChartRegionZoomLayer` now supports horizontal/shifted wheel panning,
  Alt-drag panning, and keyboard range navigation through the same range-change
  callback used by zoom and sync.
- `ChartDataZoom` is exported from `@pitant/charts-react` and can be enabled on
  TimeSeries/DigitalChannel with `dataZoom`; its minimap samples a bounded
  number of points instead of rendering the full source series into SVG.
- Touch navigation is implemented in `ChartRegionZoomLayer`: one-finger panning
  and two-finger pinch zooming avoid region-selection overlays and reuse the
  same x-range publication path as desktop interactions.
- Core range-navigation helpers are exported from `@pitant/charts` and reused
  by React interactions plus benchmark scenario
  `018_interaction_range_1000_cycles`.
- The benchmark suite now includes a 1000-cycle mixed zoom, pan, DataZoom,
  keyboard-style zoom, touch pinch, and touch pan range-update gate with a
  2 ms/1000 target and a 2 MB heap-growth target.
- The benchmark suite also includes
  `019_cursor_propagation_4panels_latency`, a four-panel/four-pen cursor
  propagation gate with a 1 ms/1000 target.
- React primitives and early `useChart()` hook.
- Detailed legacy phase plans under `plan/`.
- Canonical roadmap at `docs/ROADMAP.md`.
- Architecture catalog at `docs/architecture/README.md`.
- Source-of-truth feature inventory at
  `docs/architecture/06-FEATURE-SPEC-INVENTORY.md`.
- Phase 5 release evidence at
  `docs/architecture/phase-5/release-candidate-evidence.md`.
- Phase 6 TimeSeries value-band and envelope-band support exists in core and
  React config, with SVG export coverage and benchmark scenario
  `020_time_series_bands_8x1M`.

## Next Build Task

Continue Phase 6 implementation:

1. Add browser/render-harness coverage for TimeSeries value/envelope bands.
2. Decide whether the next v1.1 slice is persistent annotations/rulers or
   derived-series overlays.
3. Keep SPC, spectrum/spectrogram, correlation, KPI, and PDF packs at
   contract-only until their benchmark fixtures exist.

Before adding a new visible feature, update or check
`docs/architecture/06-FEATURE-SPEC-INVENTORY.md` and the relevant frontend
contract pack under `docs/frontend-contracts/`.

## Verification Status

Run after import on 2026-05-18:

- `bun install`: pass
- `bun run lint`: pass
- `bun run build`: pass
- `bun run typecheck`: pass after build generated package `dist/` outputs
- `bun run test`: pass after build generated package `dist/` outputs
- `bun run bench`: pass, 7/7 benchmark scenarios

Run after Phase 3 core render-plan slice on 2026-05-18:

- `bun run build`: pass
- `bun run typecheck`: pass
- `bun run lint`: pass
- `bun run test`: pass, 16 files / 237 tests
- `bun run bench`: pass, 7/7 benchmark scenarios

Run after Phase 3 React API slice on 2026-05-18:

- `bun run build`: pass
- `bun run typecheck`: pass
- `bun run lint`: pass
- `bun run test`: pass, 18 files / 250 tests
- `bun run bench`: pass, 7/7 benchmark scenarios

Run after Phase 3 LOD-backed hook slice on 2026-05-19:

- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run lint`: pass
- `bun run test`: pass, 18 files / 252 tests
- `bun run bench`: pass, 7/7 benchmark scenarios

Run after Phase 3 render harness and worker-packaging slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite emits
  `dist/assets/data-engine.worker-*.js` instead of an empty worker.
- `bun run lint`: pass, 84 files checked
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 18 files / 252 tests
- `bun run bench`: pass, 9/9 benchmark scenarios
- New benchmark gates: `014_time_series_plan_8x1M` at 50.75 ms against a
  150 ms target, and `015_digital_channel_plan_16x250K` at 24.59 ms against a
  100 ms target.

Run after Phase 3 streaming append slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass
- `bun run lint`: pass, 84 files checked
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 18 files / 253 tests
- `bun run bench`: pass, 10/10 benchmark scenarios
- New benchmark gate: `016_data_source_live_append_query_4pens` at
  0.421 ms/batch against a 2 ms/batch target.

Run after Phase 3 quality/gap viewport slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass
- `bun run lint`: pass, 84 files checked
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 18 files / 257 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- New benchmark gate: `017_data_source_quality_query_4pens` at
  0.191 ms/query against a 1 ms/query target.

Run after Phase 3 high-DPI resize slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass
- `bun run lint`: pass, 85 files checked
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 19 files / 259 tests
- `bun run bench`: pass, 11/11 benchmark scenarios

Run after Phase 3 `useChart()` error-state slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bunx biome check packages/charts-react/src/use-chart.ts
  packages/charts-react/src/__tests__/use-chart.test.tsx docs/ROADMAP.md
  SESSION.md`: pass for changed TypeScript files; Markdown inputs are ignored
  by the current Biome config.
- `bun run lint`: blocked by pre-existing unused interfaces in
  `apps/multiaxis-demo/src/App.tsx`; that file was already dirty and was not
  changed for this slice.
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 19 files / 260 tests
- `bun run bench`: pass, 11/11 benchmark scenarios

Run after Phase 3 chart layout slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run lint`: pass, 86 files checked
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 20 files / 263 tests
- `bun run bench`: pass, 11/11 benchmark scenarios

Run after Phase 3 browser screenshot/pixel verifier slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D and local WebGPU both produced
  nonblank chart pixels in headless Chrome.
- `bun run lint`: pass, 87 files checked
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 20 files / 263 tests
- `bun run bench`: pass, 11/11 benchmark scenarios

Run after Phase 3 generic hook and axis text slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D and local WebGPU both produced
  nonblank chart pixels in headless Chrome.
- `bun run typecheck`: pass
- `bun run test`: pass, 20 files / 266 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run lint`: blocked by pre-existing formatting drift in
  `apps/multiaxis-demo/src/App.tsx`; that file was already dirty and was not
  changed for this slice.
- `git diff --check`: pass

Run after Phase 3 historian adapter slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D and local WebGPU both produced
  nonblank chart pixels in headless Chrome.
- `bun run typecheck`: pass
- `bun run test`: pass, 21 files / 270 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run lint`: blocked by pre-existing unused interfaces in
  `apps/multiaxis-demo/src/App.tsx`; that file was already dirty and was not
  changed for this slice.
- `git diff --check`: pass

Run after Phase 3 imperative chart and docs examples slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D and local WebGPU both produced
  nonblank chart pixels in headless Chrome.
- `bun run lint`: pass, 93 files checked
- `bun run typecheck`: pass
- `bun run test`: pass, 22 files / 273 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `git diff --check`: pass

Run after Phase 3 visual regression slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual:update`: pass; wrote Canvas2D compact and large
  baselines. WebGPU was skipped because this local browser session did not
  expose `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 22 files / 273 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run lint`: blocked by pre-existing redeclare/unused/format issues in
  `apps/multiaxis-demo/src/App.tsx`; that file was already dirty and was not
  changed for this slice.
- `git diff --check`: pass

Run after Phase 4 pointer coordinate mapping slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 23 files / 278 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run lint`: pass, 96 files checked
- `git diff --check`: pass

Run after Phase 4 region zoom slice on 2026-05-19:

- `bun run build`: pass
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- Focused tests for `ChartRegionZoomLayer`, `TimeSeries`, and
  `DigitalChannel`: pass, 3 files / 16 tests
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 24 files / 281 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- Targeted `bunx biome check` for changed chart interaction files: pass
- `bun run lint`: blocked by pre-existing unused interfaces in
  `apps/multiaxis-demo/src/App.tsx`; that file was already dirty and was not
  changed for this slice.
- `git diff --check`: pass

Run after Phase 4 wheel/trackpad zoom slice on 2026-05-19:

- Focused `ChartRegionZoomLayer` tests: pass, 1 file / 7 tests
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 24 files / 285 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- Targeted `bunx biome check` for changed chart interaction files: pass
- `bun run lint`: blocked by pre-existing unused interfaces in
  `apps/multiaxis-demo/src/App.tsx`; that file was already dirty and was not
  changed for this slice.
- `git diff --check`: pass

Run after Phase 4 hover crosshair and nearest tooltip slice on 2026-05-19:

- Focused tests for cursor lookup, crosshair, tooltip payloads, TimeSeries, and
  DigitalChannel: pass, 7 files / 50 tests
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 26 files / 296 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- Targeted `bunx biome check` for changed cursor, interaction, tooltip, and
  concrete chart files: pass
- `bun run lint`: pass, 102 files checked
- `git diff --check`: pass

Run after Phase 4 sync propagation slice on 2026-05-19:

- Focused sync tests for `ChartSyncGroup`, `ChartRegionZoomLayer`,
  TimeSeries, and DigitalChannel: pass, 4 files / 42 tests
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 26 files / 299 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 102 files checked
- `git diff --check`: pass

Run after Phase 4 pan/scroll and keyboard navigation slice on 2026-05-19:

- Focused interaction tests for `ChartRegionZoomLayer`, TimeSeries, and
  DigitalChannel: pass, 3 files / 29 tests
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 26 files / 302 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 102 files checked
- `git diff --check`: pass

Run after Phase 4 DataZoom slider/minimap slice on 2026-05-19:

- Focused DataZoom tests for minimap rendering, track recentering, window
  panning, handle resizing, TimeSeries, and DigitalChannel: pass, 3 files /
  21 tests
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 27 files / 306 tests
- `bun run bench`: pass, 11/11 benchmark scenarios
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason. No visual baseline update was needed because DataZoom is
  opt-in.
- `bun run lint`: pass, 104 files checked
- `git diff --check`: pass

Run after Phase 4 touch navigation slice on 2026-05-19:

- Focused interaction tests for touch pan, pinch zoom, TimeSeries, and
  DigitalChannel: pass, 3 files / 31 tests
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 27 files / 308 tests
- `bun run bench`: pass, 11/11 benchmark scenarios when run standalone. A
  preliminary parallel run with the full test suite caused the generic
  `007_streaming_append` benchmark to exceed its 2 ms/batch gate; the standalone
  rerun passed at 1.753 ms/batch.
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 104 files checked
- `git diff --check`: pass

Note: `@pitant/charts-react` currently resolves `@pitant/charts` through the
package export, so a clean checkout needs `bun run build` before typecheck/test
unless path aliases or test resolution are changed.

Run after Phase 4 interaction range stress benchmark slice on 2026-05-19:

- Focused range-navigation, public API, and React interaction tests: pass,
  3 files / 22 tests.
- Scenario `018_interaction_range_1000_cycles`: pass, 0.225 ms/1000 in focused
  run against a 2 ms/1000 target, 0 MB heap delta against a 2 MB target.
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 28 files / 313 tests
- `bun run bench`: pass, 13/13 benchmark results; final full-gate run measured
  `018_interaction_range_1000_cycles` at 0.075 ms/1000 and 0 MB heap delta.
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 106 files checked
- `git diff --check`: pass

Run after Phase 4 cursor propagation benchmark slice on 2026-05-19:

- Scenario `019_cursor_propagation_4panels`: pass, 0.712 ms/1000 in focused
  run against a 1 ms/1000 target.
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 28 files / 313 tests
- `bun run bench`: pass, 14/14 benchmark results; final full-gate run measured
  `019_cursor_propagation_4panels` at 0.818 ms/1000.
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 106 files checked
- `git diff --check`: pass

Run after Phase 4 browser FPS benchmark slice on 2026-05-19:

- `bun run harness:fps -- --renderers=canvas2d --profiles=compact`: pass,
  Canvas2D compact measured 121 fps average, 84.7 fps minimum, p95 9.2 ms,
  dropped 0/120 frames against a 55 fps target.
- `bun run harness:fps`: pass, Canvas2D compact measured 120 fps average,
  107.5 fps minimum, p95 8.9 ms, dropped 0/120 frames against a 55 fps target.
  WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- Final full-gate `bun run harness:fps`: pass, Canvas2D compact measured
  120 fps average, 109.9 fps minimum, p95 8.7 ms, dropped 0/120 frames against
  a 55 fps target. WebGPU was skipped for the same local browser reason.
- Final full gate after lint-only demo fixes: `bun run build`, `bun run
  typecheck`, `bun run test`, `bun run bench`, `bun run harness:build`, `bun
  run harness:verify`, `bun run harness:fps`, `bun run harness:visual`, `bun
  run lint`, and `git diff --check` all pass.

Run after Phase 4 live-append interaction regression slice on 2026-05-19:

- Focused `packages/charts-react/src/__tests__/time-series.test.tsx`: pass,
  10 tests. New coverage mounts `TimeSeries`, appends through `DataSource`,
  verifies the live-edge window, then wheel-zooms through
  `ChartRegionZoomLayer`.
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 28 files / 314 tests
- `bun run bench`: pass, 14/14 benchmark results; final full-gate run measured
  `018_interaction_range_1000_cycles` at 0.065 ms/1000 and
  `019_cursor_propagation_4panels` at 0.799 ms/1000.
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:fps`: pass, Canvas2D compact measured 120 fps average,
  107.5 fps minimum, p95 9.2 ms, dropped 0/120 frames against a 55 fps target.
  WebGPU was skipped for the same local browser reason.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 106 files checked
- `git diff --check`: pass

Run after Phase 4 tooltip provenance closure slice on 2026-05-19:

- Focused tooltip and chart tests: pass, 4 files / 40 tests. Coverage verifies
  coded provenance columns, sparse provenance entries, default tooltip rendering
  with `quality / gap / provenance`, TimeSeries append provenance preservation,
  and DigitalChannel state-label tooltip provenance.
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 28 files / 316 tests
- `bun run bench`: pass, 14/14 benchmark results; final full-gate run measured
  `018_interaction_range_1000_cycles` at 0.061 ms/1000 and
  `019_cursor_propagation_4panels` at 0.772 ms/1000.
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:fps`: pass, Canvas2D compact measured 119.5 fps average,
  95.2 fps minimum, p95 9.1 ms, dropped 0/120 frames against a 55 fps target.
  WebGPU was skipped for the same local browser reason.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 106 files checked
- `git diff --check`: pass

Run after Phase 5 initial shadcn registry slice on 2026-05-19:

- `bun run registry:validate`: pass, 4 registry items:
  `pitant-time-series`, `pitant-digital-channel`,
  `pitant-synchronized-dashboard`, and `pitant-datazoom`.
- `bun run registry:typecheck`: pass against public package source/types.
- `bun run build`: pass
- `bun run typecheck`: pass after sequential `bun run build`
- `bun run test`: pass, 28 files / 316 tests
- `bun run bench`: pass, 14/14 benchmark results; final full-gate run measured
  `018_interaction_range_1000_cycles` at 0.055 ms/1000 and
  `019_cursor_propagation_4panels` at 0.803 ms/1000.
- `bun run harness:build`: pass; Vite still warns that `@pitant/charts` is
  both statically and dynamically imported by the React package, but the build
  succeeds and emits the data-engine worker asset.
- `bun run harness:verify`: pass; Canvas2D compact produced nonblank chart
  pixels. WebGPU was skipped because this local browser session did not expose
  `navigator.gpu`.
- `bun run harness:fps`: pass, Canvas2D compact measured 120 fps average,
  107.5 fps minimum, p95 9.1 ms, dropped 0/120 frames against a 55 fps target.
  WebGPU was skipped for the same local browser reason.
- `bun run harness:visual`: pass; Canvas2D compact and large baselines matched
  with zero pixel/fingerprint/average delta. WebGPU skipped for the same local
  browser reason.
- `bun run lint`: pass, 113 files checked
- `git diff --check`: pass

Run after Phase 5 shadcn registry smoke gate on 2026-05-19:

- `bun run registry:smoke`: pass. The script ran `bun run build`, `shadcn
  build`, `npm pack`, `shadcn init` for a fresh Vite consumer, dry-ran the
  public dependency form for all four registry items, installed all four blocks
  from local package tarballs, imported the installed blocks into `src/App.tsx`,
  then passed consumer `bun run typecheck` and `bun run build`.
- `bun run registry:validate`: pass, 4 registry items.
- `bun run registry:typecheck`: pass.
- `bun run typecheck`: pass after `registry:smoke` rebuilt package outputs.
- `bun run lint`: pass, 114 files checked.
- `git diff --check`: pass.

Run after Phase 5 expanded registry block slice on 2026-05-19:

- `bun run registry:validate`: pass, 8 registry items.
- `bun run registry:typecheck`: pass.
- `bun run registry:smoke`: pass. The real `shadcn` CLI built and dry-ran all
  eight item JSON files, installed all eight blocks from local package tarballs
  into a fresh Vite consumer app, imported them into `src/App.tsx`, then passed
  consumer `bun run typecheck` and `bun run build`.
- `bun run lint`: pass, 118 files checked.
- `git diff --check`: pass.

Run after Phase 5 live docs and quick-start slice on 2026-05-19:

- `bun install`: pass after adding the docs-site workspace and root React/type
  dev dependencies needed for registry source imports.
- `bun run docs:build`: pass. Vite built the docs app with all eight live
  registry examples and emitted the data-engine worker asset.
- `bun run registry:validate`: pass, 8 registry items.
- `bun run registry:typecheck`: pass.
- `bun run typecheck`: pass.
- `bun run lint`: pass, 125 files checked.
- `git diff --check`: pass.

Run after Phase 5 export hardening slice on 2026-05-19:

- `bun run typecheck`: pass; root typecheck now rebuilds `@pitant/charts`
  declarations before checking `@pitant/charts-react`.
- `bun run lint`: pass, 127 files checked.
- `bun run test`: pass, 29 files / 320 tests.
- `bun run build`: pass for `@pitant/charts` and `@pitant/charts-react`.
- `bun run registry:validate`: pass, 8 registry items.
- `bun run registry:typecheck`: pass.
- `bun run docs:build`: pass; Vite built the docs app and emitted the
  data-engine worker asset.
- `git diff --check`: pass.

Run after Phase 5 release-gate slice on 2026-05-19:

- `bun run release:check`: pass. Integrated gate ran build, typecheck, lint,
  test, bench, registry validation, registry typecheck, docs build, size-limit,
  and package dry-run.
- `bun run registry:smoke`: pass. The real `shadcn` CLI installed all eight
  blocks into a fresh Vite app, then passed consumer typecheck and build.
- `bun run test:coverage`: pass, 29 files / 322 tests, coverage above the
  configured 40% thresholds.
- `bun run bench`: pass, 14/14 benchmark results.
- `bunx size-limit`: pass; `@pitant/charts` root entry is 11.48 kB brotlied
  against a 75 kB limit, and `@pitant/charts-react` root entry is 17.43 kB
  brotlied against a 130 kB limit.
- `bun run pack:dry-run`: pass; npm dry-run package sizes are 123.7 kB for
  `@pitant/charts` and 72.7 kB for `@pitant/charts-react`.
- `git diff --check`: pass.

Run after Phase 5 cross-browser matrix slice on 2026-05-19:

- `bun run lint`: pass.
- `bun run typecheck`: pass.
- `bun run harness:build`: pass.
- `bun run harness:cross-browser -- --browser=chromium --renderer=canvas2d --profile=compact`:
  pass locally with nonblank analog and digital canvas pixel checks.
- `bun run test`: pass, 29 files / 322 tests.
- `bun run release:check`: pass. Integrated gate reran build, typecheck, lint,
  tests, 14 benchmark scenarios, registry validation/typecheck, docs build,
  size-limit, and npm package dry-run.
- `git diff --check`: pass.
- CI matrix configured for Chromium, Firefox, WebKit/Safari runtime, and
  Microsoft Edge compact Canvas2D smoke verification.

Run after Phase 5 package metadata slice on 2026-05-19:

- `bun install`: pass; lockfile updated for v1.0.0 package manifests.
- `bun run lint`: pass.
- `bun run typecheck`: pass.
- `bun run pack:dry-run`: pass. Tarballs include README, CHANGELOG, LICENSE,
  package metadata, dist output, and token stylesheet where applicable.
  `@pitant/charts` is 125.8 kB packed; `@pitant/charts-react` is 75.6 kB
  packed.
- `bun run registry:smoke`: pass. The real `shadcn` CLI installed all eight
  blocks into a fresh Vite consumer, then passed consumer typecheck and build.
- `bun run release:check`: pass. Integrated gate reran build, typecheck, lint,
  tests, 14 benchmark scenarios, registry validation/typecheck, docs build,
  size-limit, and npm package dry-run.

Run after Phase 5 local release-candidate evidence slice on 2026-05-19:

- `gh auth status`: pass for `github.com`; token has `repo` and `workflow`
  scopes.
- `gh workflow list`: remote currently exposes only `CI`; local
  `.github/workflows/publish.yml` cannot be dispatched until committed and
  pushed.
- `npm publish ./packages/charts --dry-run --access public`: pass for
  `@pitant/charts@1.0.0`, 125.9 kB packed, 22 files.
- `npm publish ./packages/charts-react --dry-run --access public`: pass for
  `@pitant/charts-react@1.0.0`, 75.6 kB packed, 7 files.
- `bunx playwright install chromium firefox webkit`: pass.
- `bun run harness:build`: pass.
- `bun run harness:cross-browser -- --browser=chromium,firefox,webkit --renderer=canvas2d --profile=compact`:
  pass with nonblank canvas checks for all three local engines.
- `bun run release:check`: pass.
- `git diff --check`: pass.

Run after Phase 5 PR CI-fix slice on 2026-05-19:

- `bun run lint`: pass, 128 files checked.
- `bun run typecheck`: pass.
- `bun run bench`: pass, 14/14 benchmark results under strict local targets.
- `PITANT_BENCH_PROFILE=ci bun run bench`: pass, 14/14 benchmark results under
  the explicit shared-runner profile.
- `bun run harness:build`: pass; root script now rebuilds package `dist`
  declarations before compiling `apps/render-harness`.
- `bun run harness:verify -- --renderers=canvas2d`: pass under Bun-backed CDP
  verifier.
- `bun run harness:fps -- --renderers=canvas2d`: pass under Bun-backed CDP
  verifier.
- `bun run harness:cross-browser -- --browser=chromium --renderer=canvas2d --profile=compact`:
  pass after adding Windows process-tree cleanup for the Edge CI path.
- GitHub PR CI run `26089497306`: pass for build, Canvas2D/WebGPU browser
  smoke, Chromium, Firefox, WebKit/Safari runtime, and Microsoft Edge.

Run after Phase 5 external release closure on 2026-05-19:

- PR #1 merged to `main` as squash commit `357e0a9`.
- Main CI after merge: pass,
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090111139.
- First publish dry-run attempt: failed in hosted-runner strict benchmark path,
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090129223.
- Publish workflow benchmark profile fix pushed as `67ac09e`.
- Main CI after workflow fix: pass,
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090260058.
- Publish workflow dry-run after workflow fix: pass,
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090262210.

Run after Phase 6 planning-entry slice on 2026-05-19:

- `docs/architecture/06-FEATURE-SPEC-INVENTORY.md` now has a Phase 6
  chart-family use/do-not-use catalog and named fixture requirements for alarm
  bands, envelope bands, anomaly tracks, annotations, SPC, capability,
  distributions, spectrogram, spectrum, Bode, scatter, correlation, parallel
  coordinates, KPI strips, and PDF evidence export.
- Frontend contract packs were added for anomaly review, SPC review,
  scientific analysis, correlation workbench, export/evidence, and benchmark
  lab.
- `git diff --check`: pass.

Run after Phase 6 TimeSeries band slice on 2026-05-19:

- `bun run typecheck`: pass.
- `bun run lint`: pass.
- `bunx vitest run packages/charts/src/__tests__/time-series.test.ts packages/charts/src/__tests__/svg-export.test.ts packages/charts-react/src/__tests__/time-series.test.tsx`:
  pass, 23 focused tests.
- `bun run --filter @pitant/benchmark bench 020`: pass,
  `020_time_series_bands_8x1M` at 97.6 ms against a 250 ms target.
