# Project Definition: @pitant/charts

**Status:** Draft  
**Date:** 2026-04-05  
**Author:** Ali  
**Type:** New npm library (open-source, MPL-2.0)<br>
**Replaces:** Apache ECharts 6 + echarts-for-react + Plotly.js + SciChart  
**Dependency on replaced libs:** None — this is a ground-up implementation with zero runtime dependency on ECharts, SciChart, Plotly, or any third-party charting library.  

---

## 1. Problem Statement

ECharts fails PRhistorian on two axes:

### Performance

| Scenario | ECharts actual | Target |
|---|---|---|
| Pan/zoom 1M points, 8 pens | 8–12 fps | ≥ 30 fps |
| Pan/zoom 100K points | 20–28 fps | ≥ 60 fps |
| Initial render 1M points | 1.2–1.8 s | < 500 ms |
| Progressive load 5M+ points | >5 s, UI freeze | < 2 s, non-blocking |
| Memory for 1M pts chart | ~180 MB | ≤ 80 MB |

Root causes: ECharts renders every point to Canvas2D, rebuilds the entire option tree on mutation, does not use GPU acceleration, and its data decimation is lossy (LTTB only, no min-max preservation).

### Feature Gaps (vs MATLAB / scientific charting)

ECharts is a general-purpose dashboarding library. It lacks the scientific and industrial visualization primitives that process engineers expect from MATLAB, LabVIEW, or PI ProcessBook:

- No spectrogram / waterfall (Pack H — FFT, PSD)
- No contour plot or 2D density (Pack I — correlation fields)
- No control chart with Western Electric / Nelson rule zones (Pack J — SPC)
- No polar / Nyquist / Bode plots (Pack H — frequency response)
- No box-and-whisker with jitter (Pack C — distribution)
- No heatmap with dendrogram clustering axis (Pack I — correlation matrix)
- No envelope / confidence band with configurable fill (Pack L — forecast)
- No alarm band overlays with severity stacking (Pack F — sensor health)
- No annotation system with lane management (our custom echarts-tag-graphics.ts)
- No anomaly score track (our custom echarts-score-track.ts)
- No phase-space plot / attractor visualization (S2G++ pipeline)
- No parallel coordinates for multivariate anomaly exploration
- No stem plot / impulse plot for discrete event sequences
- No staircase / digital-channel rendering with proper area fill
- No ruler / crosshair with engineering-unit readout per pen
- No synchronized multi-chart cursors (time-aligned tooltip across panels)

---

## 2. Vision

**@pitant/charts** is a WebGPU-first, TypeScript-native scientific charting library built for industrial time-series at scale. It renders millions of points at 60 fps, provides every chart type a process/controls engineer needs, and ships zero dependencies beyond the browser.

**One sentence:** The MATLAB plotting toolkit for the browser, built for industrial historians and anomaly detection.

---

## 3. Scope & Non-Goals

### In Scope

- All chart types listed in §5
- WebGPU primary renderer with Canvas2D fallback
- React 19 bindings as `@pitant/charts-react`
- TypeScript 6 strict, zero `any`
- Tree-shakeable ESM — only import what you use
- Responsive & accessible (keyboard nav, ARIA, high-contrast)
- Export to PNG, SVG, PDF (vector)
- Declarative API (props/options) and imperative API (for programmatic animation)
- Streaming append (live data push without full re-render)
- Synchronized cursor / tooltip across multiple chart instances
- Theming system compatible with PITANT design tokens

### Non-Goals

- General-purpose dashboard charts (pie, donut, funnel, treemap, Sankey)
- Geographic map rendering (use Mapbox/Leaflet)
- 3D scene rendering (use Three.js)
- Server-side rendering of chart images
- Data fetching or state management (bring your own data)
- Drag-and-drop dashboard builder

---

## 4. Architecture

### 4.1 Rendering Pipeline

