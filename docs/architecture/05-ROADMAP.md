# 05 - Roadmap

This is the authoritative architecture roadmap for `pitant-charts`. It derives
from `00` through `04` and maps the process families in `02` to implementation
phases. `06-FEATURE-SPEC-INVENTORY.md` owns the maximal scope.

## Planning Rules

- V1 ships excellent line charts before broad chart catalogs.
- Every phase closes with tests or benchmarks, not only code.
- Public package exports are contracts and need compatibility discipline.
- Renderer work must preserve Canvas2D fallback.
- No phase may add control-write behavior.
- Feature maturity uses `contract_only`, `simulated`, `pilot`, `production`.

## Target Architecture Stack

| Layer | Reference choice | Public contract impact |
|---|---|---|
| Runtime config | Package options and React props | Stable TypeScript interfaces |
| Data model | Typed arrays plus Pitant contract adapters | `ColumnarData`, `TimeSeriesDataSet`, chart series types |
| Worker path | Web Worker with transferable buffers | Bounded message contracts |
| Renderer | WebGPU primary, Canvas2D fallback | `RenderContext` and capability model |
| Layout | Internal layout engine | Public axis/panel config |
| Interaction | Gesture state machines | Public visible range, cursor, selection APIs |
| Theming | CSS variables plus resolver | `tokens.css`, `ChartTokens` |
| Export | PNG/SVG first, PDF later | `ExportOptions`, replay spec |
| Observability | Benchmarks, stats, diagnostics | `ChartStats`, benchmark JSON |
| Distribution | Bun workspaces, tsup, npm, shadcn registry | Package exports and registry blocks |

## Complete Domain Model

- Chart view
- Series
- Data source
- Data window
- Timestamp
- Value
- Unit
- Quality code
- Gap
- Provenance
- LOD level
- View transform
- Plot area
- Axis
- Grid
- Panel
- Overlay lane
- Render command
- Renderer capability
- Interaction state
- Cursor
- Brush
- Data tip
- Sync group
- Theme token
- Export artifact
- Replay spec
- Benchmark scenario
- Fixture pack
- Maturity label
- Profile gate

## API and Contract Surface Map

| Surface | Stability tier | Owner phase |
|---|---|---|
| `@pitant/charts` root exports | MVP | 1 |
| `RenderContext` | MVP | 1 |
| `DataEngine` | MVP | 1 |
| `ColumnarData` and `DataSource` | MVP | 3 |
| `@pitant/charts-react` root exports | MVP | 2 |
| `ChartContainer`, `ChartLegend`, `ChartTooltip`, `ChartSyncGroup` | MVP | 2 |
| `TimeSeries` and `useTimeSeries()` | Contract-only | 3 |
| `DigitalChannel` | Contract-only | 3 |
| Interaction APIs | Contract-only | 4 |
| Export APIs | MVP | 5 |
| shadcn registry blocks | Contract-only | 5 |
| Post-v1 chart packs | Future | 6 |

## 06 Coverage Map

| 06 section heading | Phases that close it | Acceptance evidence |
|---|---|---|
| Whole-PITANT Composition Model | 0, 3, 5 | Architecture docs, contract references, frontend packs |
| Ingest | 1, 3 | Data-source tests and adapters |
| Normalize | 3, 4 | Quality/gap unit tests and fixtures |
| Transform | 1, 3 | LOD tests and benchmarks |
| Layout | 3, 4 | Axis/layout tests and visual checks |
| Render | 1, 3, 5 | Renderer tests, browser screenshots, FPS benchmarks |
| Interact | 4 | Browser interaction tests |
| Compose | 2, 3 | React tests and examples |
| Synchronize | 2, 4 | Sync group tests and multi-chart examples |
| Theme | 2, 5 | Token tests, high-contrast examples |
| Export | 5 | Export tests and artifact review |
| Benchmark | 1, 3, 4, 5 | `apps/benchmark` and browser metrics |
| Package | 5 | npm dry run, registry install |
| Govern | 0, 5, 9 | Claim ledger, readiness labels |
| Post-v1 Industrial Packs | 6 | Contract-only inventory and gated roadmap |

## Cross-Repo Integration Gate

