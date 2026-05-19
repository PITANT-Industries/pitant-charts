# @pitant/charts Roadmap

**Status:** Phase 5 release candidate closed; GitHub publish dry-run passed; Phase 6 planned
**Last updated:** 2026-05-19
**Imported source:** `/Users/ali/Pchart`
**North star:** Replace SciChart inside Pitant Systems with a WebGPU-first,
TypeScript-native charting library for industrial historian and scientific
time-series workflows.

This file is the canonical execution roadmap. The older `plan/*.md` files stay
as detailed design references, but new sessions should start here.

## Vision

**One sentence:** The MATLAB-grade plotting toolkit for the browser, built for
Pitant industrial historians, anomaly investigation, and high-density process
data.

**Primary users:** Pitant engineers building PRhistorian, S2G++ anomaly
interfaces, plant monitoring surfaces, and reusable Layer 6 UX packages.

**Why this exists:** Existing charting options either lack industrial chart
types, do not match shadcn/Pitant composition patterns, or fail the required
million-point interaction performance. SciChart is powerful but proprietary and
does not give Pitant the source-level control required for the Plant-Physics OS.

**Constraints:**
- TypeScript-first monorepo.
- Zero runtime dependencies in `@pitant/charts`.
- WebGPU primary renderer with Canvas2D fallback.
- React 19 bindings in a separate package.
- CSS-variable theming compatible with Pitant and shadcn conventions.
- Performance gates must be testable from CI or the benchmark harness.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Package manager | Bun workspaces | Fast install, workspace filtering, existing lockfile |
| Language | TypeScript 5 strict | Existing repo standard and browser API type support |
| Core package | `@pitant/charts` | Renderer, data engine, transforms, theming, chart logic |
| React package | `@pitant/charts-react` | Headless primitives and hooks for Pitant UX apps |
| Renderer | WebGPU plus Canvas2D | GPU speed where available, reliable fallback everywhere |
| Data engine | Web Worker plus main-thread fast path | Keeps interaction work off the UI thread for large series |
| Build | tsup ESM | Small package output with source maps and declarations |
| Tests | Vitest plus happy-dom | Unit coverage for data, renderer contracts, and React primitives |
| Lint/format | Biome | Single fast check for style and static rules |
| Benchmarks | `apps/benchmark` | Tracks LOD, append, query, and renderer performance gates |
| CI | GitHub Actions | Build, typecheck, lint, test, and benchmark enforcement |

## In-Memory Data Model

There is no database. The project model is browser memory, transferables, and
package APIs.

### Series Definition

- `key`, string, stable chart-local identifier.
- `label`, string, user-facing legend and tooltip name.
- `color`, CSS color or CSS variable reference.
- `visible`, boolean defaulting to true.
- Future fields: interpolation mode, y-axis binding, units, quality policy,
  gap threshold, line style, and alarm/envelope metadata.

### Columnar Data

- Timestamps are stored as `BigInt64Array`.
- Values are stored as `Float64Array`.
- Optional quality flags are stored as `Uint8Array`.
- Input adapters convert common row and column shapes into canonical arrays.

### LOD Pyramid

- Level 0 is raw timestamp/value data.
- Higher levels store min/max bucket quads.
- Queries return viewport-ready `Float32Array` pairs for renderer upload.
- Gap metadata tells line renderers where to break paths.

### Render Commands

- `RenderCommandList` captures draw work by z-layer.
- `RenderContext` is the backend contract for WebGPU and Canvas2D.
- Chart types should emit backend-agnostic commands first, then let the selected
  render context draw them.

### React State

- `ChartContainer` owns the canvas and overlay layers.
- `useChart()` owns renderer lifecycle, visibility state, visible range,
  export APIs, and future data-engine wiring.
- `ChartSyncGroup` broadcasts cursor and range state across chart instances.

## Current Implementation Snapshot

Completed or present in the imported tree:

- Bun workspace monorepo with `packages/charts`, `packages/charts-react`, and
  `apps/benchmark`.
- WebGPU and Canvas2D render contexts behind a shared `RenderContext` contract.
- Lazy auto-renderer selection in `createRenderContext()`.
- `ViewTransform` and render command list primitives.
- `DataEngine`, worker protocol, local fast path, min-max `LodPyramid`, gap
  detection, append support, columnar input conversion, and `DataSource`.