```
Data (Float64Array / Arrow IPC)
    │
    ▼
┌─────────────────────┐
│  Data Engine         │  Level-of-detail pyramid, min-max tree,
│  (Web Worker)        │  decimation, streaming append buffer
└──────────┬──────────┘
           │ transferable ArrayBuffer
           ▼
┌─────────────────────┐
│  Layout Engine       │  Axis computation, grid allocation,
│  (Main thread)       │  annotation positioning, legend layout
└──────────┬──────────┘
           │ draw commands
           ▼
┌─────────────────────┐
│  Render Backend      │  WebGPU (primary) → Canvas2D (fallback)
│                      │  GPU instanced lines, fill, text atlas
└──────────┬──────────┘
           │
           ▼
       <canvas>
```

### 4.2 Data Engine (Web Worker)

The data engine runs off the main thread. It:

1. **Ingests** raw data as `Float64Array` columns or Apache Arrow IPC buffers
2. **Builds a min-max LOD pyramid** — at each zoom level, the engine knows the min and max of every pixel-width bucket. This means the chart never renders more points than there are pixels, but always preserves visual peaks/valleys (no lossy LTTB)
3. **Streams appends** — for live data, new samples insert into the pyramid incrementally without rebuilding
4. **Transfers** the visible bucket array to the main thread via `postMessage` with `Transferable` (zero-copy)

### 4.3 Render Backend

**WebGPU path (primary):**
- Instanced line rendering — one draw call per series, GPU computes line joins/caps
- Fill regions (area, confidence bands, alarm zones) via triangle-strip instancing
- Text rendering via SDF (signed distance field) glyph atlas — sharp at all zoom levels
- Anti-aliased lines without MSAA overhead via analytical coverage shading

**Canvas2D path (fallback):**
- Activated when `navigator.gpu` is unavailable
- Uses `Path2D` batching and `OffscreenCanvas` in worker where supported
- Acceptable for ≤ 200K points; shows performance warning above that

### 4.4 Package Structure

```
@pitant/charts          Core library (renderer, data engine, all chart types)
@pitant/charts-react    React 19 bindings (<Chart />, hooks, context)
```

Mono-package with subpath exports:

```ts
import { TimeSeriesChart } from "@pitant/charts"           // core
import { Spectrogram } from "@pitant/charts/spectral"       // tree-shake
import { Chart, useChartSync } from "@pitant/charts-react"  // react
```

---

## 5. Chart Type Catalogue

### 5.1 Time-Domain (Packs A–F, L)

| Chart | Description | Use Case |
|---|---|---|
| **TimeSeries** | Multi-pen line chart with independent Y-axes, step/linear/spline interpolation, alarm bands, gap indicators | Core historian trend view |
| **DigitalChannel** | Staircase (step-end) with semi-transparent area fill, state labels on transitions | Binary/discrete signals (Pack E) |
| **AnomalyScoreTrack** | Compact horizontal bar strip, severity-colored, time-aligned below a TimeSeries | Anomaly overlay (Pack L) |
| **EnvelopeBand** | Line + upper/lower confidence fill with configurable opacity | Forecast bands, adaptive limits (Pack L) |
| **AlarmBand** | Horizontal zone overlays with severity color coding (LoLo/Lo/Hi/HiHi) | Threshold visualization (Pack F) |
| **StepArea** | Stacked step-area for state occupancy over time | State timeline (Pack E) |
| **StemPlot** | Vertical impulse lines from baseline, optionally with markers | Discrete events, transitions, spikes |
| **RangePlot** | Vertical bars showing min–max range per interval | Data quality / spread (Pack F) |

### 5.2 Frequency & Vibration (Pack H)

