# 02 - Core Features and Process Families

This document names the process families that organize `pitant-charts`.
`06-FEATURE-SPEC-INVENTORY.md` is the scope source of truth; this document turns
that inventory into implementation-facing ownership boundaries.

## Runtime Pipeline

```
pitant-historian / pitant-spc / pitant-oee
              │
              ▼
        1. ingest data
              │
              ▼
        2. normalize semantics
              │
              ▼
        3. transform / LOD
              │
              ▼
        4. layout view
              │
              ▼
        5. render pixels
              │
              ├──────────────▶ 6. interact
              │                       │
              ▼                       ▼
        7. compose UI ◀────── 8. synchronize
              │
              ├──────────────▶ 9. export
              ▼
        10. package / document / benchmark
```

## Process Family Table

| Family | What it owns | Why it matters |
|---|---|---|
| Ingest | Typed chart inputs, adapters, series registration | Makes historian and analytics payloads renderable without vendor types |
| Normalize | Time, units, quality, gaps, provenance, and value semantics | Prevents clean-looking but false charts |
| Transform | LOD pyramid, decimation, streaming buffers, derived visual data | Keeps frame cost bounded |
| Layout | Axes, scales, grid, panels, labels, lanes, overlays | Makes chart geometry deterministic |
| Render | WebGPU and Canvas2D contexts, shaders, command lists, text | Replaces SciChart's rendering role |
| Interact | Zoom, pan, cursor, brush, data tips, selection, keyboard/touch | Makes charts usable as investigation tools |
| Compose | React primitives, hooks, containers, legends, tooltips, sync groups | Lets Pitant apps own workflow composition |
| Synchronize | Cross-chart cursor, ranges, series visibility, replayed view state | Makes multi-panel historian workflows coherent |
| Theme | CSS tokens, high contrast, accessibility, reduced motion | Aligns with Pitant design system and shadcn conventions |
| Export | PNG, SVG, PDF, replay spec, evidence metadata | Makes chart output reviewable and auditable |
| Benchmark | Performance scenarios, budgets, regression gates | Prevents performance claims from becoming anecdotes |
| Package | npm packages, shadcn registry, docs, migration notes | Makes the library installable and replaceable in apps |
| Govern | Profile gates, claim status, safety display rules, boundary checks | Keeps the chart package from overclaiming or actuating |

## Ingest

**Purpose.** Accept chart-ready input from Pitant repos and user code without
binding callers to renderer internals.

**Inputs.** `Float64Array`, `BigInt64Array`, `ColumnarData`, future
`pitant-contracts` historian windows, SPC result sets, OEE time buckets, batch
profiles, anomaly tracks, and local demo fixtures.

**Outputs.** Series definitions, typed data sources, validation issues, and
worker-transferable buffers.

**Contract surface.** `DataInput`, `ColumnarData`, `DataSource`,
`TimeSeriesDataSet`, future generated contract adapters.

**Parity bar.** Match SciChart-style array and series registration ergonomics
while remaining Pitant-native.

**Where we exceed.** Every input path carries quality, gap, provenance, and
tenant/site context instead of treating points as anonymous numbers.

## Normalize

**Purpose.** Convert raw chart input into semantically safe render data.

**Inputs.** Series metadata, timestamps, values, quality flags, units, value
types, gap thresholds, correction state, alarm thresholds, and asset context.

**Outputs.** Normalized series windows, quality/gap masks, unit labels, value
formatters, and safety-visible degraded states.

**Contract surface.** Quality-code enums, unit metadata, formatter contracts,
gap policy, and provenance labels.

**Parity bar.** Provide the unit labels, time formatting, and gap behavior users
expect in industrial trends.

**Where we exceed.** Bad and uncertain data cannot be rendered as ordinary
healthy values without an explicit policy.

## Transform

**Purpose.** Bound data volume and produce viewport-resolution data for drawing.

**Inputs.** Normalized series, viewport range, pixel width, streaming append
batches, downsampling policy, interpolation policy.

**Outputs.** LOD query results, render-ready typed arrays, derived series,
step-line points, envelope regions, heatmap tiles.

**Contract surface.** `DataEngine`, `LodPyramid`, `ViewportQuery`,
`QueryResult`, streaming buffer policy.

**Parity bar.** Smooth million-point trends and live append without main-thread
freezes.

**Where we exceed.** Min-max preservation is default and quality/gap propagation
survives transformation.

## Layout

**Purpose.** Compute deterministic geometry before any renderer draws.

**Inputs.** Dimensions, device pixel ratio, scales, axes, panels, legend
reservations, overlay lanes, font metrics, interaction state.

**Outputs.** Plot rectangles, axis ticks, grid lines, label positions, overlay
lanes, command-list z-layers.

**Contract surface.** Layout model, axis config, lane config, viewport state.

**Parity bar.** Match SciChart/Plotly-quality axes, legends, and multi-panel
alignment.

**Where we exceed.** Layout encodes evidence and degraded-state lanes rather
than requiring app-specific overlays.

## Render

**Purpose.** Draw backend-agnostic commands through WebGPU or Canvas2D.

**Inputs.** Render command lists, vertex buffers, view transforms, resolved
tokens, clip regions, text labels.

