# Post-V1 Roadmap — v1.1 / v1.2 / v1.3

**Scope:** Everything beyond the V1 performant line chart release. Organized in three incremental releases, each building on the previous.  
**Status:** Planning only. No implementation until V1 ships and gets field feedback.

---

## Release Summary

| Version | Codename | Theme | Est. Duration | Est. SP | Key Additions |
|---|---|---|---|---|---|
| **v1.1** | Analyst Workbench | Analysis interactions & overlays | ~8 weeks | ~140 SP | Persistent data tips, ruler/measurement, brush persistence, compare-to-past, annotations, derived series, advanced legend, overlay chart types (AlarmBand, EnvelopeBand, AnomalyScoreTrack) |
| **v1.2** | Industrial Viz | Spectral, statistics & SPC | ~12 weeks | ~170 SP | Spectrogram, power spectrum, Bode plot, histograms, box plots, control charts (X̄-R, CUSUM, EWMA), process KPIs, colormap engine |
| **v1.3** | Correlation & Anomaly | S2G++ pipeline frontend | ~8 weeks | ~120 SP | Scatter, correlation matrix, parallel coordinates, anomaly timeline, root cause visualizations, PDF export, PRhistorian full integration |

**Total post-v1:** ~28 weeks, ~430 SP, ~39 epics

---

## v1.1 — Analyst Workbench (~8 weeks, ~140 SP)

**Goal:** Upgrade from "fast line chart" to "MATLAB-grade analysis workbench." Add persistent interaction state, comparison overlays, analysis tools, and the remaining chart-adjacent features that make line charts a complete investigation platform.

**Dependency:** V1 shipped. User feedback collected for at least 2 weeks.

### Epics

| ID | Epic | Priority | Est. SP | Description |
|---|---|---|---|---|
| E6.1 | Persistent Data Tips (Multiple Pins) | P1 | 13 | Pin multiple tooltip markers on the chart that persist across pan/zoom. Each pin shows timestamp + values for all visible series. Draggable, removable. Stored in chart state for session persistence. |
| E6.2 | Ruler / Measurement Cursors | P1 | 13 | Two vertical cursor lines with a measurement readout between them: Δt, Δy, slope, frequency. Draggable. Snap to data. Shows min/max/mean/RMS between cursors. |
| E6.3 | Brush & Selection Persistence | P1 | 13 | Click-drag to highlight a time region. Region persists across zoom/pan. Multiple regions allowed. Export selected region data. Visual: semi-transparent colored bands. |
| E6.4 | Restore View Stack (Undo/Redo Zoom) | P1 | 8 | Maintain a stack of previous zoom/pan states. Ctrl+Z undoes last zoom. Ctrl+Shift+Z redoes. Toolbar buttons for back/forward. Configurable stack depth (default: 20). |
| E6.5 | Compare-to-Past Overlay | P1 | 13 | Overlay a historical time range on the current view. Shifted to align timestamps. Visual: dashed lines with reduced opacity. Time alignment handles DST boundaries. |
| E6.6 | Reference Time Pin | P1 | 8 | Pin a vertical reference line at a specific timestamp. Labeled. Multiple pins allowed. Coordinate with annotations. Useful for marking events (alarm triggered, batch started). |
| E6.7 | ChartTable (Table Twin) | P1 | 13 | Headless `<ChartTable>` primitive that displays the same data as the chart in tabular form. Bidirectional sync: select row → crosshair moves; hover chart → row highlights. Virtualized for large datasets. |
| E6.8 | Outlier Mode (Top-N) | P1 | 8 | Toggle mode that highlights the N most extreme values in the visible range. Configurable: top-N highest, lowest, or deviation from mean. Useful for anomaly investigation. |
| E6.9 | AlarmBand Overlays | P1 | 8 | Horizontal threshold bands (high/low/critical). Visual: filled rectangles with label. Configurable per Y-axis. Alarm state detection: "X% of visible data exceeds threshold." |
| E6.10 | AnomalyScoreTrack | P1 | 8 | Secondary track below main chart showing anomaly scores over time. Color-coded by severity. Synced with main chart zoom/pan. Click to jump to anomaly timestamp. |
| E6.11 | EnvelopeBand | P1 | 8 | Filled area between upper and lower bounds. Useful for min/max envelopes, confidence intervals, tolerance bands. Semi-transparent fill. Configurable per series. |
| E6.12 | Annotation System with Lane Management | P1 | 13 | Place text/icon annotations at specific timestamps or regions. Annotations live in a lane below the chart. Lane auto-stacking to prevent overlap. Clickable, editable, removable. |
| E6.13 | Advanced Legend (Search, Sort, Sparkline, Outlier) | P1 | 5 | Extend V1 legend: search/filter series by name, sort by value/name, inline sparkline preview, outlier indicator. Toggleable between compact and expanded mode. |
| E6.14 | ChartBrushBar + ChartSeriesToggle + ChartTimeRangePicker | P1 | 8 | Three new primitives: BrushBar (shows active brush regions as chips), SeriesToggle (chip-based series visibility), TimeRangePicker (preset quick-ranges: 1h, 6h, 24h, custom). |
| E6.15 | Derived Series Engine + Resample/Align/Gap Fill | P1 | 13 | Compute derived series on-the-fly: moving average, diff, rate-of-change, normalize. Resample to common time grid. Gap fill (linear, hold, zero). Engine runs in Web Worker alongside LOD. |