| Chart | Description | Use Case |
|---|---|---|
| **Spectrogram** | Time × Frequency heatmap with colormap (viridis, turbo, grayscale) | Vibration analysis, motor diagnostics |
| **PowerSpectrum** | Log-log or lin-log magnitude plot of PSD | FFT / PSD output |
| **BodePlot** | Dual-panel: magnitude (dB) + phase (degrees) vs frequency | Frequency response, filter design |
| **NyquistPlot** | Polar plot of real vs imaginary frequency response | Stability analysis |
| **WaterfallPlot** | 3D-projected stacked spectra over time (pseudo-3D) | Evolving vibration signatures |
| **OrderTrack** | Frequency vs RPM colored by amplitude | Rotating machinery order analysis |
| **EnvelopeSpectrum** | Demodulated high-frequency envelope in frequency domain | Bearing fault detection |

### 5.3 Statistical & Distribution (Pack C)

| Chart | Description | Use Case |
|---|---|---|
| **Histogram** | Binned frequency distribution with optional KDE overlay | Value distribution |
| **BoxWhisker** | Box plot with median, quartiles, whiskers, jitter, outlier markers | Multi-group comparison |
| **QQPlot** | Quantile–quantile plot against theoretical distribution | Normality testing |
| **ViolinPlot** | Mirrored KDE density shape + inner box plot | Distribution shape comparison |
| **ProbabilityPlot** | Cumulative probability on Weibull/normal/log-normal paper | Reliability, failure analysis |

### 5.4 SPC & Manufacturing (Pack J)

| Chart | Description | Use Case |
|---|---|---|
| **ControlChart** | X̄-R, X̄-S, CUSUM, EWMA with UCL/LCL/CL, Western Electric zones, Nelson rule violation markers | Statistical process control |
| **RunChart** | Sequential plot with median line and run-length markers | Process stability check |
| **CapabilityHistogram** | Histogram with Cp/Cpk/Pp/Ppk overlays, spec limits, normal curve fit | Process capability study |
| **BatchProfile** | Multi-batch overlay with golden-batch envelope and deviation shading | Batch-to-batch comparison |

### 5.5 Correlation & Modeling (Pack I)

| Chart | Description | Use Case |
|---|---|---|
| **ScatterPlot** | X-Y scatter with optional density heatmap underlay, regression line, residual ticks | Correlation analysis |
| **CorrelationMatrix** | Heatmap grid of pairwise Pearson/Spearman coefficients with optional dendrogram | Multi-tag correlation |
| **CrossCorrelation** | Lag-based bar chart of cross-correlation coefficients | Time-lag identification |
| **RegressionPlot** | Scatter + fitted curve (linear/polynomial/piecewise) + confidence interval + residual subplot | Model fitting |
| **ParallelCoordinates** | Multi-axis parallel lines, brushable, colored by anomaly score or class | Multivariate exploration |
| **PCABiplot** | 2D projection of PCA scores with variable loading vectors | Dimensionality reduction |
| **PhaseSpace** | 2D/3D attractor plot from delay-embedding or PCA projection | S2G++ pipeline visualization |

### 5.6 Anomaly Detection (Pack L, pitant-anomaly)

| Chart | Description | Use Case |
|---|---|---|
| **AnomalyTimeline** | Multi-layer horizontal lane chart showing detector activations per layer (L1–L10) | Pipeline transparency |
| **FusionScorePlot** | Composite anomaly score line + individual detector score lines (translucent) | Score fusion visualization |
| **RootCauseBar** | Horizontal bar chart of per-channel contribution scores | Root cause attribution |
| **IncidentCard** | Compact region highlight on a TimeSeries with severity badge, detector tags, expandable detail | Incident marking |
| **DetectorHeatmap** | Detectors × Time heatmap showing activation intensity | Detector agreement / disagreement |
| **ThresholdCalibration** | Score distribution histogram + adjustable threshold slider with precision/recall preview | Threshold tuning |

### 5.7 Process KPIs (Pack K)

