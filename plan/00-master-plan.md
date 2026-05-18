# @pitant/charts — Master Project Plan

**Version:** 3.0  
**Date:** 2026-04-05  
**Status:** Planning  
**V1 Product Promise:** The fastest line chart in the browser. WebGPU-accelerated, shadcn-native, streaming-capable, composable multi-pen time-series — nothing else until it's perfect.

> **Scope Rule:** V1.0 ships **performant line charts only**. No spectrogram, no SPC, no scatter, no correlation, no histograms. Those are post-v1 expansions. Every decision, every epic, every KPI is evaluated against one question: *does this make the line chart faster, more composable, or more production-ready?*

---

## Table of Contents

1. [Product Pillars](#1-product-pillars)
2. [V1 Scope Definition](#2-v1-scope-definition)
3. [Phase Map](#3-phase-map)
4. [Epic Registry](#4-epic-registry)
5. [KPI Dashboard](#5-kpi-dashboard)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Dependency Graph](#7-dependency-graph)
8. [Risk Register](#8-risk-register)
9. [Decision Log](#9-decision-log)
10. [Post-V1 Roadmap](#10-post-v1-roadmap)
11. [Document Index](#11-document-index)

---

## 1. Product Pillars

V1 succeeds on **two axes simultaneously**. Failing at either makes it niche or undifferentiated.

### Pillar A: shadcn-Native Composable Line Chart

| Attribute | Requirement | Rationale |
|---|---|---|
| **Headless primitives** | `ChartContainer`, `ChartLegend`, `ChartTooltip`, `ChartSyncGroup` — not a monolithic `<TimeSeriesChart options={...} />` | shadcn charts are composed from small primitives, not configured via giant prop objects |
| **CSS-variable theming** | All colors, spacing, fonts, radii read from `var(--chart-*)` and `var(--color-*)` CSS custom properties. No JS theme objects required. | shadcn's theming is CSS-variable-first with Tailwind integration |
| **Registry distribution** | Ship a `shadcn` registry with JSON-described blocks: `line-chart`, `multi-pen-trend`, `live-stream-chart` | shadcn CLI consumes community registries for copy-paste installation |
| **No lock-in** | Components are yours — thin React wrappers, imperative escape hatches, no mandatory providers | shadcn's core philosophy: "the components are yours" |
| **Accessibility built-in** | Keyboard nav, screen reader, data-table fallback, high-contrast, reduced motion | shadcn's chart docs call out accessibility as a first-class layer |
| **Tailwind class hooks** | Every visual element exposes `className` props and uses `cn()` utility for composition | Standard shadcn pattern for style override |
| **Minimal client footprint** | Core line chart bundle ≤ 80 KB gzip. Tree-shakeable ESM. No server dependency. | Copy-paste components must not bloat apps |

### Pillar B: Fastest Line Chart in the Browser

| Attribute | Requirement | Rationale |
|---|---|---|
| **WebGPU primary rendering** | GPU-accelerated line drawing with instanced geometry, analytical anti-aliasing, SDF text | No JS charting library uses WebGPU for line rendering today — this is the differentiator |
| **Canvas2D fallback** | Feature-parity fallback when WebGPU unavailable. Same API, same interactions. | Broad browser support until WebGPU reaches full coverage |
| **Multi-resolution data model** | Min-max LOD pyramid, time-windowed queries, O(1) viewport resolution | 10M+ points cannot render raw — need LOD that preserves spikes and valleys |
| **True streaming mode** | Append-only ring buffer, viewport-local redraw, backpressure policy, paused/live modes | 100 kHz sustained streaming requires bounded memory and O(1) append |
| **Data ingestion** | Batch load ≥ 5M pts/sec; sustained streaming ≥ 100K pts/sec/pen | SciChart peaks at 40M pts/sec — WebGPU compute shaders enable competitive ingestion |
| **Multi-pen capacity** | ≥ 16 pens at 1M pts each at ≥ 60 fps; ≥ 64 pens at lower point counts | SciChart handles 90+ simultaneous series; PITANT spec: 48-channel process recording |
| **Web Worker data engine** | LOD pyramid build, viewport queries, streaming append — all off main thread | Main thread stays free for rendering and interaction at 60 fps |

---

## 2. V1 Scope Definition

### V1 IS

| Category | What Ships |
|---|---|
| **Chart Types** | `TimeSeries` (multi-pen line chart with LOD), `DigitalChannel` (binary/staircase line chart) |
| **Rendering** | WebGPU line renderer + Canvas2D fallback + auto-selection |
| **Data Engine** | Web Worker, min-max LOD pyramid, streaming ring buffer, gap detection |
| **Primitives** | `ChartContainer`, `ChartLegend`, `ChartTooltip`, `ChartSyncGroup` |
| **Interactions** | Region zoom, axis-constrained zoom, pan/scroll, hover crosshair + snap tooltip, DataZoom slider, linked cursor sync |
| **Theming** | CSS-variable system (`var(--chart-*)`), light/dark/high-contrast, Tailwind integration |
| **Accessibility** | Keyboard navigation, screen reader data-table fallback, focus indicators, reduced motion |
| **Distribution** | shadcn registry blocks, npm publish, documentation site with live examples |
| **Export** | PNG, SVG |
| **Quality** | Cross-browser testing, performance regression CI, benchmark harness |

### V1 IS NOT

| Category | Deferred To |
|---|---|
| Spectrogram, PowerSpectrum, BodePlot, WaterfallPlot, NyquistPlot | v1.2 |
| Histogram, BoxWhisker, ViolinPlot, QQPlot, ControlChart | v1.2 |
| ScatterPlot, CorrelationMatrix, ParallelCoordinates, PCABiplot | v1.3 |
| AnomalyTimeline, FusionScorePlot, RootCauseBar, DetectorHeatmap | v1.3 |
| Persistent data tips (multiple pinned) | v1.1 |
| Ruler / measurement cursors | v1.1 |
| Brush & selection persistence | v1.1 |
| Restore-view stack (undo/redo zoom) | v1.1 |
| Compare-to-past overlay | v1.1 |
| Reference time pin | v1.1 |
| ChartTable (table twin) | v1.1 |
| AlarmBand overlays | v1.1 |
| EnvelopeBand, AnomalyScoreTrack | v1.1 |
| Annotation system with lane management | v1.1 |
| Derived series engine (diff, rolling mean, etc.) | v1.1 |
| PDF export | v1.1 |
| Process KPIs (Gauge, Bullet, Sparkline) | v1.2 |
| Vue / Svelte bindings | v2.0 |

---

## 3. Phase Map

### V1.0 — Performant Line Charts (24 weeks)

```
Phase 1 ─── Foundation & Rendering Engine ──────────── Weeks 1-5    │ 6 Epics  │  84 SP
Phase 2 ─── Headless Primitives & shadcn Architecture ─ Weeks 6-10   │ 7 Epics  │  71 SP
Phase 3 ─── TimeSeries Line Chart & Data Pipeline ──── Weeks 11-16  │ 4 Epics  │  89 SP
Phase 4 ─── Interactions & Navigation ─────────────── Weeks 17-20  │ 5 Epics  │  42 SP
Phase 5 ─── Registry, Documentation & Launch ───────── Weeks 21-24  │ 5 Epics  │  47 SP
                                                      V1 TOTAL: 27 Epics │ 333 SP
```

### Post-V1 — Expansion Roadmap (see §10)

```
v1.1 ────── Analysis Interactions & Overlays ──────── +8 weeks   │ ~15 Epics │ ~140 SP
v1.2 ────── Spectral, Statistics & SPC ────────────── +12 weeks  │ ~16 Epics │ ~170 SP
v1.3 ────── Correlation & Anomaly Detection ──────── +8 weeks   │ ~10 Epics │ ~120 SP
```

### V1 Phase Definitions

| Phase | Name | Goal | Entry Criteria | Exit Criteria | Gate KPI |
|---|---|---|---|---|---|
| **1** | Foundation & Rendering Engine | A blank canvas draws an anti-aliased line at 60 fps via WebGPU, with Canvas2D fallback, and a Web Worker builds a min-max LOD pyramid. No chart types yet — pure infrastructure. | Project approved, mono-repo created | WebGPU renders 1M-point line at ≥ 60 fps; Canvas2D renders 100K at ≥ 60 fps; benchmark harness green | FPS ≥ 60 @ 1M pts; LOD pyramid build < 100 ms |
| **2** | Headless Primitives & shadcn Architecture | `ChartContainer`, `ChartLegend`, `ChartTooltip`, `ChartSyncGroup` exist as headless, CSS-variable-themed, accessible React primitives. No chart content yet — pure composition layer. | Phase 1 exit | All 4 primitives render with `var(--chart-*)` tokens; axe-core 0 violations; Storybook catalog for all primitives | 0 axe violations; theming 100%; ≤ 15 KB gzip per primitive |
| **3** | TimeSeries Line Chart & Data Pipeline | `TimeSeries` (multi-pen line chart) and `DigitalChannel` (binary/staircase) render real data via the LOD pyramid. Streaming append works. This is the **entire v1 product** — a line chart that beats everything. | Phase 2 exit | 8-pen TimeSeries at 1M pts/pen renders at ≥ 60 fps; live append at 1 kHz sustains 60 fps; DigitalChannel renders 16 channels at ≥ 60 fps | 8M points < 1 s initial; streaming 60 fps; 8-pen legend works |
| **4** | Interactions & Navigation | Region zoom, axis-constrained zoom, pan/scroll, hover crosshair with snap tooltip, DataZoom slider + minimap, linked cursor/zoom sync across charts. The interactions that make the line chart feel professional. | Phase 3 exit | All 5 interaction modes work on TimeSeries with 10M points; DataZoom slider syncs with main chart; cursor syncs across 4 charts | Interaction latency < 8 ms; zoom < 1 frame; sync propagation < 1 frame |
| **5** | Registry, Documentation & Launch | shadcn registry blocks for line chart, docs site with live examples, PNG/SVG export, npm publish pipeline, cross-browser CI, performance regression gates. Ship it. | Phase 4 exit | ≥ 3 shadcn registry blocks installable; docs site live; npm published; CI green on Chrome/Firefox/Safari/Edge; all performance KPIs met | Registry install 100%; lighthouse a11y ≥ 95; zero visual regression |

---

## 4. Epic Registry

### Naming Convention

Epics follow the format: `E{phase}.{sequence} — {Name}`

### V1.0 Epics

| Epic ID | Phase | Name | Priority | Est. SP |
|---|---|---|---|---|
| **E1.1** | 1 | Mono-Repo & Build Infrastructure | P0 | 13 |
| **E1.2** | 1 | WebGPU Line Renderer | P0 | 21 |
| **E1.3** | 1 | Canvas2D Fallback Renderer | P0 | 13 |
| **E1.4** | 1 | Auto-Renderer Selection & Abstraction | P0 | 8 |
| **E1.5** | 1 | Data Engine (Web Worker + LOD Pyramid) | P0 | 21 |
| **E1.6** | 1 | Benchmark Harness & Performance CI | P0 | 8 |
| **E2.1** | 2 | CSS Variable Theming System | P0 | 13 |
| **E2.2** | 2 | ChartContainer Primitive | P0 | 8 |
| **E2.3** | 2 | ChartLegend Primitive | P0 | 8 |
| **E2.4** | 2 | ChartTooltip Primitive | P0 | 8 |
| **E2.5** | 2 | ChartSyncGroup Primitive | P0 | 8 |
| **E2.6** | 2 | Accessibility Layer | P0 | 13 |
| **E2.7** | 2 | React 19 Composition Bindings | P0 | 13 |
| **E3.1** | 3 | TimeSeries Line Chart (Multi-Pen, LOD-Aware) | P0 | 34 |
| **E3.2** | 3 | Multi-Resolution Data Model API | P0 | 21 |
| **E3.3** | 3 | Streaming Engine (Ring Buffer, Live Edge) | P0 | 21 |
| **E3.4** | 3 | DigitalChannel Line Chart | P0 | 13 |
| **E4.1** | 4 | Region Zoom & Axis-Constrained Zoom | P0 | 8 |
| **E4.2** | 4 | Pan, Scroll & Keyboard Navigation | P0 | 5 |
| **E4.3** | 4 | Hover Crosshair & Snap Tooltip | P0 | 8 |
| **E4.4** | 4 | DataZoom (Slider + Minimap) | P0 | 13 |
| **E4.5** | 4 | Linked Axes & Cursor Sync | P0 | 8 |
| **E5.1** | 5 | shadcn Registry Blocks | P0 | 13 |
| **E5.2** | 5 | Documentation Site with Live Examples | P0 | 13 |
| **E5.3** | 5 | Export Engine (PNG, SVG) | P0 | 8 |
| **E5.4** | 5 | npm Publish Pipeline & CI | P0 | 5 |
| **E5.5** | 5 | Cross-Browser Testing & Hardening | P0 | 8 |

**V1 Total: 27 Epics — 333 Story Points — 24 Weeks**

---

## 5. KPI Dashboard

### Global KPIs (tracked every PR)

| KPI | Target | Measurement Method |
|---|---|---|
| **Render FPS @ 1M points (WebGPU)** | ≥ 60 fps | rAF delta in Playwright benchmark |
| **Render FPS @ 10M points (WebGPU)** | ≥ 60 fps | rAF delta in Playwright benchmark |
| **Render FPS @ 100K points** | ≥ 60 fps | rAF delta in Playwright benchmark |
| **Initial render @ 1M points** | < 100 ms | FCP in Playwright |
| **Initial render @ 10M points** | < 500 ms | FCP in Playwright |
| **Data ingestion rate (batch load)** | ≥ 5M pts/sec | Worker benchmark |
| **Bundle size (core line chart, tree-shaken)** | ≤ 80 KB gzip | `bun build --minify` |
| **Memory @ 1M pts single chart** | ≤ 40 MB | `measureUserAgentSpecificMemory()` |
| **Memory @ 8-pen 1M pts each** | ≤ 120 MB | Same |
| **Axe-core violations** | 0 | axe-core + Playwright |
| **Visual regression diff** | < 0.1% | Playwright `toMatchSnapshot()` |
| **TypeScript strict violations** | 0 `any` | `tsc --noEmit` |
| **Biome lint violations** | 0 errors | `biome check` |
| **Test coverage (data engine)** | ≥ 95% | Vitest c8 |
| **Test coverage (rendering/layout)** | ≥ 90% | Vitest c8 |
| **Worker init time** | < 50 ms | Performance.mark |
| **LOD pyramid build @ 1M pts** | < 100 ms | Performance.mark |

### Phase-Specific KPIs

| Phase | KPI | Target |
|---|---|---|
| 1 | WebGPU line draw call count (1 series) | = 1 |
| 1 | Canvas2D fallback activates when `navigator.gpu` unavailable | 100% reliable |
| 1 | LOD pyramid memory overhead vs raw data | ≤ 2× raw size |
| 2 | Individual primitive bundle size | ≤ 15 KB gzip each |
| 2 | CSS variable coverage (all visual properties) | 100% |
| 2 | Keyboard navigation paths (all primitives) | 100% |
| 3 | Streaming append overhead per sample | < 2 µs |
| 3 | 8-pen TimeSeries + DigitalChannel initial render | < 1 s for 8M total points |
| 3 | Live append at 1 kHz sustains target FPS | ≥ 60 fps |
| 3 | Gap detection accuracy | 100% on test suite |
| 3 | DigitalChannel render for 16 channels | ≥ 60 fps |
| 4 | Zoom interaction latency (pointer → re-render) | < 8 ms |
| 4 | Pan smoothness at 1M points | ≥ 60 fps sustained |
| 4 | Pan smoothness at 10M points | ≥ 30 fps sustained |
| 4 | DataZoom slider ↔ main chart sync | < 1 frame |
| 4 | Cursor sync propagation across 4 charts | < 1 frame |
| 5 | shadcn registry block CLI install success | 100% |
| 5 | PNG export (1920×1080, 8 pens) | < 200 ms |
| 5 | SVG export (1920×1080, 8 pens) | < 500 ms |
| 5 | Cross-browser visual parity (Chrome/Firefox/Safari/Edge) | < 1% pixel diff |
| 5 | Lighthouse accessibility score | ≥ 95 |

---

## 6. Cross-Cutting Concerns

### 6.1 shadcn Compatibility Contract

Every component and primitive MUST satisfy:

1. **CSS Variable Only** — No hardcoded colors, fonts, spacing, radii. All read from `var(--*)`.
2. **Tailwind Class Hooks** — Every visual element accepts `className`. Uses `cn()` for merge.
3. **Headless Composition** — Primitives render no visual chrome by default. Styles are opt-in via className or CSS variables.
4. **No Forced Wrapper** — No required `<ChartProvider>` or context. Context is opt-in for sync groups.
5. **Imperative Escape Hatch** — Every component exposes `ref` with imperative methods.
6. **Tree-Shakeable** — Import only what you use. No side effects at module level.
7. **Registry Described** — Every shipped block has a JSON registry entry consumable by `npx shadcn add`.

### 6.2 Streaming Semantics Contract

| Parameter | Device/HMI Mode | Historian/Cloud Mode |
|---|---|---|
| Max sustained samples/sec/pen | 100,000 (100 kHz) | 1,000 (1 kHz) |
| Max pens in live mode | 16 | 64 |
| Append latency budget | < 0.5 ms | < 8 ms |
| Dropped-frame policy | Skip render, preserve data | Decimate to viewport resolution |
| Decimation policy while live | Latest N in ring buffer | LOD pyramid auto-level |
| Memory cap per chart | 128 MB | 1 GB |
| Memory cap per session | 512 MB | 4 GB |
| History retention | Ring buffer (configurable depth) | Full (pyramid + raw if available) |
| Backpressure signal | Drop oldest, warn | Throttle append, queue |

### 6.3 Line Chart Interaction Contract (V1)

| Interaction | V1 Behavior |
|---|---|
| **Hover crosshair** | Vertical crosshair follows cursor. Snaps to nearest data point. Shows tooltip with timestamp + value for all visible pens. |
| **Region zoom** | Click-drag to select rectangular region → zoom to fit. Shift+drag for axis-constrained (X-only or Y-only). |
| **Pan / scroll** | Middle-click drag or two-finger pan. Scroll wheel for Y-axis zoom. Shift+scroll for X-axis zoom. |
| **DataZoom slider** | Minimap below chart shows full data range. Drag handles to set viewport window. Bidirectional sync with main chart. |
| **Linked cursor sync** | Cursor position propagates across all charts in a `ChartSyncGroup`. Zoom/pan also propagates. |
| **Keyboard nav** | Arrow keys to move between data points. +/- to zoom. Home/End for data range. Tab between chart regions. |

### 6.4 Performance Budget Contract

| Metric | Hard Limit | Action If Exceeded |
|---|---|---|
| Bundle size (core) | 80 KB gzip | PR blocked; must tree-shake or code-split |
| Bundle size (core + all primitives) | 120 KB gzip | PR blocked |
| Render FPS @ 1M pts | < 50 fps | PR blocked; must optimize or skip |
| Render FPS @ 10M pts | < 30 fps | PR blocked; must optimize or skip |
| Initial render @ 1M pts | > 150 ms | PR warning; blocked at > 300 ms |
| Memory @ 1M pts | > 50 MB | PR warning; blocked at > 80 MB |
| Worker init | > 75 ms | PR warning; blocked at > 100 ms |
| LOD build @ 1M pts | > 150 ms | PR warning; blocked at > 200 ms |

---

## 7. Dependency Graph

### V1 Critical Path

```
Phase 1: Foundation & Rendering ◄─── no dependencies
    │
    ▼
Phase 2: Headless Primitives ◄─── depends on Phase 1 (renderer abstraction, canvas management)
    │
    ▼
Phase 3: TimeSeries & Data Pipeline ◄─── depends on Phase 2 (primitives to compose the chart)
    │
    ▼
Phase 4: Interactions & Navigation ◄─── depends on Phase 3 (chart exists to interact with)
    │
    ▼
Phase 5: Registry, Docs & Launch ◄─── depends on Phase 4 (complete product to ship)
```

**V1 is a strict linear chain.** No parallelism within v1 — each phase builds directly on the previous. This is intentional: a small team focused on one thing.

### Post-V1 Parallelism

```
          Phase 5 (V1 shipped)
               │
    ┌──────────┼──────────────────────┐
    ▼          ▼                      ▼
  v1.1       v1.2                   v1.3
  Analysis   Spectral + SPC        Correlation + Anomaly
  Overlays   (parallel after v1.1) (parallel after v1.1)
```

---

## 8. Risk Register

### V1 Risks

| ID | Risk | Phase | Probability | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | WebGPU unavailable on target deployment | 1 | Medium | High | Canvas2D fallback with feature parity; auto-detection; perf warning when falling back |
| R2 | WebGPU instanced line quality varies by GPU vendor | 1 | Medium | Medium | Test matrix: Intel/AMD/Apple/NVIDIA; analytical AA as fallback; visual regression CI |
| R3 | Web Worker message overhead exceeds budget | 1 | Low | High | Transferable ArrayBuffers; SharedArrayBuffer opt-in; skip worker for <10K pts |
| R4 | CSS variable theming conflicts with existing app variables | 2 | Medium | Low | Namespace all vars as `--pc-*`; provide CSS layer isolation docs |
| R5 | shadcn registry format changes before launch | 2, 5 | Low | Medium | Pin registry schema version; abstract generation behind build step |
| R6 | 8-pen × 1M pts rendering exceeds GPU memory on low-end devices | 3 | Medium | High | LOD ensures bounded geometry; deferred rendering for off-screen pens; memory monitoring with fallback |
| R7 | 10 kHz streaming causes GC pauses | 3 | Medium | High | Pre-allocated ring buffers; avoid object allocation in hot path; object pooling |
| R8 | DataZoom minimap doubles rendering cost | 4 | Low | Medium | Minimap uses lowest LOD level (pre-computed); renders at reduced resolution |
| R9 | Bundle size exceeds 80 KB gzip target | All | Medium | Medium | Per-PR size tracking in CI; lazy-load non-critical code paths |
| R10 | Scope creep beyond line charts | All | High | High | **Strict enforcement:** every PR must answer "does this serve the line chart?" If no → v1.1+ backlog |

### Post-V1 Risks (tracked but not actively mitigated)

| ID | Risk | Version |
|---|---|---|
| R11 | Spectrogram WebGPU shader hits per-platform compute limits | v1.2 |
| R12 | SPC rule detection false positives in noisy data | v1.2 |
| R13 | Compare-to-past time alignment fails across DST boundaries | v1.1 |
| R14 | Arrow IPC decode adds unexpected bundle weight | v1.1 |
| R15 | Brush persistence state becomes stale after data update | v1.1 |

---

## 9. Decision Log

| # | Decision | Date | Rationale | Status |
|---|---|---|---|---|
| D1 | **V1 = performant line charts only.** No spectrogram, SPC, scatter, correlation, dashboard features, or MATLAB-grade interactions. | 2026-04-05 | Ship one thing and make it the best. All other chart types are v1.1+. Avoid scope creep. Ship in 24 weeks, not 48. | **Approved** |
| D2 | Ship headless primitives, not monolithic chart options DSL | 2026-04-05 | shadcn ecosystem expects composition, not configuration | Approved |
| D3 | CSS-variable theming over JS theme objects | 2026-04-05 | Direct shadcn/Tailwind integration; no runtime theme overhead | Approved |
| D4 | shadcn registry distribution as first-class channel | 2026-04-05 | Adoption vector; `npx shadcn add` is frictionless | Approved |
| D5 | WebGPU primary, Canvas2D fallback, no WebGL2 middle ground | 2026-04-05 | WebGPU coverage sufficient; Canvas2D adequate for ≤200K pts; WebGL2 only if profiling proves Canvas2D insufficient | Pending spike |
| D6 | Dual runtime profiles: Device/HMI + Historian/Cloud | 2026-04-05 | PITANT hardware targets both; different memory/latency budgets | Approved |
| D7 | Reframe product promise from "MATLAB for browser" to "fastest line chart in the browser" | 2026-04-05 | Razor-sharp positioning for v1; broader product vision in post-v1 | Approved |
| D8 | Separate React bindings package `@pitant/charts-react` | TBD | Tree-shaking; framework-agnostic core; smaller install for vanilla users | Open |
| D9 | Arrow IPC decode: opt-in entrypoint, not built-in | TBD | Avoids ~40 KB for users who don't need it; deferred to v1.1 | Open |
| D10 | V1 legend: show/hide + color swatch + series name. No search, no sparkline, no outlier mode. | 2026-04-05 | Keep legend simple for v1. Advanced legend features in v1.1 when more chart types need them. | Approved |
| D11 | V1 tooltip: hover-only, no persistent pins. Snap-to-nearest, multi-pen values at cursor. | 2026-04-05 | Persistent data tips are MATLAB-grade analysis (v1.1). V1 tooltip is clean and fast. | Approved |
| D12 | V1 exports PNG + SVG only. PDF deferred to v1.1. | 2026-04-05 | PDF requires vector layout engine — unnecessary complexity for v1. | Approved |

---

## 10. Post-V1 Roadmap

### v1.1 — Analysis Interactions & Overlays (~8 weeks, ~140 SP)

**Goal:** Upgrade from "fast line chart" to "MATLAB-grade analysis workbench." Add persistent data tips, ruler/measurement, brush persistence, restore-view stack, compare-to-past, and overlay chart types.

| Epic ID | Name | Priority | Est. SP |
|---|---|---|---|
| E6.1 | Persistent Data Tips (Multiple Pins) | P1 | 13 |
| E6.2 | Ruler / Measurement Cursors | P1 | 13 |
| E6.3 | Brush & Selection Persistence | P1 | 13 |
| E6.4 | Restore View Stack (Undo/Redo Zoom) | P1 | 8 |
| E6.5 | Compare-to-Past Overlay | P1 | 13 |
| E6.6 | Reference Time Pin | P1 | 8 |
| E6.7 | ChartTable (Table Twin) | P1 | 13 |
| E6.8 | Outlier Mode (Top-N) | P1 | 8 |
| E6.9 | AlarmBand Overlays | P1 | 8 |
| E6.10 | AnomalyScoreTrack | P1 | 8 |
| E6.11 | EnvelopeBand | P1 | 8 |
| E6.12 | Annotation System with Lane Management | P1 | 13 |
| E6.13 | Advanced Legend (Search, Sort, Sparkline, Outlier) | P1 | 5 |
| E6.14 | ChartBrushBar + ChartSeriesToggle + ChartTimeRangePicker | P1 | 8 |
| E6.15 | Derived Series Engine + Resample/Align/Gap Fill | P1 | 13 |

### v1.2 — Spectral, Statistics & SPC (~12 weeks, ~170 SP)

**Goal:** Expand from line charts to full industrial visualization. Spectral analysis, statistical charts, SPC control charts, process KPIs.

| Epic ID | Name | Priority | Est. SP |
|---|---|---|---|
| E7.1 | Colormap Engine | P1 | 13 |
| E7.2 | Spectrogram | P1 | 21 |
| E7.3 | PowerSpectrum | P1 | 8 |
| E7.4 | BodePlot (Dual-Panel) | P2 | 13 |
| E7.5 | WaterfallPlot | P2 | 13 |
| E7.6 | Histogram + KDE | P1 | 8 |
| E7.7 | BoxWhisker + ViolinPlot | P1 | 13 |
| E7.8 | QQPlot + ProbabilityPlot | P2 | 8 |
| E7.9 | ControlChart (X̄-R, CUSUM, EWMA) | P1 | 21 |
| E7.10 | RunChart + CapabilityHistogram + BatchProfile | P1 | 13 |
| E7.11 | Process KPIs (Gauge, Bullet, Sparkline, WaterfallBar) | P1 | 13 |
| E7.12 | NyquistPlot + OrderTrack + EnvelopeSpectrum | P2 | 24 |

### v1.3 — Correlation & Anomaly Detection (~8 weeks, ~120 SP)

**Goal:** S2G++ pipeline frontend. Multivariate correlation, anomaly detection visualizations, incident management charts.

| Epic ID | Name | Priority | Est. SP |
|---|---|---|---|
| E8.1 | ScatterPlot + Density Underlay | P1 | 13 |
| E8.2 | CorrelationMatrix + Dendrogram | P1 | 13 |
| E8.3 | CrossCorrelation + RegressionPlot | P1 | 13 |
| E8.4 | ParallelCoordinates + PCABiplot + PhaseSpace | P1 | 21 |
| E8.5 | AnomalyTimeline + FusionScorePlot | P1 | 13 |
| E8.6 | RootCauseBar + DetectorHeatmap + ThresholdCalibration + IncidentCard | P1 | 21 |
| E8.7 | Event Overlays & Enhanced Annotations | P1 | 8 |
| E8.8 | PDF Export Engine | P1 | 8 |
| E8.9 | PRhistorian Full Integration & Migration | P0 | 21 |

---

## 11. Document Index

| Document | Path | Scope | Contents |
|---|---|---|---|
| **Master Plan** | `plan/00-master-plan.md` | V1 + Post-V1 | This document — phases, epics, KPIs, risks, roadmap |
| **Phase 1** | `plan/01-foundation-rendering.md` | V1 | Rendering engine, data engine, build infra |
| **Phase 2** | `plan/02-headless-primitives.md` | V1 | shadcn-native UI primitives, theming, a11y, React bindings |
| **Phase 3** | `plan/03-timeseries-data-pipeline.md` | V1 | TimeSeries + DigitalChannel line charts, streaming, multi-resolution |
| **Phase 4** | `plan/04-interactions-navigation.md` | V1 | Zoom, pan, crosshair, DataZoom, cursor sync |
| **Phase 5** | `plan/05-registry-launch.md` | V1 | shadcn registry, docs, export, npm publish, cross-browser CI |
| **Post-V1** | `plan/06-post-v1-roadmap.md` | v1.1–v1.3 | Analysis interactions, spectral, SPC, correlation, anomaly |