- Render harness app at `apps/render-harness` that exercises the public
  `TimeSeries` and `DigitalChannel` React APIs against compact and large
  typed-array datasets.
- Browser verifier at `scripts/verify-render-harness.mjs` that launches the
  harness in local Chrome, forces Canvas2D, conditionally checks WebGPU when
  available, captures screenshots, and asserts nonblank chart pixels.
- Browser FPS mode at `bun run harness:fps` drives the React interaction layer
  with requestAnimationFrame-scheduled wheel zoom events and reports average
  FPS, minimum FPS, p95 frame time, dropped frames, and renderer capability
  skips.
- Visual regression baselines at `apps/render-harness/visual-baselines.json`
  for Canvas2D compact and large harness profiles, checked by
  `bun run harness:visual`.
- Pointer coordinate mapping helpers in `@pitant/charts` convert browser
  `clientX/clientY` through layout plot rectangles into relative and absolute
  data coordinates without allocating renderer transforms per event.
- `ChartRegionZoomLayer` adds plot-bounded drag zoom and double-click reset to
  concrete React chart components, plus cursor-anchored wheel/trackpad x-axis
  zoom with full-range clamping.
- Core range-navigation helpers in `@pitant/charts` centralize x-window
  clamping, pixel panning, value panning, anchor zooming, center zooming, and
  range equality checks for React gestures and benchmarks.
- Benchmark gates for 8-pen TimeSeries render-plan generation and 16-channel
  DigitalChannel render-plan generation.
- CSS token resolution and `packages/charts/styles/tokens.css`.
- React primitives: `ChartContainer`, `ChartCanvas`, `ChartLegend`,
  `ChartTooltip`, `ChartSyncGroup`, accessibility helpers, `useDimensions`,
  `useChartTokens`, and early `useChart()`.
- Unit tests for data engine, data source, LOD, renderer command list, theming,
  public API, and React primitives.

Known gaps before v1:

- Core `TimeSeries` render-plan helpers and React `TimeSeries` /
  `useTimeSeries()` APIs exist. The hook now uses `DataSource` viewport
  queries with direct-array fallback while async LOD results load.
- Core `DigitalChannel` staircase render-plan helpers and React
  `DigitalChannel` / `useDigitalChannel()` APIs exist. The hook now uses
  `DataSource` viewport queries with direct-array fallback while async LOD
  results load.
- Streaming `append()` now keeps the existing `DataSource` hot path and appends
  deltas instead of rebuilding the source on every batch.
- `DataSource` preserves per-column quality flags and gap metadata through
  viewport query results without breaking the sub-millisecond query budget.
- `historianQueryToTimeSeries()` converts PITANT historian query rows and trend
  fixture wrappers into columnar TimeSeries data with quality codes, units, and
  gap index ranges.
- `ChartContainer` and render contexts resize with explicit DPR, invalidate on
  DPR changes, and avoid Canvas2D transform accumulation across resize cycles.
- `@pitant/charts` emits a standalone browser worker bundle at
  `dist/data-engine.worker.js` so package consumers can resolve the worker from
  `new URL('./data-engine.worker.js', import.meta.url)`.
- `useChart()` is now explicitly a renderer/lifecycle primitive. Its legacy
  `append()` and `setData()` compatibility methods fail through hook error state
  instead of silently swallowing data; concrete hooks own ingestion and redraw.
- Core `TimeSeriesChart` and `DigitalChannelChart` classes now give non-React
  consumers an imperative API over the same render-plan path used by React.
- Chart layout now reserves plot, axis, legend, and overlay rectangles, maps
  data into the reserved plot area, and renders tick labels plus axis titles as
  screen-space text commands for Canvas2D and WebGPU text overlays.
- No zoom, pan, crosshair, snap tooltip, DataZoom, minimap, or chart interaction
  gesture package.
- Export is canvas `toBlob()` only and does not produce true SVG.
- No shadcn registry, docs site, Storybook, or npm publishing pipeline yet.

## Build Order