| Chart | Description | Use Case |
|---|---|---|
| **GaugeArc** | Circular / semi-circular gauge with zones (green/amber/red) | OEE, efficiency, tank level |
| **BulletChart** | Horizontal bar with target marker and qualitative ranges | KPI vs target |
| **Sparkline** | Minimal inline line chart, no axes, fits inside a table cell or card | Dashboard KPI cards |
| **WaterfallBar** | Stacked incremental bar showing contributions (production − losses = OEE) | Loss waterfall |

### 5.8 Shared Overlays & Interactions

| Feature | Description |
|---|---|
| **Crosshair** | Vertical + horizontal hair with engineering-unit readout per pen |
| **SyncCursor** | Cursor position broadcasts to all charts in a sync group via shared context |
| **Brush** | Box-select for zoom, range-select for evaluation, lasso for point selection |
| **Annotations** | Point markers (flag + label) and range markers (shaded region + label) with lane management |
| **DataZoom** | Slider + minimap overview strip below chart with visible-range indicator |
| **Tooltip** | Multi-pen tooltip with value, unit, quality badge, delta from previous |
| **RulerMode** | Click two points to measure Δt, Δy, slope between them |

---

## 6. API Design

### 6.1 Core API (Vanilla TypeScript)

```ts
import { TimeSeriesChart, type TimeSeriesOptions } from "@pitant/charts"

const chart = new TimeSeriesChart(container, {
  series: [
    {
      name: "TI-4201",
      data: float64Array,          // or { timestamps: BigInt64Array, values: Float64Array }
      timestamps: int64Array,
      unit: "°C",
      color: "#1976D2",
      interpolation: "linear",     // "step" | "linear" | "spline"
      yAxisIndex: 0,
    },
  ],
  xAxis: { type: "time", timezone: "Europe/Berlin" },
  yAxes: [
    { label: "Temperature", unit: "°C", min: 0, max: 400 },
  ],
  alarmBands: [
    { yMin: 350, yMax: 400, color: "#F44336", opacity: 0.1, label: "HiHi" },
  ],
  annotations: [],
  interaction: {
    zoom: true,
    pan: true,
    brush: "box",
    crosshair: true,
    tooltip: true,
  },
  renderer: "auto",  // "webgpu" | "canvas2d" | "auto"
})

// Streaming append (live data)
chart.appendData(0, { timestamps: newTimestamps, values: newValues })

// Programmatic zoom
chart.setVisibleRange(startMs, endMs)

// Export
const png = await chart.exportImage("png", { width: 1920, height: 1080, dpi: 2 })

// Cleanup
chart.dispose()
```

### 6.2 React API

```tsx
import { Chart, useChartSync } from "@pitant/charts-react"
import { type TimeSeriesOptions } from "@pitant/charts"

function TrendPanel({ pens }: { pens: PenData[] }) {
  const sync = useChartSync("trend-group")

  return (
    <div>
      <Chart
        type="timeseries"
        options={options}
        syncGroup={sync}
        onBrush={(range) => evaluateRange(range)}
        className="h-[400px]"
      />
      <Chart
        type="anomaly-score-track"
        options={scoreOptions}
        syncGroup={sync}
        className="h-[50px]"
      />
    </div>
  )
}
```

### 6.3 Data Input Formats

```ts
// Column-oriented (preferred — zero-copy to GPU)
interface ColumnData {
  timestamps: BigInt64Array    // nanoseconds since epoch
  values: Float64Array
  quality?: Uint8Array         // 0=bad, 1=uncertain, 2=good
}

// Arrow IPC buffer (direct from Rust via Tauri IPC)
interface ArrowData {
  ipcBuffer: ArrayBuffer       // Arrow IPC record batch
  timestampColumn: string
  valueColumn: string
}

// Tuple array (convenience, internally converted)
type TupleData = [number, number | null][]   // [ms, value]

// Matrix (for spectrograms, heatmaps, correlation matrices)
interface MatrixData {
  values: Float64Array         // row-major
  rows: number
  cols: number
  rowLabels?: string[]
  colLabels?: string[]
  rowAxis?: Float64Array       // e.g., frequency bins
  colAxis?: Float64Array       // e.g., time steps
}
```