### v1.1 Entry Criteria

- V1 shipped and published on npm
- At least 2 weeks of field feedback collected
- No critical bugs open in V1

### v1.1 Exit Criteria

- All 15 epics implemented and tested
- All V1 KPIs still met (no performance regression)
- Persistent state survives zoom/pan/resize
- Ruler measurement accuracy ≤ 1 data sample
- Compare-to-past handles DST correctly
- ChartTable virtualizes 1M rows at 60 fps scroll
- Bundle size: ≤ 150 KB gzip (core + all v1.1 features)

---

## v1.2 — Industrial Viz (~12 weeks, ~170 SP)

**Goal:** Expand from line charts to full industrial visualization suite. Add frequency-domain analysis (spectrogram, power spectrum, Bode plot), statistical visualizations (histogram, box plot, violin), and SPC control charts. After v1.2, the library covers 80% of process monitoring needs.

**Dependency:** v1.1 shipped. Colormap engine is prerequisite for spectrogram.

### Epics

| ID | Epic | Priority | Est. SP | Description |
|---|---|---|---|---|
| E7.1 | Colormap Engine | P1 | 13 | Shared colormap infrastructure for spectrogram and heatmap. Built-in colormaps: viridis, plasma, inferno, magma, turbo, jet, grayscale. Custom colormaps via `[stop, color][]`. GPU texture-based lookup for WebGPU, ImageData-based for Canvas2D. Dynamic range clamping. |
| E7.2 | Spectrogram | P1 | 21 | 2D time-frequency heatmap. X = time, Y = frequency, color = magnitude (dB). WebGPU fragment shader for real-time rendering. Scrolling mode for live data. Cursor shows (time, freq, magnitude). Syncs with TimeSeries via ChartSyncGroup (shared time axis). |
| E7.3 | PowerSpectrum | P1 | 8 | Single-spectrum vertical bar/line chart. FFT computed in Worker. Log frequency scale. Peak detection and labeling. Snap-to-peak cursor. Links to spectrogram (click on spectrogram → show that time slice as power spectrum). |
| E7.4 | BodePlot (Dual-Panel) | P2 | 13 | Dual vertically-stacked panels: magnitude (dB) and phase (degrees) vs frequency. Shared frequency axis. Log frequency scale. Gain margin, phase margin markers. Common in control system analysis. |
| E7.5 | WaterfallPlot | P2 | 13 | 3D-like cascading spectra over time. Pseudo-3D perspective via skewed 2D rendering. Alternative to spectrogram for sparse spectral data. Color = magnitude. Time advances back-to-front. |
| E7.6 | Histogram + KDE | P1 | 8 | Distribution chart. Configurable bin count or auto (Sturges/Freedman-Diaconis). Kernel density estimate overlay. Normal fit overlay. Statistics annotation (mean, std, skew, kurtosis). |
| E7.7 | BoxWhisker + ViolinPlot | P1 | 13 | Side-by-side comparison of distributions. Box: Q1-Q3, whiskers at 1.5×IQR, outlier dots. Violin: mirrored KDE. Compact mode for many groups (>20). Hover shows statistics. |
| E7.8 | QQPlot + ProbabilityPlot | P2 | 8 | Quantile-quantile plot for normality assessment. Reference line for perfect fit. Confidence envelope. Probability plot on probability paper (normal, Weibull). |
| E7.9 | ControlChart (X̄-R, CUSUM, EWMA) | P1 | 21 | SPC control charts: X̄ (mean), R (range), S (std), CUSUM (cumulative sum), EWMA (exponentially weighted). Control limits (UCL/LCL) auto-calculated or manual. Western Electric rules for out-of-control detection. Rule violation highlighting. |
| E7.10 | RunChart + CapabilityHistogram + BatchProfile | P1 | 13 | Run chart (individual values over time with control limits). Process capability histogram (Cp, Cpk overlays). Batch profile: overlay multiple batches aligned by batch time. Golden batch reference. |
| E7.11 | Process KPIs (Gauge, Bullet, Sparkline, WaterfallBar) | P1 | 13 | Small-multiple "at-a-glance" widgets: radial gauge with arc, bullet chart (target vs actual vs bands), sparkline (mini line chart), waterfall bar (contribution analysis). Designed for dashboard tiles. |
| E7.12 | NyquistPlot + OrderTrack + EnvelopeSpectrum | P2 | 24 | Specialist frequency-domain charts for vibration analysis. Nyquist: polar magnitude/phase plot. Order tracking: frequency vs RPM. Envelope spectrum: bearing fault detection. |