| Phase | Goal | Status | Primary artifacts |
|---|---|---|---|
| 0 | Import and orient repo | Complete | Source tree, docs, roadmap |
| 1 | Foundation and rendering engine | Mostly complete | Renderer contract, WebGPU, Canvas2D, LOD, benchmarks |
| 2 | Headless primitives and theming | Mostly complete | React primitives, accessibility, tokens, sync group |
| 3 | TimeSeries and data pipeline | Mostly complete | TimeSeries, DigitalChannel, data ingestion, streaming |
| 4 | Interactions and navigation | In progress | Zoom, pan, crosshair, DataZoom, linked ranges |
| 5 | Registry, docs, export, launch | Not started | shadcn registry, docs site, npm, PNG/SVG export |
| 6 | Post-v1 industrial packs | Planned | Overlays, spectral, SPC, correlation, anomaly charts |

## Phase 0 - Import and Repository Orientation

*Goal: Bring `/Users/ali/Pchart` into this repo and establish the canonical
docs used for future build sessions.*

### Task Checklist

- [x] Import tracked files from `/Users/ali/Pchart`.
- [x] Exclude `.git`, `node_modules`, `.DS_Store`, and generated dist output.
- [x] Preserve Pitant Systems context in `README.md`.
- [x] Create `docs/ROADMAP.md`.
- [x] Create `CLAUDE.md` and `SESSION.md`.
- [x] Run install, test, typecheck, lint, build, and benchmark smoke checks.

### Definition of Done

- Repository contains the imported monorepo.
- Roadmap and session files identify the next implementation task.
- Verification results are recorded in the session notes.

## Phase 1 - Foundation and Rendering Engine

*Goal: A blank canvas can draw anti-aliased lines through WebGPU or Canvas2D,
and the data engine can ingest/query min-max LOD data without blocking the UI
for large inputs.*

### Task Checklist

- [x] Configure Bun workspace, package boundaries, TypeScript, tsup, Biome,
  Vitest, and GitHub Actions.
- [x] Implement `RenderContext` interface and shared renderer capability model.
- [x] Implement Canvas2D render context.
- [x] Implement WebGPU render context and WGSL line/fill shader foundations.
- [x] Implement `createRenderContext()` with auto detection and lazy imports.
- [x] Implement `ViewTransform` and render command list.
- [x] Implement data engine worker protocol, local fast path, ingest, append,
  query, stats, and disposal APIs.
- [x] Implement min-max LOD pyramid with gap detection and ring-buffer limit.
- [x] Add benchmark scenarios for LOD build, append, query, and memory.
- [x] Confirm benchmark gates after import in this repo.
- [x] Add browser-based renderer benchmarks for WebGPU and Canvas2D paths.

### Definition of Done

- `bun run build`, `bun run typecheck`, and `bun run test` pass.
- LOD benchmark runs from `apps/benchmark`.
- WebGPU path draws at least one line in a browser harness.
- Canvas2D fallback draws the same command list.

## Phase 2 - Headless Primitives and shadcn Architecture

*Goal: Pitant UX apps can compose chart surfaces from headless, accessible,
CSS-variable-themed React primitives before concrete chart types exist.*

### Task Checklist

- [x] Add CSS variable token map and resolver.
- [x] Implement `ChartContainer` with canvas layer and overlay slot.
- [x] Implement `ChartCanvas`.
- [x] Implement `ChartLegend`.
- [x] Implement `ChartTooltip`.
- [x] Implement `ChartSyncGroup` and `useChartSync()`.
- [x] Implement accessibility helpers and data table fallback.
- [x] Implement `useChartTokens()` and `useDimensions()`.
- [x] Implement initial `useChart()` lifecycle, legend state, visible range,
  and export shape.
- [ ] Wire `useChart()` to the data engine and renderer for real drawing.
- [x] Add Storybook or docs examples for every primitive.
- [ ] Add axe or browser accessibility checks for composed examples.

### Definition of Done

- React primitive tests pass.
- All visible styling can be driven through CSS variables and class names.
- A composed primitive demo renders with mock data and no accessibility
  violations.

## Phase 3 - TimeSeries and Data Pipeline

*Goal: `TimeSeries` and `DigitalChannel` render real Pitant time-series data
through the LOD engine, support multi-pen visibility, and provide streaming
append semantics.*

### What Is New

- First actual chart types.
- Data ingestion from typed arrays into the worker-backed engine.
- Draw scheduling that only renders visible, LOD-selected points.
- Multi-pen series model with legend toggles.
- Digital/staircase rendering for binary and state signals.
- Initial streaming append flow.