---

## 7. Performance Targets

| Scenario | Target | Measurement |
|---|---|---|
| Pan/zoom, 1M visible points | ≥ 30 fps | `requestAnimationFrame` delta |
| Pan/zoom, 100K visible points | ≥ 60 fps | `requestAnimationFrame` delta |
| Initial render, 1M data points | < 500 ms | First Contentful Paint |
| Progressive load, 5M+ points | < 2 s | Time to Interactive |
| Streaming append, 100 pts/frame | < 1 ms overhead | Performance.mark delta |
| Memory, 1M pts single chart | ≤ 80 MB | `performance.measureUserAgentSpecificMemory()` |
| Memory, 8-pen chart 1M pts each | ≤ 200 MB | Same |
| Export PNG 1920×1080 | < 200 ms | — |
| Bundle size (core, tree-shaken) | ≤ 120 KB gzip | `bun build --minify` |
| Bundle size (all chart types) | ≤ 300 KB gzip | Same |
| Worker initialization | < 100 ms | — |

### LOD Strategy

The min-max LOD pyramid guarantees that at any zoom level, the chart renders at most `2 × canvasWidth` points per series. For a 1920px canvas, that is ~3840 points regardless of dataset size. This is what makes 1M+ point rendering feasible at 60 fps.

```
Level 0:  raw data         (N points)
Level 1:  2-bucket min/max (N/2 pairs)
Level 2:  4-bucket min/max (N/4 pairs)
  ...
Level k:  2^k-bucket       (N/2^k pairs)
```

Pan/zoom selects the appropriate level and reads only the visible range. The pyramid is built once in the Web Worker on data load (O(N) time, O(N) space) and updated incrementally on append.

---

## 8. Accessibility

| Requirement | Implementation |
|---|---|
| Keyboard navigation | Tab to chart → arrow keys to pan, +/- to zoom, Enter to select |
| Screen reader | ARIA `role="img"` with `aria-label` describing chart type, series, and visible range |
| Data table fallback | Every chart exposes a `.getDataTable()` returning the visible data as an HTML `<table>` for AT |
| High contrast | All color scales tested against WCAG 2.1 AA (4.5:1 text, 3:1 non-text). Theme includes `highContrast` mode |
| Motion reduced | `prefers-reduced-motion` disables animated transitions |
| Focus indicators | 2px solid ring with 2px offset, visible in all themes |

---

## 9. Theming

```ts
import { createTheme } from "@pitant/charts"

const pitantDark = createTheme({
  background: "#0F1419",
  gridLine: "#1E2A35",
  axisText: "#8899A6",
  axisLine: "#2C3E50",
  crosshair: "#FFFFFF",
  tooltip: { background: "#1B2836", border: "#2C3E50", text: "#E1E8ED" },
  series: ["#1976D2", "#4CAF50", "#FF9800", "#E91E63", "#9C27B0", "#00BCD4", "#FF5722", "#607D8B"],
  severity: { critical: "#F44336", high: "#FF9800", medium: "#FFC107", low: "#4CAF50" },
  alarmZones: { hihi: "#F4433620", hi: "#FF980015", lo: "#2196F315", lolo: "#2196F320" },
  font: { family: "Inter, system-ui, sans-serif", size: 11 },
})
```

Themes apply globally via `ChartProvider` (React) or `setDefaultTheme()` (vanilla).

---

## 10. Comparison with Alternatives