| Sibling repo | What this repo needs from it | Stub or production |
|---|---|---|
| `pitant-contracts` | Shared chart data windows, quality codes, evidence labels | Stub now |
| `pitant-historian` | Trend query payloads, replay windows, source quality | Stub now, production before v1 field use |
| `pitant-web` | App shell, saved views, routing, auth context | Stub now |
| `pitant-client` | Desktop shell and offline profiles | Stub |
| `pitant-hmi-sdk` | Operator display boundary and no-write policy | Contract-only |
| `pitant-spc` | SPC feature payloads and rule metadata | Contract-only |
| `pitant-oee` | OEE buckets and KPI overlays | Contract-only |
| `pitant-batch` | Batch profile and episode windows | Contract-only |
| `pitant-sentinel` | Anomaly tracks and detector evidence | Contract-only |
| `pitant-design-system` | Tokens and component conventions | Stub now |

## Phase 0 - Planning, Import, Traceability

**Status.** In progress, 2026-05-18.

**Scope.** Import source from `/Users/ali/Pchart`, establish architecture docs,
baseline verification, and phase artifacts.

**Implementation tasks.**
- Import tracked Pchart files.
- Preserve Pitant repo context in README.
- Create `docs/architecture` 00-10.
- Create phase-0 baseline and gap ledger.
- Run install, lint, build, typecheck, test, and benchmark.

**Tests and Acceptance.** `bun run lint`, `bun run build`, `bun run typecheck`,
`bun run test`, `bun run bench`.

**Definition of Done.**
- [x] Source imported.
- [x] Verification baseline recorded.
- [x] Architecture doc structure exists.
- [ ] Phase-0 gap ledger reviewed.

**Release gate.** Unblocks Phase 3 implementation in this repo.

## Phase 1 - Foundation and Rendering Engine

**Status.** Mostly closed by imported code.

**Scope.** Shared renderer contract, WebGPU/Canvas2D backends, data engine, LOD,
and benchmark harness. It does not ship user-facing chart types.

**Implementation tasks.**
- Maintain `RenderContext` and renderer capability model.
- Keep WebGPU and Canvas2D paths aligned.
- Expand browser renderer benchmark coverage.
- Add command-list vector export compatibility rules.

**Tests and Acceptance.** Renderer unit tests, public API tests, LOD benchmarks,
future Playwright canvas checks.

**Definition of Done.**
- [x] Build passes.
- [x] Unit tests pass.
- [x] LOD benchmarks pass.
- [x] Browser Canvas2D visual regression baseline exists.
- [x] Browser WebGPU and Canvas2D FPS benchmarks exist.

**Release gate.** Required before real chart types can claim performance.

## Phase 2 - Headless Primitives and Theming

**Status.** Mostly closed by imported code.

**Scope.** React primitives, accessibility helpers, sync group, token resolver,
and initial hook surface.

**Implementation tasks.**
- Keep primitives headless and CSS-variable driven.
- Add composed example fixtures and docs examples for `ChartContainer`,
  `ChartCanvas`, `ChartLegend`, `ChartTooltip`, and `ChartSyncGroup`.
- Add accessibility verification for composed examples.
- Clarify `useChart()` error state and renderer readiness.

**Tests and Acceptance.** React tests, token tests, accessibility checks.

**Definition of Done.**
- [x] Primitive tests pass.
- [x] Token tests pass.
- [x] Composed examples and docs examples exist.
- [ ] Accessibility checks run on examples.

**Release gate.** Required before TimeSeries is exposed to app teams.

## Phase 3 - TimeSeries and Data Pipeline

**Status.** Closed on 2026-05-19.

**Scope.** First concrete chart types: TimeSeries and DigitalChannel. This phase
does not include the full interaction suite.

**Implementation tasks.**
- Define `TimeSeriesDataSet`, `TimeSeriesSeries`, and `DigitalChannelSeries`.
- Wire concrete `useTimeSeries().setData()` and `useDigitalChannel().setData()`
  to `DataSource` / `DataEngine` ingestion.
- Wire concrete `useTimeSeries().append()` and `useDigitalChannel().append()`
  to `DataSource` / `DataEngine` append paths; keep generic `useChart()` as a
  renderer/lifecycle primitive with explicit unsupported-data-control errors.