### v1.2 Entry Criteria

- v1.1 shipped
- Colormap engine designed (E7.1 always first)

### v1.2 Exit Criteria

- All chart types render at target fps with benchmark data sizes
- Spectrogram streams live FFT data at ≥ 60 fps
- Control charts detect all 8 Western Electric rules correctly
- All new chart types compose via ChartSyncGroup
- Bundle size: ≤ 200 KB gzip (core + line + all v1.2 types, tree-shakeable)

---

## v1.3 — Correlation & Anomaly Detection (~8 weeks, ~120 SP)

**Goal:** Complete the S2G++ anomaly detection pipeline frontend. Multivariate correlation analysis, anomaly timeline, root cause visualization, and incident management. Also: PDF export and full PRhistorian integration.

**Dependency:** v1.2 shipped (spectrogram/SPC for composite dashboards).

### Epics

| ID | Epic | Priority | Est. SP | Description |
|---|---|---|---|---|
| E8.1 | ScatterPlot + Density Underlay | P1 | 13 | 2-variable scatter plot. WebGPU point rendering for 1M+ points. Density underlay (2D histogram or KDE heatmap) for overplotting. Brush-to-zoom. Lasso selection. Color-by-third-variable. |
| E8.2 | CorrelationMatrix + Dendrogram | P1 | 13 | NxN heatmap of Pearson/Spearman correlations. Interactive: click cell → drill into scatter plot. Hierarchical clustering dendrogram for variable ordering. |
| E8.3 | CrossCorrelation + RegressionPlot | P1 | 13 | Cross-correlation lag plot between two signals. Peak lag detection. Linear/polynomial regression with confidence bands. Residual plot. R² annotation. |
| E8.4 | ParallelCoordinates + PCABiplot + PhaseSpace | P1 | 21 | Parallel coordinates for high-dimensional data (10-50 variables). Brushable axes. PCA biplot (2D projection of principal components). Phase space (X vs dX/dt). |
| E8.5 | AnomalyTimeline + FusionScorePlot | P1 | 13 | Timeline view of detected anomalies: severity color-coded bands over time. Fusion score: aggregate anomaly score from multiple detectors. Threshold line. Click-to-investigate. |
| E8.6 | RootCauseBar + DetectorHeatmap + ThresholdCalibration + IncidentCard | P1 | 21 | Root cause analysis bar chart (ranked contributing factors). Detector heatmap (which detectors fired when). Threshold calibration UI (drag threshold, see false positive/negative rates). Incident card (summary view: anomaly metadata + key charts + proposed root cause). |
| E8.7 | Event Overlays & Enhanced Annotations | P1 | 8 | Overlay discrete events on any chart type (alarm, operator action, batch transition). Icon markers with expandable detail popover. Event lane management across synced charts. |
| E8.8 | PDF Export Engine | P1 | 8 | Vector PDF export using `pdf-lib` or `jspdf`. Multi-page: one chart per page or tiled layout. Include legend, axes, annotations. Configurable page size (A4, Letter, custom). Header/footer with metadata. |
| E8.9 | PRhistorian Full Integration & Migration | P0 | 21 | Drop-in replacement for the existing PRhistorian charting layer. Adapter API that maps PRhistorian data model to @pitant/charts data model. Migration guide. Feature parity validation suite. |

### v1.3 Entry Criteria

- v1.2 shipped
- S2G++ anomaly pipeline produces output in a documented format

### v1.3 Exit Criteria