| Feature | @pitant/charts | ECharts 6 | SciChart | uPlot | Plotly.js | LightningChart |
|---|---|---|---|---|---|---|
| WebGPU rendering | Yes | No | WebGL2 | No | No | Yes (proprietary) |
| 1M pts at 30 fps | Yes | No | Yes | Yes (limited) | No | Yes |
| Spectrogram | Yes | No | Yes | No | Yes | Yes |
| Control charts (SPC) | Yes | No | No | No | No | No |
| Anomaly overlays | Yes | No | No | No | No | No |
| Parallel coordinates | Yes | Yes | No | No | Yes | No |
| Phase-space plot | Yes | No | No | No | No | No |
| Arrow IPC input | Yes | No | No | No | No | No |
| Bundle size (gzip) | ~120 KB | ~300 KB | ~400 KB | ~35 KB | ~1 MB | ~500 KB |
| License | MPL-2.0 | Apache 2.0 | Commercial | MIT | MIT | Commercial |
| React 19 bindings | Yes | Community | Community | Community | Official | Official |
| Sync cursors | Native | Manual | Native | Plugin | No | No |
| Streaming append | O(1) | O(N) rebuild | O(1) | O(1) | O(N) | O(1) |
| TypeScript strict | Yes | Partial | Yes | Partial | Partial | Yes |
| shadcn-native / CSS var theming | Yes | No | No | No | No | No |
| Headless composable primitives | Yes | No | No | No | No | No |
| Open source | Yes (MPL-2.0) | Yes | No | Yes | Yes | No |

---

## 11. Milestone Plan

### M0 — Foundation (Weeks 1–4)

- Mono-repo setup (`@pitant/charts`, `@pitant/charts-react`)
- WebGPU line renderer (instanced, anti-aliased)
- Canvas2D fallback renderer
- Data engine with min-max LOD pyramid in Web Worker
- Axis computation (linear, log, time)
- `TimeSeriesChart` with single pen, pan/zoom, crosshair
- Benchmark harness: FPS counter, memory tracker, automated regression

### M1 — Core Time-Series (Weeks 5–8)

- Multi-pen with independent Y-axes
- Step interpolation (digital channels)
- Alarm band overlays
- Annotation system with lane management
- DataZoom (slider + minimap)
- Tooltip with multi-pen readout
- Brush (box-select zoom, range-select evaluation)
- Streaming append API
- `AnomalyScoreTrack` chart
- Sync cursor across chart group
- Theme system + PITANT dark/light themes

### M2 — Spectral & Frequency (Weeks 9–12)

- `Spectrogram` (WebGPU heatmap shader, colormaps)
- `PowerSpectrum` (log-log, lin-log)
- `BodePlot` (dual-panel)
- `WaterfallPlot` (pseudo-3D stacked)
- `EnvelopeSpectrum`
- `NyquistPlot` (polar)
- `OrderTrack`
- Colormap engine (viridis, turbo, plasma, grayscale, custom)

### M3 — Statistics & SPC (Weeks 13–16)

- `Histogram` with KDE overlay
- `BoxWhisker` with jitter and outlier markers
- `QQPlot`, `ViolinPlot`, `ProbabilityPlot`
- `ControlChart` (X̄-R, X̄-S, CUSUM, EWMA) with zone overlays + rule violation markers
- `RunChart`, `CapabilityHistogram`, `BatchProfile`
- `BulletChart`, `GaugeArc`, `WaterfallBar`
- `Sparkline`

### M4 — Correlation & Anomaly (Weeks 17–20)

- `ScatterPlot` with density underlay
- `CorrelationMatrix` with dendrogram
- `CrossCorrelation` bar chart
- `RegressionPlot` with residual subplot
- `ParallelCoordinates` (brushable)
- `PCABiplot`
- `PhaseSpace` (2D attractor)
- `AnomalyTimeline` (multi-layer lane chart)
- `FusionScorePlot`
- `RootCauseBar`
- `DetectorHeatmap`
- `ThresholdCalibration`

### M5 — Polish & Production (Weeks 21–24)