**Outputs.** Canvas pixels, renderer capabilities, render timing, export vector
commands.

**Contract surface.** `RenderContext`, `createRenderContext()`, command list,
renderer capabilities.

**Parity bar.** High-performance anti-aliased lines with Canvas fallback.

**Where we exceed.** WebGPU is the primary architecture and command generation
is reusable for true vector export.

## Interact

**Purpose.** Provide investigation-grade navigation and selection.

**Inputs.** Pointer, wheel, keyboard, touch, chart bounds, data transforms,
series query indexes.

**Outputs.** Visible range updates, cursor state, selected ranges, pinned data
tips, brush regions, synced view events.

**Contract surface.** Gesture state machines, cursor payloads, data tip model,
selection model.

**Parity bar.** Zoom, pan, crosshair, tooltip, data zoom, and reset behavior
must feel at least as professional as SciChart.

**Where we exceed.** Interaction state is replayable and can carry proof,
review, and evidence metadata.

## Compose

**Purpose.** Expose headless React primitives and hooks without forcing a
dashboard framework.

**Inputs.** Chart configs, refs, children, class names, style tokens, sync
contexts, data source handles.

**Outputs.** `ChartContainer`, `ChartCanvas`, `ChartLegend`, `ChartTooltip`,
`ChartSyncGroup`, hooks, and future chart components.

**Contract surface.** `@pitant/charts-react` public exports.

**Parity bar.** React users can assemble charts with predictable refs and
composition behavior.

**Where we exceed.** Components follow Pitant/shadcn ownership: app teams can
style and rearrange primitives without inheriting a monolith.

## Synchronize

**Purpose.** Coordinate multiple chart instances without hidden global state.

**Inputs.** Cursor timestamps, x/y ranges, zoom events, visible series, replay
view IDs, source chart IDs.

**Outputs.** Synchronized range state, cursor broadcasts, conflict resolution,
source attribution.

**Contract surface.** `ChartSyncGroup`, `useChartSync()`, future sync-event
schema.

**Parity bar.** Four historian panels can share cursor and range state in one
frame.

**Where we exceed.** Sync events preserve tenant/site and evidence context so
charts cannot accidentally cross trust boundaries.

## Theme

**Purpose.** Resolve visual tokens consistently across renderers and DOM
overlays.

**Inputs.** CSS custom properties, design-system defaults, high-contrast mode,
reduced-motion preference, series palette.

**Outputs.** `ChartTokens`, resolved RGBA values, DOM classes, accessibility
states.

**Contract surface.** `tokens.css`, `resolveTokens()`, `useChartTokens()`.

**Parity bar.** Light, dark, and high-contrast themes are predictable.

**Where we exceed.** The renderer and DOM overlays share the same token source.

## Export

**Purpose.** Turn a chart view into a portable artifact without lying about data
state.

**Inputs.** Render commands, layout state, data window, quality/gap masks,
theme, export dimensions, evidence metadata.

**Outputs.** PNG, SVG, PDF, replay spec, data slice manifest, checksum.

**Contract surface.** `exportImage()`, future `exportViewSpec()`,
`ExportOptions`.

**Parity bar.** Export at least PNG and SVG with correct dimensions and labels.

**Where we exceed.** Export includes the view state required to reproduce the
image and the warning labels needed for degraded data.

## Benchmark

**Purpose.** Keep performance measurable.

**Inputs.** Synthetic series, real fixtures, benchmark scenarios, browser
capabilities, baseline JSON.

**Outputs.** Timing metrics, memory overhead, FPS, regression reports.

**Contract surface.** `apps/benchmark`, `baseline.json`, CI gates.

**Parity bar.** Benchmark claims are repeatable from a clean checkout.

**Where we exceed.** Performance targets are tied to process-engineering
workflows, not generic chart demos.

## Package

**Purpose.** Make the library installable, documented, and replaceable.

**Inputs.** Package exports, registry entries, docs examples, changelog,
compatibility notes.

**Outputs.** npm packages, shadcn blocks, docs site, migration guides.

**Contract surface.** `package.json` exports, shadcn registry, README, docs.

**Parity bar.** New users can render a chart in under five minutes.

**Where we exceed.** Blocks are Pitant-ready with quality, gap, and evidence
fixtures rather than decorative examples only.

## Govern

**Purpose.** Keep claims, profile gates, and safety boundaries explicit.

**Inputs.** Mode vectors, maturity labels, profile gates, evidence fixtures,
contract status.

**Outputs.** Claim ledger, feature status, profile-disabled behavior, route or
component metadata.

**Contract surface.** Architecture docs, future component metadata, fixture
labels.

**Parity bar.** No user or sales deck can mistake a simulated chart feature for
production.

**Where we exceed.** Readiness is visible in code, docs, fixtures, and UI.

## Cross-Family Invariants

- Tenant, site, zone, asset, and trace context are preserved whenever supplied.
- Quality and gap state are never silently dropped.
- Renderer selection does not change public data semantics.
- Worker messages are bounded and transferable where possible.
- The core package remains free of runtime dependencies unless the roadmap is
  explicitly updated.
- Every feature with a visible UI state has success, degraded, denied, and
  validation-error fixture expectations.