### Task Checklist

#### Data Layer

- [x] Add columnar data conversion APIs and validation.
- [x] Add `DataSource` abstraction for viewport queries.
- [x] Define `TimeSeriesDataSet`, `TimeSeriesSeries`, and `DigitalChannelSeries`
  public types.
- [x] Add adapters for Pitant historian payloads once the contract is available.
- [x] Make `useTimeSeries()` / `useDigitalChannel()` ingest visible series
  through `DataSource` / `DataEngine` for viewport queries.
- [x] Make `useTimeSeries().append()` / `useDigitalChannel().append()` append
  per-series chunks and update the live visible range when
  `streaming.liveEdge` is enabled.
- [x] Decide whether the legacy generic `useChart().append()` placeholder stays
  as a low-level primitive or is replaced by concrete chart hooks. Decision:
  concrete chart hooks own ingestion; generic methods remain compatibility
  shims that fail explicitly.
- [x] Preserve quality flags and gaps through viewport query results.

#### Rendering

- [x] Implement a chart layout pass for plot area, axes, labels, grid, legend
  reservation, and overlay positioning.
- [x] Render tick labels and axis titles in screen space without disturbing the
  data-space transform used by series and grid lines.
- [x] Implement line command generation from LOD query results.
- [x] Implement gap-aware line breaks.
- [x] Implement linear and step interpolation.
- [x] Implement multi-pen draw ordering and hidden-series filtering.
- [x] Implement DigitalChannel staircase command generation and state labels.
- [x] Add high-DPI resize and redraw invalidation rules.

#### React API

- [x] Export `TimeSeries`, `useTimeSeries()`, and matching prop/config types.
- [x] Export `DigitalChannel` and matching prop/config types.
- [x] Decide whether core classes such as `TimeSeriesChart` are required for
  non-React consumers before v1. Decision: ship thin imperative wrappers over
  the existing render-plan path, without duplicating data-engine ownership.
- [x] Surface renderer/data errors through hook state instead of swallowing
  initialization errors.
- [x] Add a render harness that composes chart content, legend overlays, and
  renderer/profile controls against real data.
- [x] Add docs examples for `ChartContainer`, chart content, legend, tooltip,
  and sync group.

#### Testing And Benchmarks

- [x] Unit test public TimeSeries and DigitalChannel APIs.
- [x] Test multi-series visibility and LOD queries.
- [x] Test gap handling and step interpolation.
- [x] Add benchmark for 8 pens x 1M points.
- [x] Add benchmark for 16 digital channels.
- [x] Add benchmark for live append at the v1 target rate.
- [x] Add browser harness build coverage for large typed-array `TimeSeries`
  and `DigitalChannel` package consumers.
- [x] Add browser screenshot/pixel sanity checks for Canvas2D and
  WebGPU-capable environments.
- [x] Add visual regression once the browser harness exists.

### Definition of Done

- A single-pen `TimeSeries` renders real data.
- An 8-pen `TimeSeries` uses LOD data and supports legend toggles.
- `DigitalChannel` renders at least binary state data with step geometry.
- Streaming append works without full remount or full renderer re-init.
- Tests, typecheck, lint, build, and benchmark smoke checks pass.

## Phase 4 - Interactions and Navigation

*Goal: The line chart feels like a professional historian trend tool with fast,
predictable navigation.*

### Task Checklist

- [x] Implement pointer coordinate mapping between screen and data space.
- [x] Implement region zoom and double-click reset.
- [x] Implement axis-constrained zoom.
- [x] Implement wheel and trackpad zoom.
- [x] Implement hover crosshair and snap-to-nearest data lookup.
- [x] Implement multi-pen tooltip payload generation.
- [x] Include quality, gap, and provenance state in tooltip payloads and default
  tooltip rendering.
- [x] Sync cursor and x-range across multiple charts through `ChartSyncGroup`.
- [x] Implement pan/scroll and keyboard navigation.
- [x] Implement DataZoom slider and minimap.
- [x] Add touch interaction support for mobile browsers.
- [x] Add stress test for 1000 zoom/pan/DataZoom/touch range cycles without
  memory growth.