- Export engine (PNG, SVG, PDF vector)
- Accessibility audit and remediation
- Performance regression CI (Chromium + WebGPU headless)
- Documentation site (TypeDoc + interactive examples)
- `@pitant/charts-react` final API stabilization
- Integration smoke tests with PRhistorian viewer
- npm publish pipeline

---

## 12. Testing Strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | Data engine (LOD pyramid, decimation, streaming), axis math, layout |
| Visual regression | Playwright + `toMatchSnapshot()` | Every chart type rendered at fixed size, compared pixel-by-pixel |
| Performance | Playwright + `requestAnimationFrame` timing | FPS at 100K, 500K, 1M, 5M points; memory; initial render time |
| Accessibility | axe-core + Playwright | WCAG 2.1 AA compliance for all chart types |
| Integration | PRhistorian viewer e2e | Drop-in replace ECharts in trend workbench, verify feature parity |
| Cross-browser | Playwright matrix | Chrome (WebGPU), Firefox (Canvas2D fallback), Safari (Canvas2D fallback) |

---

## 13. Dependencies

### Runtime (zero external dependencies)

The library ships no npm dependencies. All rendering code is self-contained.

- WebGPU API (browser-native, Chrome 113+, Firefox 123+, Safari 18.2+)
- Canvas2D API (fallback, universal)
- Web Workers (universal)
- `Float64Array`, `BigInt64Array` (universal)
- `OffscreenCanvas` (Chrome 69+, Firefox 105+, Safari 16.4+)

### Dev Dependencies

- TypeScript 6
- Vitest
- Playwright
- Biome 2
- @aspect/bazel or tsup for bundling

---

## 14. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| WebGPU not available on target machine | Medium | High | Canvas2D fallback renderer with graceful degradation and performance warning |
| SDF text rendering quality on low-DPI | Low | Medium | Pre-rasterized glyph atlas for low-DPI, SDF for high-DPI |
| Web Worker overhead for small datasets (<10K pts) | Low | Low | Skip worker for small datasets, render directly on main thread |
| Spectrogram shader complexity | Medium | Medium | Start with Canvas2D `ImageData` path, add WebGPU shader in M2 |
| Scope creep into dashboard territory | Medium | High | Strict non-goal enforcement — no pie, donut, funnel, treemap, Sankey |
| Arrow IPC parsing in browser | Low | Medium | Use existing `apache-arrow` JS package only for IPC decode, no full dependency |

---

## 15. Success Criteria

The library is considered production-ready when:

1. **All 40+ chart types** from §5 render correctly at PITANT design-token theme
2. **Performance targets** from §7 pass on an M1 MacBook Air at Chrome 130+
3. **Zero external runtime dependencies** — bundle is self-contained
4. **PRhistorian integration** — all echarts-*.ts files in prcloud-viewer replaced with @pitant/charts equivalents, no regressions in existing trend, alarm, annotation, and anomaly-score functionality
5. **Accessibility** — axe-core zero violations for every chart type
6. **Visual regression** — Playwright screenshot tests pass with < 0.1% pixel diff
7. **Documentation** — every chart type has a live interactive example with code snippet

---

## 16. Open Questions

| # | Question | Decision Needed By |
|---|---|---|
| 1 | Should we support SVG renderer alongside WebGPU and Canvas2D? SVG enables CSS styling but cannot handle >50K points | M0 kickoff |
| 2 | Should the Arrow IPC decode be built-in or require the user to pass decoded Float64Arrays? Built-in adds ~40 KB | M1 |
| 3 | Should `@pitant/charts-react` be a separate npm package or a subpath export of `@pitant/charts`? | M0 kickoff |
| 4 | Should we support Vue/Svelte bindings from day one, or React-only for launch? | M0 kickoff |
| 5 | Should the colormap engine support user-defined GLSL-like gradient functions, or only predefined palettes? | M2 |
| 6 | Do we need WebGL2 as a middle-ground fallback between WebGPU and Canvas2D? | M0 spike |