- Add PITANT historian query and frontend fixture adapters that convert contract
  rows into TimeSeries-compatible columnar data with quality and gap metadata.
- Add layout pass for axes, grid, and plot area.
- Render axis tick labels and axis titles in screen space while preserving
  data-space transforms for series and grid lines.
- Generate line commands from LOD query results.
- Render single-pen and multi-pen TimeSeries.
- Render DigitalChannel step geometry.
- Expose thin imperative `TimeSeriesChart` and `DigitalChannelChart` classes
  for non-React consumers using the same render-plan path as React.
- Preserve quality and gap markers through query and render.
- Add docs examples and tests for visible-series toggles, tooltip slots, sync
  groups, and non-React imperative chart consumers.

**Tests and Acceptance.** TimeSeries API tests, DigitalChannel tests, LOD
render tests, browser visual regression, 8-pen benchmark, live append
benchmark.

**Definition of Done.**
- [ ] Single-pen TimeSeries renders real data.
- [ ] 8-pen TimeSeries uses LOD and legend toggles.
- [ ] DigitalChannel renders step state.
- [ ] Streaming append updates without remount.
- [ ] Tests, typecheck, lint, build, benchmark pass.

**Release gate.** Unlocks interaction work.

## Phase 4 - Interactions and Navigation

**Status.** Local release candidate complete; GitHub publish dry-run pending.

**Scope.** Region zoom, pan, wheel, keyboard, touch, crosshair, snap tooltip,
DataZoom, and synchronized cursor/range.

**Implementation tasks.**
- Implement screen-to-data mapping with layout-aware pointer utilities.
- Implement gesture state machines.
- Add cursor nearest-point lookup.
- Add DataZoom minimap.
- Sync cursor and ranges across `ChartSyncGroup`.
- Test interactions during streaming append.

**Tests and Acceptance.** Browser interaction tests, mobile/touch checks,
memory-leak stress test.

**Progress.**
- [x] Core pointer coordinate mapping converts client coordinates to chart,
  plot, relative x, absolute x, and y values.
- [x] Pointer mapping tests cover scaled DOM viewports, clamping, out-of-plot
  state, and reverse data-to-chart mapping.
- [x] `ChartRegionZoomLayer` provides plot-bounded region zoom and double-click
  reset for concrete React chart components.
- [x] Region zoom tests cover drag threshold, outside-plot ignore, selection
  overlay, and full-range reset.
- [x] X-axis wheel/trackpad zoom keeps the cursor anchor stable, normalizes
  wheel delta modes, and clamps zoom-out to the full source range.
- [x] Hover crosshair renders in the DOM overlay without forcing chart redraws.
- [x] Nearest timestamp lookup is a core binary-search helper and feeds
  TimeSeries/DigitalChannel tooltip payloads with value, quality, and gap
  metadata.
- [x] TimeSeries and DigitalChannel publish local x-range changes through
  `ChartSyncGroup` and apply peer ranges with source-echo suppression.
- [x] TimeSeries and DigitalChannel publish nearest cursor timestamps through
  `ChartSyncGroup`; peers show synchronized tooltip payloads and a vertical
  cursor marker without fabricating a local y-value crosshair.
- [x] Horizontal wheel, shifted scroll, and Alt-drag pan the current x-window
  without changing span or forcing a renderer-specific interaction path.
- [x] Focused chart overlays support keyboard range navigation: Arrow/Page
  pans, ArrowUp/ArrowDown and +/- zoom, Home/End align, and 0/Escape reset.
- [x] `ChartDataZoom` provides an opt-in overview-plus-detail minimap for
  TimeSeries and DigitalChannel, with fixed-sample overview rendering, range
  recentering, drag panning, and handle resizing through the same x-range path.
- [x] Touch navigation uses pointer events in the shared interaction layer:
  one-finger drag pans the x-window and two-finger pinch zooms without drawing a
  region-selection rectangle.
- [x] Core range-navigation helpers in `@pitant/charts` now own x-window
  clamping, pixel/value panning, anchor zooming, center zooming, and equality
  checks so React gestures and benchmarks share one fast path.
- [x] Benchmark scenario `018_interaction_range_1000_cycles` covers 1000 mixed
  wheel zoom, pan, DataZoom, keyboard-style zoom, and touch pinch/pan range
  updates with a 2 ms/1000 gate and a 2 MB heap-growth gate.