- Scatter plot renders 1M points at ≥ 60 fps (WebGPU)
- Correlation matrix handles ≥ 100 variables
- Parallel coordinates handles ≥ 50 axes at 60 fps
- PDF export produces valid PDF with correct layout
- PRhistorian migration passes 100% feature parity tests
- All chart types accessible (keyboard nav, screen reader)
- Bundle size: ≤ 250 KB gzip (entire library, all chart types, tree-shakeable)

---

## Architecture Evolution Across Versions

```
V1.0 (ship)
┌──────────────────────────────────────────┐
│  TimeSeries Line Chart                   │
│  DigitalChannel                          │
│  WebGPU + Canvas2D renderers             │
│  Data Engine (Worker + LOD)              │
│  Streaming (Ring Buffer)                 │
│  Headless Primitives (Container, Legend, │
│    Tooltip, SyncGroup, DataZoom)         │
│  Interactions (Zoom, Pan, Crosshair)     │
│  Export (PNG, SVG)                       │
│  shadcn Registry (8 blocks)             │
└──────────────────────────────────────────┘

V1.1 (add)
┌──────────────────────────────────────────┐
│  + Persistent Data Tips & Rulers         │
│  + Brush & Selection Persistence         │
│  + Compare-to-Past Overlay               │
│  + AlarmBand / EnvelopeBand / Anomaly    │
│  + Annotations                           │
│  + Derived Series Engine                 │
│  + ChartTable (Table Twin)               │
│  + Advanced Legend                        │
└──────────────────────────────────────────┘

V1.2 (add)
┌──────────────────────────────────────────┐
│  + Colormap Engine                       │
│  + Spectrogram / PowerSpectrum / Bode    │
│  + Histogram / BoxPlot / Violin          │
│  + SPC Control Charts (X̄-R, CUSUM, EWMA)│
│  + Process KPIs (Gauge, Bullet, etc.)    │
│  + NyquistPlot / OrderTrack             │
└──────────────────────────────────────────┘

V1.3 (add)
┌──────────────────────────────────────────┐
│  + Scatter / CorrelationMatrix           │
│  + ParallelCoordinates / PCA Biplot      │
│  + AnomalyTimeline / RootCauseBar        │
│  + PDF Export                            │
│  + PRhistorian Migration                 │
└──────────────────────────────────────────┘
```

---

## Open Questions for Post-V1

| # | Question | Target Version | Notes |
|---|---|---|---|
| Q1 | Should we support Vue and Svelte bindings? When? | v1.2+ | Core is framework-agnostic. React bindings are the priority. Vue/Svelte could be community-contributed. |
| Q2 | Arrow IPC decode: built-in or opt-in entrypoint? | v1.1 | Decision D9 deferred. Need to assess bundle impact (~40 KB). Consider WASM-based decode. |
| Q3 | WebAssembly for hot-path computation (LOD, FFT)? | v1.2 | Current Web Worker + TS approach may suffice. Profile before committing to WASM. |
| Q4 | 3D chart types (surface, volume)? | v1.4+ | Very different rendering pipeline (WebGPU compute shaders). Separate decision. |
| Q5 | Real-time collaboration (shared cursor across users)? | v2.0 | Requires backend. Out of scope for client-side library unless via adapter. |
| Q6 | White-label / OEM licensing model alongside MIT? | v1.2+ | Business decision. MIT core + premium enterprise features (PDF, SSO adapter, etc.)? |

---

## Backlog of Deferred Ideas

These ideas surfaced during V1 planning but are not assigned to any version yet. They live here as a parking lot.

- **Dashboard layout engine** — Drag-and-drop grid layout for arranging multiple charts. Think CSS Grid with resize handles. Could use `react-grid-layout` or build custom.
- **Data source adapters** — Built-in adapters for InfluxDB, TimescaleDB, Prometheus, OPC-UA, MQTT. Transform query results to `ColumnarData` format.
- **Alerting integration** — Connect to PagerDuty, Opsgenie, Slack. Show active alerts as overlays. Resolve from chart.
- **Theming marketplace** — Community-contributed color themes. "Install theme" via shadcn CLI.
- **Plugin system** — Third-party extensions for new chart types, interactions, or data sources. Plugin registry.
- **Mobile-first app shell** — PWA wrapper for field technician use. Offline cache. Touch-optimized interactions.
- **AI-powered insights** — "Explain this anomaly" button that sends visible data to an LLM and displays natural language analysis.
- **Jupyter widget** — Python binding via `ipywidgets` for Jupyter notebook integration. Scientists can use the same charts as the web app.
- **Figma plugin** — Export chart designs from Figma, generate @pitant/charts configuration. Design-to-code bridge.
