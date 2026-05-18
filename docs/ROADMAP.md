# @pitant/charts Roadmap

**Status:** Phase 3 in progress  
**Last updated:** 2026-05-18  
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
- CSS token resolution and `packages/charts/styles/tokens.css`.
- React primitives: `ChartContainer`, `ChartCanvas`, `ChartLegend`,
  `ChartTooltip`, `ChartSyncGroup`, accessibility helpers, `useDimensions`,
  `useChartTokens`, and early `useChart()`.
- Unit tests for data engine, data source, LOD, renderer command list, theming,
  public API, and React primitives.

Known gaps before v1:

- No concrete `TimeSeries` chart implementation yet.
- No concrete `DigitalChannel` chart implementation yet.
- `useChart().append()` and `setData()` are API placeholders rather than
  complete data-engine ingestion and redraw flows.
- No production axis/layout engine.
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
| 3 | TimeSeries and data pipeline | In progress | TimeSeries, DigitalChannel, data ingestion, streaming |
| 4 | Interactions and navigation | Not started | Zoom, pan, crosshair, DataZoom, linked ranges |
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
- [ ] Confirm benchmark gates after import in this repo.
- [ ] Add browser-based renderer benchmarks for WebGPU and Canvas2D paths.

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
- [ ] Add Storybook or docs examples for every primitive.
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
- [ ] Define `TimeSeriesDataSet`, `TimeSeriesSeries`, and `DigitalChannelSeries`
  public types.
- [ ] Add adapters for Pitant historian payloads once the contract is available.
- [ ] Make `useChart().setData()` ingest each visible series through
  `DataEngine`.
- [ ] Make `useChart().append()` append per-series chunks and update the live
  visible range when `streaming.liveEdge` is enabled.
- [ ] Preserve quality flags and gaps through viewport query results.

#### Rendering

- [ ] Implement a chart layout pass for plot area, axes, labels, grid, legend
  reservation, and overlay positioning.
- [ ] Implement line command generation from LOD query results.
- [ ] Implement gap-aware line breaks.
- [ ] Implement linear and step interpolation.
- [ ] Implement multi-pen draw ordering and hidden-series filtering.
- [ ] Implement DigitalChannel staircase command generation and state labels.
- [ ] Add high-DPI resize and redraw invalidation rules.

#### React API

- [ ] Export `TimeSeries`, `useTimeSeries()`, and matching prop/config types.
- [ ] Export `DigitalChannel` and matching prop/config types.
- [ ] Decide whether core classes such as `TimeSeriesChart` are required for
  non-React consumers before v1.
- [ ] Surface renderer/data errors through hook state instead of swallowing
  initialization errors.
- [ ] Add examples that compose `ChartContainer`, chart content, legend,
  tooltip, and sync group.

#### Testing And Benchmarks

- [ ] Unit test public TimeSeries and DigitalChannel APIs.
- [ ] Test multi-series visibility and LOD queries.
- [ ] Test gap handling and step interpolation.
- [ ] Add benchmark for 8 pens x 1M points.
- [ ] Add benchmark for live append at the v1 target rate.
- [ ] Add visual regression once the browser harness exists.

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

- [ ] Implement pointer coordinate mapping between screen and data space.
- [ ] Implement region zoom and double-click reset.
- [ ] Implement axis-constrained zoom.
- [ ] Implement wheel and trackpad zoom.
- [ ] Implement pan/scroll and keyboard navigation.
- [ ] Implement hover crosshair and snap-to-nearest data lookup.
- [ ] Implement multi-pen tooltip payload generation.
- [ ] Implement DataZoom slider and minimap.
- [ ] Sync cursor and x-range across multiple charts through `ChartSyncGroup`.
- [ ] Add touch interaction support for mobile browsers.
- [ ] Add stress test for 1000 zoom/pan cycles without memory growth.

### Definition of Done

- Zoom and pan latency is under one frame for typical v1 datasets.
- Cursor sync across four charts propagates in one frame.
- Interactions keep working while streaming data appends.
- Keyboard and touch paths are covered by tests or browser verification.

## Phase 5 - Registry, Documentation, Export, Launch

*Goal: Ship v1 as an installable, documented, performance-gated package.*

### Task Checklist

- [ ] Add shadcn registry metadata and installable blocks.
- [ ] Add docs site or Storybook with live examples.
- [ ] Add first-run quick start for `@pitant/charts` and
  `@pitant/charts-react`.
- [ ] Implement PNG export with explicit size, background, and pixel ratio.
- [ ] Implement true SVG export from vector command lists.
- [ ] Add npm publish workflow with provenance.
- [ ] Add changelog and release checklist.
- [ ] Add cross-browser CI matrix for Chrome, Firefox, Safari, and Edge.
- [ ] Add bundle-size gates.
- [ ] Add performance regression gates.

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
bun run typecheck
bun run lint
bun run test
bun run build
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