- [x] Benchmark scenario `019_cursor_propagation_4panels` covers source-echo
  suppressed cursor propagation across four panels, nearest timestamp lookup,
  per-pen value reads, and quality reads with a 1 ms/1000 gate.
- [x] Browser FPS mode in `scripts/verify-render-harness.mjs --fps` dispatches
  requestAnimationFrame-scheduled wheel zoom events through the analog chart
  interaction layer and reports average FPS, minimum FPS, p95 frame time, and
  dropped frames for Canvas2D and WebGPU-capable browsers.
- [x] `TimeSeries` regression coverage appends through the existing
  `DataSource`, verifies the live-edge range update, then wheel-zooms through
  the mounted `ChartRegionZoomLayer` without remounting the chart.
- [x] Tooltip payloads and default rendering now include provenance state
  alongside quality and gap state for TimeSeries and DigitalChannel, with coded
  provenance columns for dense streams and append-preservation coverage.

**Definition of Done.**
- [x] Zoom and pan under one-frame budget.
- [x] Cursor sync across four charts.
- [x] Tooltip includes quality/gap/provenance.
- [x] Interactions work during live append.

**Release gate.** Required before v1 launch packaging.

## Phase 5 - Registry, Docs, Export, Launch

**Status.** Local release candidate complete; PR CI passed; publish workflow dry-run pending.

**Scope.** shadcn registry, docs, PNG/SVG export, npm readiness, cross-browser
checks, and release gates.

**Implementation tasks.**
- Build registry blocks for TimeSeries, streaming, sync, DigitalChannel, export.
- Create docs site or Storybook.
- Implement true SVG export.
- Harden PNG export dimensions and backgrounds.
- Add npm publish dry run.
- Add bundle-size and browser matrix gates.

**Tests and Acceptance.** Registry install test, npm pack test, export tests,
browser visual checks.

**Progress.**
- [x] Root `registry.json` uses the shadcn registry schema and declares initial
  installable blocks for `pitant-time-series`, `pitant-digital-channel`,
  `pitant-synchronized-dashboard`, and `pitant-datazoom`.
- [x] Registry block source files are client components with typed-array demo
  data, stable memoized config, explicit renderer fallback, and no per-frame row
  object conversion.
- [x] `scripts/validate-registry.mjs` verifies registry item names, types,
  dependencies, target placeholders, and referenced files.
- [x] `bun run registry:typecheck` typechecks registry source against public
  package types.
- [x] `scripts/smoke-shadcn-registry.mjs` runs the real shadcn CLI, builds
  registry item JSON, initializes a fresh Vite consumer app, dry-runs the public
  dependency form, installs all initial blocks from local package tarballs,
  imports them into the app, then typechecks and bundles the consumer.
- [x] Registry now includes Phase 5 blocks for streaming live-edge append,
  separated-unit multi-axis comparison, PNG export command wiring, and dense
  dashboard overview, all covered by `registry:validate`, `registry:typecheck`,
  and `registry:smoke`.
- [x] `apps/docs-site` provides a live docs app that imports the registry block
  source directly, exposes use/do-not-use guidance for all eight blocks, and
  builds through `bun run docs:build`.
- [x] `docs/quick-start.md` defines first-run install, token import, renderer
  fallback, typed-array data rules, and registry block selection rules.
- [x] PNG export now honors explicit CSS-pixel width, height, background, and
  pixel-ratio options; concrete chart hooks rerender into an export canvas
  instead of scaling a stale screenshot.
- [x] TimeSeries and DigitalChannel expose command-frame builders and SVG
  export serializes vector command lists with plot clipping, axis text, and
  no raster image payload.
- [x] `.github/workflows/publish.yml` provides dry-run and provenance npm
  publishing gates for both packages.
- [x] `CHANGELOG.md`, `docs/release-checklist.md`, `pack:dry-run`,
  `release:check`, and bundle-size limits define the local and CI release
  evidence path.
- [x] Package manifests are set to v1.0.0 with npm public/provenance
  metadata, README files, package changelogs, MIT licenses, npm keywords, and
  npm-safe `@pitant/charts` peer dependency range for the React package.