- [x] Add cursor-propagation latency benchmark for four synchronized panels.
- [x] Add browser FPS benchmark for Canvas2D/WebGPU interaction frame loops.
- [x] Add live-append interaction regression so wheel zoom still works after
  `DataSource.append` moves the live window.

### Definition of Done

- Zoom and pan latency is under one frame for typical v1 datasets.
- Core range math for 1000 mixed interaction updates stays below the 2 ms
  benchmark gate without measured heap growth.
- Cursor sync across four charts propagates below the 1 ms/1000 benchmark gate.
- Browser interaction FPS benchmark passes for Canvas2D and conditionally runs
  WebGPU when `navigator.gpu` is available.
- Tooltip payloads expose quality, gap, and provenance state when supplied by
  upstream data adapters.
- Interactions keep working while streaming data appends.
- Keyboard and touch paths are covered by tests or browser verification.

## Phase 5 - Registry, Documentation, Export, Launch

*Goal: Ship v1 as an installable, documented, performance-gated package.*

### Task Checklist

- [x] Add initial shadcn registry metadata and installable blocks for
  TimeSeries, DigitalChannel, synchronized dashboard, and DataZoom.
- [x] Add shadcn CLI smoke coverage for the initial registry blocks in a fresh
  Vite consumer app.
- [x] Add remaining registry blocks for streaming, multi-axis, export, and
  dashboard overview.
- [x] Add docs site or Storybook with live examples.
- [x] Add first-run quick start for `@pitant/charts` and
  `@pitant/charts-react`.
- [x] Implement PNG export with explicit size, background, and pixel ratio.
- [x] Implement true SVG export from vector command lists.
- [x] Add npm publish workflow with provenance.
- [x] Add changelog and release checklist.
- [x] Finalize v1 package metadata, README files, package changelogs, and
  licenses.
- [x] Add cross-browser CI matrix for Chrome, Firefox, Safari, and Edge.
- [x] Add bundle-size gates.
- [x] Add performance regression gates.

### Definition of Done

- New user can install and render the first chart in under five minutes.
- Registry blocks install successfully.
- npm packages are publishable from CI.
- v1 performance and accessibility gates pass.

## Phase 6 - Post-v1 Industrial Packs

*Goal: Expand beyond line charts only after v1 is field-tested.*

### Planned Releases

| Release | Theme | Representative work |
|---|---|---|
| v1.1 | Analyst workbench | Persistent data tips, ruler, brush persistence, alarm bands, envelope bands, annotations, derived series |
| v1.2 | Industrial visualization | Spectrogram, power spectrum, Bode, histogram, box/violin, control charts, process KPIs |
| v1.3 | Correlation and anomaly | Scatter, correlation matrix, parallel coordinates, anomaly timeline, root cause bars, PDF export |

### Initial Progress

- [x] Added `TimeSeriesConfig.bands[]` for value bands and envelope bands.
- [x] Added core command-frame band fills so Canvas2D, WebGPU, and SVG export
  share the same path.
- [x] Added `020_time_series_bands_8x1M` benchmark for eight high-density
  trend pens plus alarm/envelope bands.

## Deliberately Not Building For v1

- General dashboard charts: pie, donut, funnel, treemap, Sankey.
- Geographic map rendering.
- 3D scene or surface rendering.
- Server-side chart rendering.
- Data fetching or application state management.
- Drag-and-drop dashboard builder.
- Full industrial chart catalogue before the line chart is excellent.
- PDF export before PNG and SVG are production ready.
- Vue and Svelte bindings before React v1 is stable.

## Verification Commands

Run these after meaningful code changes:

```bash
bun install
bun run build
bun run harness:build
bun run harness:verify
bun run harness:fps
bun run typecheck
bun run lint
bun run test
bun run bench
```

Browser-rendering work also needs a local browser verification harness before
being marked complete.

## Source References

- Detailed master plan: `plan/00-master-plan.md`
- Foundation plan: `plan/01-foundation-rendering.md`
- Primitive plan: `plan/02-headless-primitives.md`
- TimeSeries plan: `plan/03-timeseries-data-pipeline.md`
- Interaction plan: `plan/04-interactions-navigation.md`
- Launch plan: `plan/05-registry-launch.md`
- Post-v1 plan: `plan/06-post-v1-roadmap.md`
- Product definition: `project.md`
- Architecture summary: `ARCHITECTURE.md`