- [x] `docs/release-checklist.md` declares `registry:smoke` as mandatory for
  maintainer release dry-runs and publish runs, but not part of ordinary PR
  `release:check` because it uses external shadcn CLI and fresh consumer
  project installation.
- [x] `scripts/verify-cross-browser.mjs` and the `cross-browser-smoke` CI job
  run Playwright render smoke across Chromium, Firefox, WebKit/Safari runtime,
  and Microsoft Edge with nonblank canvas pixel checks.
- [x] CI now runs benchmarks, registry validation, registry typecheck, docs
  build, size-limit, package dry-run, and browser harness renderer smoke/FPS
  checks.
- [x] Local npm publish dry-run passes for both v1.0.0 packages with npm-safe
  repository URLs and no npm package auto-correction warnings.
- [x] Local Playwright cross-browser smoke passes for Chromium, Firefox, and
  WebKit compact Canvas2D output; Edge remains configured for Windows CI.
- [x] `docs/architecture/phase-5/release-candidate-evidence.md` records local
  package, registry, publish dry-run, and browser evidence plus the remaining
  external GitHub Actions gate.

**Definition of Done.**
- [x] New user renders first chart in under five minutes.
- [x] Registry blocks install.
- [x] PNG and SVG export verified.
- [x] npm packages are publishable.

**Release gate.** v1 local release candidate. PR CI passed on
https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089639951.
External closure still requires the publish workflow to be dispatched with
`dry_run=true` after the workflow exists on the default branch.

## Phase 6 - Post-v1 Industrial Chart Packs

**Status.** Planned.

**Scope.** Overlay, spectral, SPC, distribution, correlation, anomaly, and KPI
packs after v1 field feedback.

**Implementation tasks.**
- Add AlarmBand, EnvelopeBand, AnomalyScoreTrack.
- Add spectrogram and power spectrum.
- Add SPC control chart surfaces.
- Add scatter/correlation/parallel coordinate surfaces.
- Add PDF export after SVG/PNG are stable.

**Tests and Acceptance.** Pack-specific unit, visual, and performance tests.

**Definition of Done.**
- [ ] Each pack has contract-only inventory before implementation.
- [ ] V1 performance is not regressed.
- [ ] Pack maturity labels are visible.

**Release gate.** Post-v1 product expansion only.

## Build Order Summary

| Phase | Primary family | Closure signal |
|---|---|---|
| 0 | Govern | Architecture docs and baseline |
| 1 | Render, Transform, Benchmark | Renderer/data tests and benchmarks |
| 2 | Compose, Theme, Synchronize | React primitive tests |
| 3 | Ingest, Normalize, Layout, Render | Real chart types |
| 4 | Interact, Synchronize | Browser interaction tests |
| 5 | Export, Package, Benchmark | npm/registry/export gates |
| 6 | Post-v1 packs | Gated industrial chart catalog |

## Universal Phase Gate

- `bun run lint` passes.
- `bun run build` passes.
- `bun run typecheck` passes after build until package resolution is fixed.
- `bun run test` passes.
- `bun run bench` passes for relevant scenarios.
- Public exports are reviewed for compatibility.
- Feature maturity labels are accurate.
- Quality/gap/provenance behavior is not weakened.

## Deliberately Not Building

- Historian query engine - owned by `pitant-historian`.
- Data acquisition - owned by `pitant-fieldlink`.
- Event bus - owned by `pitant-streams`.
- Auth and authorization - owned by `pitant-identity`.
- Product shell - owned by `pitant-web`, `pitant-client`, `pitant-mobile`.
- Control/HMI command writes - owned by future controlled repos, never here.
- Domain calculations - owned by `pitant-spc`, `pitant-oee`, `pitant-batch`,
  `pitant-energy`, `pitant-reliability`.

## Product Manageability Rules

- No chart type enters implementation without a 06 inventory section.
- No renderer-specific public data shape.
- No hidden global sync state.
- No chart pack before TimeSeries v1 is stable.
- No export artifact without degraded-state labels.
- No production claim without tests, examples, and benchmark evidence.

## Final Acceptance

This repo is feature-complete for its premium v1 target when Pitant can replace
SciChart in daily historian trend, anomaly review, and synchronized
multi-panel workflows while preserving performance, quality/gap visibility,
React composition, export behavior, and replayable view state.
