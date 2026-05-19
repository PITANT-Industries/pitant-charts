# 06 - Feature Spec Inventory

This is the scope source of truth for `pitant-charts`. Features here may be
claimed at one of four maturity levels: `contract_only`, `simulated`, `pilot`,
or `production`. Sales, docs, examples, UI badges, and release notes must use
the same words.

This inventory is deliberately performance-first. Broad chart coverage matters,
but the v1 product promise is narrower: replace SciChart for Pitant's highest
pressure historian and anomaly-review surfaces by being faster, more
predictable, and more evidence-aware. Any feature that harms the performance
contract below is either deferred, profile-gated, or redesigned.

## Feature Taxonomy

Features are grouped by the process families from `02-CORE-FEATURES.md` plus
premium and future surfaces.

Every feature line ends with:

- Surface tag: `[Backend/Compute]`, `[Frontend]`, or `[Both]`
- Mode vector: `{Proof=...; Workflow=...; Sovereignty=...; Autonomy=...; Privacy=...; Liability=...}`

Mode values are defined in `03-SAFETY-AND-SECURITY.md`.

## Performance-First Scope Rule

V1 is not "all scientific charts." V1 is the fastest trustworthy industrial
line-chart stack Pitant can ship. Chart families outside TimeSeries,
DigitalChannel, core overlays, and essential synchronization remain
`contract_only` until the line-chart performance gates are repeatable.

Performance features are first-class features in this inventory. A renderer
fast path, worker-transfer policy, allocation budget, browser benchmark, or
regression gate is not "implementation detail" if losing it would make SciChart
mandatory again.

## Max Performance Contract

| Workload | Target | Hard failure threshold | Evidence |
|---|---:|---:|---|
| Single pen, 100k points, pan/zoom | 60 fps | below 55 fps sustained | Browser FPS benchmark |
| Single pen, 1M points, initial view | under 250 ms | over 500 ms | Browser first-render benchmark |
| 8 pens, 1M points each, initial view | under 1 s | over 2 s | Browser benchmark |
| 8 pens, 1M points each, pan/zoom | 60 fps target | below 30 fps sustained | Browser FPS benchmark |
| 16 pens, 1M points each, static redraw | under 250 ms | over 750 ms | Browser redraw benchmark |
| Live append, 8 pens, 1k samples/sec/pen | 60 fps | below 45 fps sustained | Streaming browser benchmark |
| Worker LOD build, 1M points | under 100 ms | over 250 ms | `apps/benchmark` |
| Worker LOD build, 5M points | under 500 ms | over 1 s | `apps/benchmark` |
| Viewport LOD query | under 2 ms/query | over 8 ms/query | `apps/benchmark` |
| Interaction event to visual response | under 16 ms | over 32 ms | Browser interaction benchmark |
| Cursor sync across 4 charts | under 1 frame | over 2 frames | Browser sync benchmark |
| Chart memory, 1M point single pen | under 80 MB | over 160 MB | Memory benchmark |
| Chart memory, 8 x 1M points | under 200 MB | over 400 MB | Memory benchmark |
| Core line-chart gzip bundle | under 80 KB | over 120 KB | Size gate |
| React primitive incremental gzip | under 40 KB | over 70 KB | Size gate |

Targets are allowed to vary by browser and hardware class, but failures must be
visible in the benchmark report. A feature cannot become `production` without
passing the workload rows that apply to it.

Benchmark target policy is two-tiered. `bun run bench` is the strict local and
release-candidate gate; those targets are the performance contract. GitHub CI
may run `PITANT_BENCH_PROFILE=ci` for cold shared runners, but that profile is
only a regression tripwire for runner noise and cannot be used to claim a
performance milestone or update the benchmark baseline.

## Performance Maturity Labels

- `perf_unknown`: no benchmark exists.
- `perf_fixture`: synthetic or unit benchmark exists, no browser evidence.
- `perf_browser`: browser benchmark exists on one supported browser.
- `perf_matrix`: browser benchmark passes across supported browser matrix.
- `perf_regression_gated`: CI blocks regressions against baseline.

Runtime maturity and performance maturity are separate. A feature can be
`pilot` but only `perf_fixture`; it cannot be called production for high-density
Pitant use until it is at least `perf_browser`.

## Current Implementation Overlay

| Section | Implemented | Contract-only | Future | Evidence |
|---|---:|---:|---:|---|
| Ingest | 45% | 45% | 10% | `ColumnarData`, `DataSource`, historian adapter tests |
| Normalize | 35% | 55% | 10% | validation tests, quality/gap viewport tests |
| Transform | 68% | 22% | 10% | `LodPyramid`, `DataEngine`, derived-series columns, benchmarks |
| Layout | 35% | 50% | 15% | `createChartLayout`, plot reservation, axis text tests |
| Render | 86% | 5% | 9% | WebGPU, Canvas2D, command list, text overlay, TimeSeries value/envelope bands, derived overlays, anomaly score tracks, SPC control-limit tracks, persistent annotation/ruler overlays, sparse event markers, precomputed-bin Spectrum command frames, precomputed-tile Spectrogram command frames, and precomputed-bin Distribution command frames |
| Interact | 82% | 6% | 12% | pointer, zoom, pan, keyboard, touch, DataZoom, crosshair, quality/gap/provenance tooltip tests, range-navigation helper tests, live-append interaction regression |
| Compose | 76% | 19% | 5% | React primitives, `TimeSeries`, `DigitalChannel`, `Spectrum`, `Spectrogram`, `Distribution`, and tests |
| Synchronize | 65% | 25% | 10% | `ChartSyncGroup`, TimeSeries, DigitalChannel sync tests, cursor propagation benchmark |
| Theme | 70% | 25% | 5% | token resolver and CSS |
| Export | 75% | 15% | 10% | explicit PNG export options and true SVG export from command frames |
| Benchmark | 99% | 0% | 1% | strict benchmark app gate, explicit CI benchmark profile, interaction range stress gate, cursor propagation gate, TimeSeries band benchmark, TimeSeries derived-series benchmark, TimeSeries anomaly-track benchmark, TimeSeries SPC-track benchmark, TimeSeries annotation/ruler benchmark, TimeSeries event-marker benchmark, Spectrum one-million-window benchmark, Spectrogram one-hour-tile benchmark, Distribution one-million-window benchmark, browser FPS mode, browser screenshot verifier, TimeSeries bands/anomaly/SPC/Spectrum/Spectrogram/Distribution harness profiles, visual baseline, local Playwright Chromium/Firefox/WebKit smoke matrix |
| Package | 90% | 0% | 10% | v1 package metadata, README files, package changelogs, MIT licenses, npm publish dry-run, expanded shadcn registry, registry validator, registry typecheck, shadcn smoke, live docs app, quick start |
| Govern | 20% | 70% | 10% | architecture docs |
| Performance Contract | 69% | 26% | 5% | LOD, interaction range, cursor propagation, TimeSeries band, TimeSeries derived-series, TimeSeries anomaly-track, TimeSeries SPC-track, TimeSeries annotation/ruler, TimeSeries event-marker, Spectrum precomputed-bin, Spectrogram precomputed-tile, Distribution precomputed-bin, browser FPS benchmarks, and live-append interaction regression |
| GPU Hot Path | 35% | 55% | 10% | WebGPU context and shaders |
| Worker Hot Path | 60% | 35% | 5% | `DataEngine`, `LodPyramid` |
| Memory Budget | 30% | 60% | 10% | memory overhead and interaction heap-growth benchmarks |
| Browser Matrix | 80% | 10% | 10% | Chrome CDP harness plus local Playwright Chromium, Firefox, and WebKit smoke; TimeSeries bands, anomaly, SPC, Spectrum, Spectrogram, and Distribution profiles covered in harness; Edge configured in CI but not locally verified |

## Performance Workload Model

The workload model is the set of scenarios that drive implementation order. If
a feature does not improve or preserve these scenarios, it is not v1 critical.

### Workload Classes

| Class | Shape | Primary user | v1 status |
|---|---|---|---|
| P0 trend | 1-8 analog pens, 100k-8M total points, zoom/pan/cursor | Process engineer | production target |
| P0 digital | 1-32 digital channels, dense transitions, step rendering | Controls engineer | production target |
| P0 sync | 2-4 charts sharing x-range and cursor | Operator, engineer | production target |
| P1 live | 1-16 pens, append-only stream, live edge | Operator, monitoring screen | pilot target |
| P1 evidence | signed/static replay window, export, no animation | Auditor, incident reviewer | pilot target |
| P2 overlays | alarm bands, envelope bands, anomaly tracks | Reliability, quality | post-v1 or pilot |
| P2 dense panels | 8-16 chart panels on one dashboard | Control room | post-v1 hardening |
| P3 scientific packs | spectrum, spectrogram, histogram, SPC, correlation | Specialist engineer | initial Spectrum, Spectrogram, and Distribution packs; correlation and remaining surfaces contract-only |

### Workload Use / Do Not Use Rules

| Workload | Use when | Do not use when |
|---|---|---|
| P0 trend | The user needs high-density analog time-series inspection, pan/zoom, cursor readout, and multi-pen comparison. | The view is categorical, event-only, or aggregate-only and does not need continuous x/y plotting. |
| P0 digital | The data represents discrete states, binary channels, machine modes, interlocks, or transition sequences. | The values are continuous analog signals where step rendering would imply false state holds. |
| P0 sync | Multiple panels must explain the same time window and cursor position together. | Charts compare unrelated time ranges, tenants, sites, or evidence scopes. |
| P1 live | New samples append continuously and the operator wants a live-edge view. | The user is performing evidence review, static audit export, or any workflow where moving data would compromise review. |
| P1 evidence | The user needs a reproducible, signed or reviewable static chart window. | The chart is exploratory, live, or unsupported by upstream provenance/evidence metadata. |
| P2 overlays | Bands, anomaly tracks, limits, or contextual lanes materially change interpretation of the trend. | The overlay is decorative, unverified, or expensive enough to break the P0 trend budget. |
| P2 dense panels | A control-room or engineering dashboard needs many compact charts visible at once. | One chart needs deep interaction, heavy annotations, or high-density export; use focused P0/P1 views instead. |
| P3 scientific packs | Specialist workflows need spectrograms, histograms, SPC, correlation, or post-v1 chart families. | The line-chart performance gates are not closed or the feature lacks a contract and benchmark fixture. |

### Phase 6 Chart Family Use / Do Not Use Catalog

Phase 6 chart families are allowed only when they preserve the v1 performance
contract or declare a narrower profile. A chart family is not accepted because
SciChart has it; it is accepted when a PITANT workflow has a repeatable
decision, fixture, non-use boundary, and benchmark.

| Chart family | Use when | Do not use when | Required fixture | Mode |
|---|---|---|---|---|
| Alarm bands | Operators or reviewers need high/low, warning, trip, permit, or environmental limits overlaid on a trend. | Limits are not authoritative, change per cursor position, or would imply a control command path. | `trend-alarm-band-8x1m` | [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational} |
| Envelope bands | Engineers compare an observed signal against model, recipe, expected, tolerance, or golden-run envelopes. | The envelope is speculative, not time-aligned, or would hide actual raw values. | `trend-envelope-band-1m` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review} |
| Derived series overlays | Engineers need fast visual overlays such as moving average, delta, rate-of-change, unit-normalized copy, or scale/offset comparison in the same trend. | The calculation owns domain semantics, regulatory evidence, SPC rules, OEE, model inference, correction records, or any value that must become a source-of-record result. | `derived-series-8x1m` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review} |
| Anomaly score tracks | Reliability or AI review needs a separate bounded score lane aligned with the trend cursor. | The score has no model version, threshold provenance, or reviewer state. | `anomaly-score-track-4x1m` | [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review} |
| Event markers | Users need sparse starts, stops, alarms, comments, batches, holds, corrections, maintenance events, or investigation pins aligned to the trend time axis and exportable with the chart. | Markers become dense enough to replace a timeline/event-table UI, labels obscure plotted data, or the event owns workflow state that belongs to alarm, batch, audit, or compliance repos. | `trend-event-marker-10k` | [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=operational} |
| Annotation layers | Engineers need reviewed callouts, measured intervals, x/y reference lines, region highlights, rulers, or persistent investigation notes that must appear in exportable chart geometry. | Notes are free-form unreviewed operational instructions, the view lacks custody/evidence context, or dense event history should be rendered as a timeline/table instead of plotted annotations. | `annotation-ruler-review` | [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review} |
| SPC control charts | Quality engineers inspect Xbar, R, S, individual, moving-range, p, np, c, or u charts with rule violations. | The source process lacks subgroup semantics, sampling cadence, rule set, or approved limits from `pitant-spc`. | `spc-xbar-r-10k` | [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=quality-impacting} |
| Capability histograms | Quality engineers evaluate Cp, Cpk, Pp, Ppk, spec limits, distribution shape, and outlier treatment from an upstream frozen quality sample. | The distribution is streaming live data without frozen sample boundaries, approved spec limits, or `pitant-spc` ownership of capability metrics. | `capability-histogram-100k` / `028_distribution_1m_window_512_bins` / harness `distribution` | [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=quality-impacting} |
| Distribution charts | Analysts compare histogram, percentile marker, density-like, residual, or frozen-sample distributions where time ordering is intentionally removed. | Time ordering, causality, event sequence, live streaming, or authoritative Cp/Cpk calculation is the primary question; use a trend/timeline or `pitant-spc` result instead. | `distribution-panel-1m` / `028_distribution_1m_window_512_bins` / harness `distribution` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review} |
| Spectrogram | Vibration, audio, power, or process-frequency workflows need time-frequency heatmap inspection from a frozen upstream STFT/tile payload. | The signal has irregular cadence, missing sampling-rate metadata, the user only needs a single FFT snapshot, or authoritative STFT computation is expected inside `pitant-charts`; use Spectrum or analytics siblings instead. | `spectrogram-tiles-60m` / `027_spectrogram_60m_64k_tiles` / harness `spectrogram` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review} |
| Spectrum and power spectrum | Specialists need frequency-domain peaks, harmonics, band power, or rotating equipment signatures from a frozen upstream analysis window. | The workflow needs time evolution of frequency content, missing sample-rate/window metadata, or authoritative FFT/STFT computation inside `pitant-charts`; use spectrogram or analytics siblings instead. | `spectrum-1m-window` / `026_spectrum_1m_window_64k_bins` / harness `spectrum` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review} |
| Bode and transfer response | Controls or process engineers compare gain/phase response for known stimulus and response signals. | The input/output pair is not validated, not synchronized, or would imply controller tuning authority. | `bode-response-fixture` | [Both] {Proof=checksum; Workflow=approve; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review} |
| Scatter plot | Analysts inspect relationship, clusters, operating envelopes, or residuals between two numeric variables. | Time order, excursions, or sequence explains the event; use linked trend plus brushing instead. | `scatter-500k-brush` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review} |
| Correlation matrix | Engineers compare many variable pairs to choose candidates for deeper investigation. | The user needs causality, lag discovery, or model explanation; hand off to analytics/model repos. | `correlation-matrix-128vars` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review} |
| Parallel coordinates | Analysts compare multivariate operating states, recipes, grades, or batch outcomes at moderate row counts. | The row count is too high to render clearly or the workflow requires exact time-series inspection. | `parallel-coordinates-20k` | [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review} |
| KPI strip and sparkline panels | Dashboards need compact status, trend, limit, and freshness signals across many assets. | The user must inspect raw points, quality flags, or evidence custody; use focused trend views. | `kpi-strip-256-assets` | [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=operational} |
| PDF export | Reviewed, regulated, customer-facing, or CAPA workflows need paginated artifacts with evidence labels. | The view is exploratory, live, lacks provenance, or needs machine-replay instead of page layout. | `pdf-evidence-pack-20charts` | [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record} |

No Phase 6 chart family may move beyond `contract_only` until its required
fixture exists, the frontend contract pack lists success/degraded/denied/
validation states, and the performance budget owner has accepted the benchmark.

### Performance Budget Owners

| Budget | Owner family | Default owner module |
|---|---|---|
| Input parse and validation | Ingest | `data/ingest` |
| Quality/gap normalization | Normalize | `data/normalize` |
| LOD build and query | Transform | `data/transform` |
| Geometry and axis layout | Layout | `layout` |
| Command generation | Render | `render/commands` |
| GPU upload and draw | Render | `render/webgpu` |
| Canvas path batching | Render | `render/canvas2d` |
| Pointer-to-data mapping | Interact | `interact/gestures` |
| Nearest-point lookup | Interact / Transform | `interact/cursor` |
| DOM overlay work | Compose / Theme | `charts-react/primitives` |
| Sync propagation | Synchronize | `charts-react/sync` |
| Export render | Export | `export` |
| Benchmark evidence | Benchmark | `apps/benchmark` |

### Performance No-Go Rules

- No per-point React elements. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No per-point object allocation in the hot render loop. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No full data re-ingest on pan or zoom. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No full LOD rebuild on ordinary append below the ring-buffer eviction boundary. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No renderer-specific public data model. [Both] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No layout read/write thrash during pointermove. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No synchronous expensive query work inside pointermove. [Both] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No high-density SVG path as a v1 render path. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No hidden Canvas2D downgrade without visible capability state. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- No benchmark-free performance claim. [Both] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Required Performance Fixtures

- `trend-100k-single-pen`: smooth analog signal with gaps and quality flags. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `trend-1m-single-pen`: one million point analog signal with min/max spikes. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `trend-8x1m`: eight pens with mixed frequency and amplitude. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `trend-16x1m`: stress fixture for draw ordering and memory budget. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `digital-32-channel-dense`: digital transitions with state labels. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `live-8pen-1khz`: append stream with live-edge viewport. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `sync-4panel-1m`: four charts sharing cursor and x-range. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `interaction-1000-cycle`: deterministic mixed zoom, pan, DataZoom, keyboard-style zoom, touch pinch, and touch pan range updates. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `evidence-gapped-window`: static signed-style window with gaps, corrections, and quality flags. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- `fallback-canvas-200k`: Canvas2D fallback stress fixture. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `small-dashboard-16charts`: many small charts testing DOM overlay and sync overhead. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `trend-alarm-band-8x1m`: eight high-density trend pens with warning/trip/permit bands, band labels, and visibility toggles, covered by `020_time_series_bands_8x1M` and the browser harness `bands` profile. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `trend-envelope-band-1m`: one million point signal with model, recipe, tolerance, and golden-run envelope variants, covered by `020_time_series_bands_8x1M` and the browser harness `bands` profile. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- `derived-series-8x1m`: eight high-density trend pens plus eight visual-only derived overlays using moving average and rate-of-change, covered by `021_time_series_derived_8x1M`. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `anomaly-score-track-4x1m`: four synchronized trends plus model-versioned anomaly score lanes and reviewer states, covered by `024_time_series_anomaly_tracks_4x1M` and the browser harness `anomaly` profile. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- `trend-event-marker-10k`: sparse and bursty start, stop, alarm, batch, comment, hold, correction, maintenance, and investigation markers on one time axis, covered by `023_time_series_event_markers_8x1M`. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=operational}
- `annotation-ruler-review`: persistent x/y reference lines, x/y region highlights, rulers, region notes, reviewer initials, custody labels, and hidden/visible annotation states, covered by `022_time_series_annotations_8x1M`. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- `spc-xbar-r-10k`: subgrouped SPC sample stream with Xbar/R limits, Western Electric style rules, and violation markers, covered by `025_time_series_spc_tracks_10k` and the browser harness `spc` profile. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=quality-impacting}
- `capability-histogram-100k`: frozen quality sample with spec limits, outliers, Cp/Cpk/Pp/Ppk summaries, and bin-density stress; the chart package renders the precomputed distribution and spec/target/percentile markers through `Distribution`, while `pitant-spc` owns authoritative capability metrics. Covered by `028_distribution_1m_window_512_bins` and the browser harness `distribution` profile. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=quality-impacting}
- `distribution-panel-1m`: histogram and percentile-marker distribution panel from one million source samples represented as frozen upstream bins, covered by `028_distribution_1m_window_512_bins` and the browser harness `distribution` profile. Box, violin, density, and residual variants remain contract-only extensions. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `spectrogram-tiles-60m`: time-frequency tile set for one hour of regular-cadence vibration, audio, power, or process signal, covered by `027_spectrogram_60m_64k_tiles` and the browser harness `spectrogram` profile. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- `spectrum-1m-window`: frequency-domain snapshot with windowing policy, peak labels, harmonic bands, and band-power summaries. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `bode-response-fixture`: synchronized stimulus/response signal pair with gain, phase, confidence, and invalid-pair states. [Both] {Proof=checksum; Workflow=approve; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `scatter-500k-brush`: 500k point scatter with brushing, density fallback, selection handoff, and linked trend cursor output. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- `correlation-matrix-128vars`: 128-variable correlation grid with lag-disabled default, missing-data markers, and drilldown handoff. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- `parallel-coordinates-20k`: 20k row multivariate operating-state view with axis brushing, outlier highlighting, and sampled density mode. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- `kpi-strip-256-assets`: compact asset strip with sparkline, freshness, quality, limit, and alarm-count states across 256 assets. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `pdf-evidence-pack-20charts`: paginated export with 20 charts, evidence labels, provenance footers, page numbers, and replay references. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}

## Max Performance Feature Inventory

This section is intentionally dense. It is the implementation pressure surface
for v1.

### Mechanism Use / Do Not Use Matrix

| Mechanism | Use when | Do not use when |
|---|---|---|
| Struct-of-arrays storage | Any hot-path numeric series can be represented as typed columns. | The data is sparse metadata, nested events, or low-volume labels better held outside the render path. |
| Row-to-column adapter | External payloads arrive as row objects or JSON fixtures. | Data is already normalized as typed arrays; avoid extra copies. |
| Worker LOD pyramid | Series are large enough that LOD build/query would block the main thread or be reused across views. | Series are below the measured fast-path threshold and worker startup costs dominate. |
| Main-thread fast path | Small fixture or low-point-count series need immediate render with minimal overhead. | Data can exceed the threshold, append live, or participate in large synchronized dashboards. |
| Min-max LOD | The visual must preserve spikes, valleys, and extremes while reducing point count. | The chart is statistical, categorical, or already pre-aggregated to viewport density. |
| Core derived columns | A visual-only overlay can be computed from existing numeric columns before LOD, then rendered, queried, exported, and tooled like any other series. | The calculation is a business result, signed evidence, model inference, SPC violation, OEE metric, or audit correction; sibling repos must own those semantics. |
| Ring buffer | Live append mode has bounded recent-history requirements. | Historical evidence review, legal hold, or replay requires complete retained history. |
| Query result pooling | Repeated pan/zoom/cursor work would allocate transient arrays. | A one-off export or tiny chart does not create allocation pressure. |
| Command-list cache | Axes, grid, labels, lanes, or overlays are stable across frames. | The command depends on every pointer movement or rapidly changing data. |
| GPU buffer pool | WebGPU charts repeatedly upload similarly sized buffers. | Canvas2D fallback is active or a one-shot export path is running. |
| WebGPU renderer | Browser support exists and workload is high-density, multi-series, or interaction-heavy. | WebGPU is unavailable, device is lost, or browser policy blocks GPU use. |
| Canvas2D renderer | WebGPU is unavailable or the workload is small enough for fallback budgets. | The chart must claim high-density production performance beyond Canvas fallback budgets. |
| Overlay canvas/DOM layer | Cursor, tooltip, selection, or annotation changes should avoid full redraw. | The overlay changes the underlying plotted data or needs export as vector geometry. |
| Frame scheduler | Multiple data, layout, and interaction events can be coalesced into the next animation frame. | A synchronous API must return a static export artifact or test result. |
| Live load shedding | Rendering cannot keep up but data must be preserved. | Evidence review or deterministic replay requires every visible state to be stable and reviewable. |
| Core range-navigation helpers | Any gesture changes only the visible x-window through clamped zoom, pan, reset, DataZoom, keyboard, or touch semantics. | The interaction changes data, y-axis policy, source query identity, evidence custody, or process workflow state. |
| Sync group | Charts share time/range/cursor context within one tenant/site/evidence scope. | Charts cross tenant, site, sovereignty, or evidence boundaries without explicit permission. |
| Development performance HUD | Engineers need frame, memory, renderer, and worker diagnostics. | Production regulated workflows where diagnostic overlays could confuse evidence review. |
| SVG export | The requested output is moderate complexity and needs vector scaling. | The chart has millions of visible vertices; export a decimated/vector-safe view or PNG/replay spec instead. |
| PDF export | Regulated or reviewed artifacts need page layout and evidence labels. | The workflow is exploratory or lacks upstream provenance and replay metadata. |

### Data Shape and Ingestion Hot Path

- Struct-of-arrays series storage. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Timestamp column stored separately from value columns. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- BigInt timestamp ingestion with downcast policy only at render boundary. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Float64 source values with Float32 render buffers. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Transferable ArrayBuffer ingestion for worker path. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Copy-count instrumentation for ingestion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Zero-copy fast path for already-normalized columnar payloads. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Row-to-column adapter isolated outside hot path. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-series metadata intern table to avoid repeated string allocation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Quality flag bitset path for dense series. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Sparse quality interval path for mostly-good series. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Gap interval sidecar path instead of sentinel values in point arrays. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-series stable numeric ID for render and sync paths. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Input validation mode split: strict for dev, sampled for trusted production payloads. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Ingestion backpressure signal for live streams. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}

### Worker and LOD Hot Path

- Worker-owned LOD pyramid lifecycle. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Main-thread fast path only for small series below measured threshold. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- O(1) viewport LOD level selection by point density target. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Min-max bucket preservation for spikes and valleys. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Append propagation without full rebuild until eviction boundary. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Ring-buffer eviction rebuild budget and warning. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Viewport query result pooling. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Worker request coalescing for pan and zoom bursts. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Stale query cancellation by viewport generation ID. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Worker queue depth diagnostics. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Worker memory high-water mark diagnostics. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Query window cache for repeated tooltip and minimap requests. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Dedicated minimap LOD track to avoid stealing main-chart query budget. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Separate nearest-point index from render LOD buffer. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Quality/gap interval query aligned with LOD query. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Command Generation Hot Path

- Command list generated from viewport data only. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-series command batching. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Stable z-layer ordering without sort on every frame. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Dirty-rectangle invalidation for overlays. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Axis command cache keyed by range, size, and formatter version. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Grid command cache keyed by axis tick generation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Text command cache for repeated tick labels. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Overlay lane command cache. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Gap break command generation without splitting into many JS arrays. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Step-line command generation with preallocated output size. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Quality overlay command compaction by interval. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Draw command count budget per frame. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Command list allocation budget per frame. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Command generation profiler marks. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### WebGPU Hot Path

- Single draw call per visible line series where geometry permits. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Shared GPU buffer pool by chart surface. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Incremental buffer update for append-only live path. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Avoid GPU buffer recreation on pan and zoom when point capacity is unchanged. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Pipeline cache keyed by primitive and style class. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Bind group cache keyed by transform and token generation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Device-loss recovery with visible fallback state. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- GPU timing markers where browser permits. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Analytical anti-aliasing in shader. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Wide-line join and cap policy with bounded geometry expansion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Packed color and style uniforms per series. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Clip-space transform on GPU for pan and zoom fast path. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Optional CPU-to-GPU transform fallback for unsupported device paths. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- WebGPU resource disposal and leak test. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Canvas2D Fallback Hot Path

- Path2D batching for static viewport draw. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Direct canvas path generation for dynamic pan/zoom when Path2D cache misses. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Canvas fallback point budget by hardware class. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Fallback LOD level bias to preserve interaction frame rate. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Canvas text batching for axis labels. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Canvas overlay separation for crosshair redraws. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Canvas warning for high-density unsupported workloads. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Canvas image export path aligned with on-screen pixels. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=confidential; Liability=engineering-review}

### Memory and Allocation Budget

- Per-chart memory budget calculator. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-series raw buffer size accounting. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-series LOD overhead accounting. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Render buffer pool accounting. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Worker heap high-water tracking. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- GPU resource high-water tracking where observable. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Object-pool policy for transient render structures. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No unbounded retained closures in interaction listeners. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Cleanup contract for chart unmount. [Both] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Memory leak benchmark after 1000 mixed zoom, pan, DataZoom, keyboard-style zoom, and touch range cycles. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Memory leak benchmark after 100 mount/unmount cycles. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Memory pressure degraded mode for live streams. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}

### Scheduler and Frame Budget

- RequestAnimationFrame render scheduler. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Coalesced redraw requests by chart ID. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Separate data-query generation from render-frame generation. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Priority scheduling for pointer interactions over background export. [Both] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Idle-time prefetch for likely zoom levels. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- Live-stream frame drop policy that preserves data. [Both] {Proof=checksum; Workflow=approve; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Backpressure signal when append exceeds render budget. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Main-thread long-task detection. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-frame budget breakdown diagnostics. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Frame budget CI threshold for benchmark app. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Interaction Performance

- Pointermove throttled to frame boundary. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Cursor overlay redraw without full chart redraw when data is unchanged. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Tooltip nearest lookup below 2 ms at 1M points. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Tooltip DOM update budget below 4 ms. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Zoom preview transform without worker round-trip. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Zoom commit worker query after gesture end or debounce. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Pan transform fast path while awaiting precise LOD query. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Shared range-navigation fast path for clamping, pixel panning, value panning, anchor zooming, center zooming, and range equality checks. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- 1000-cycle mixed interaction range benchmark below 2 ms with no measured heap growth above 2 MB. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Sync event payload minimized to range, cursor, source, and generation. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Sync broadcast loop prevention by source chart ID. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Multi-chart cursor propagation below one frame. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Four-panel cursor propagation benchmark below 1 ms per 1000 cursor events with nearest timestamp and quality payload reads. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Live-append interaction continuity gate that appends through `DataSource`, confirms live-edge range movement, then wheel-zooms through the mounted React interaction layer. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### TimeSeries Performance Surface

- Single shared x-axis transform for all pens in a time-aligned chart. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-series y-axis transform cached by axis binding. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Multi-axis chart support without duplicating x-coordinate buffers. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Hidden-series skip before LOD query when possible. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Hidden-series skip before GPU upload. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Legend toggle redraw under one frame for already-loaded series. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Series color/style update without data re-query. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Gap rendering without per-gap draw calls where intervals can be batched. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Alarm band redraw independent from line buffer upload. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Envelope band render path sharing x-coordinate buffers with base series. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Minimap generated from lower-resolution track, not main visible buffer. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- High-frequency pen and slow-frequency pen coexist without forcing common dense grid. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### DigitalChannel Performance Surface

- State transition compaction before render. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Long constant-state interval represented as two visible vertices. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Dense transition mode with label suppression threshold. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- State label cache keyed by state value and token generation. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Digital lane virtualization for 32+ channels. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-lane hit testing without scanning every transition. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Channel grouping collapse without data re-query. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Event pulse rendering path for impulse-style digital signals. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Dense Dashboard Performance Surface

- Chart instance budget per dashboard profile. [Both] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Shared worker pool option for many small charts. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Shared WebGPU device policy across chart instances. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Offscreen or paused chart policy when chart is outside viewport. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Reduced refresh rate policy for background tabs. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Multi-chart sync throttle under dashboard stress. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Shared tooltip portal to avoid per-chart overlay churn. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Dashboard-level performance warning when aggregate budget is exceeded. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Progressive chart hydration for route load. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Route-level bundle splitting for non-v1 chart packs. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Bundle and Startup Performance

- Core renderer bundle split from React primitives. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- WebGPU backend lazy import. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Canvas2D backend lazy import. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Post-v1 chart packs lazy import by subpath. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Worker script bundle size budget. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- First chart initialization benchmark. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Renderer capability detection below 10 ms after canvas mount. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- No side effects at module top level beyond constants. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Tree-shake check for importing only `DataEngine`. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Tree-shake check for importing only React primitives. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Browser Matrix and Hardware Classes

- Chrome WebGPU performance lane. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Chrome Canvas2D interaction FPS lane driven by requestAnimationFrame wheel zoom events. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Playwright cross-browser render smoke for Chromium, Firefox, WebKit/Safari runtime, and Microsoft Edge with nonblank canvas pixel gates. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Edge WebGPU performance lane. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Firefox Canvas2D fallback lane until WebGPU profile is production-ready. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Safari Canvas2D fallback lane until WebGPU profile is production-ready. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Integrated-GPU workstation profile. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Discrete-GPU workstation profile. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Low-memory laptop degraded profile. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Thin-client control-room degraded profile. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Browser capability report attached to benchmark output. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- WebGPU FPS benchmark capability skip when `navigator.gpu` is unavailable. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Unsupported browser production block for high-density profiles. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Performance Observability

- Public `ChartStats` frame time. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Public `ChartStats` point count. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Public `ChartStats` renderer type. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Public `ChartStats` LOD level. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Public `ChartStats` worker queue depth. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Optional development performance HUD. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Benchmark JSON schema versioning. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Benchmark baseline drift report. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Per-scenario pass, warn, fail status. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- CI artifact retention for benchmark reports. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Degraded Mode and Load Shedding

- Visible high-density warning when target cannot be met. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Renderer downgrade warning. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Automatic LOD aggressiveness increase under frame pressure. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=operational}
- Live stream render skip while preserving append data. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Optional pause live-edge updates under user zoom. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Disable nonessential animations under pressure. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=operational}
- Hide nonessential labels under pressure with visible compact-mode state. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=operational}
- Preserve quality/gap labels even when decorative labels are suppressed. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- User-controlled performance profile: quality, balanced, max-performance. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Profile-specific benchmark acceptance. [Both] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

## Whole-PITANT Composition Model

`pitant-charts` is Layer 6 UX infrastructure in the Plant-Physics OS. It
renders and packages chart primitives. It does not own plant data, domain
calculation, identity, deployment, or compliance record authority.

### Composition Rules

- `pitant-contracts` defines shared chart data windows before sibling apps
  depend on them. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `pitant-historian` owns raw, aggregate, replay, and evidence query semantics.
  [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- UX apps do not bypass contracts by constructing chart-private historian
  payloads. [Both] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=operational}
- Every cross-repo chart workflow preserves tenant, site, zone, asset, trace,
  quality, and provenance context when provided. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Degraded data states remain visible across all sibling handoffs.
  [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Chart exports that support regulated workflows carry a replay spec and
  evidence labels. [Both] {Proof=signed; Workflow=approve; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Chart interactions cannot create control writes. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=autonomous-disabled; Privacy=telemetry-only; Liability=informational}
- Renderer fallback cannot change data semantics. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

### Known Module Support Matrix

| Module | How it supports `pitant-charts` | How `pitant-charts` supports it |
|---|---|---|
| `pitant-contracts` | Defines shared chart payloads and quality codes | Provides package API requirements and fixtures |
| `pitant-deploy` | Hosts docs and package deployment profiles | Provides bundle, CSP, and browser capability requirements |
| `pitant-identity` | Supplies auth, role, tenant, and actor context | Preserves context in view/export metadata |
| `pitant-tenancy` | Defines tenant/site boundaries | Keeps sync groups and exports scoped |
| `pitant-fieldlink` | Supplies edge quality and source diagnostics | Visualizes source health and communication gaps |
| `pitant-gateway` | Routes edge data to apps | Receives chart budget and payload-size constraints |
| `pitant-streams` | Streams live samples and event windows | Provides live append surfaces |
| `pitant-core` | Provides common domain IDs and trace context | Uses IDs without redefining them |
| `pitant-historian` | Supplies trends, replay, aggregates, evidence | Renders historian daily workflows |
| `pitant-sentinel` | Supplies anomaly scores and detector evidence | Renders anomaly tracks and detector heatmaps |
| `pitant-design-system` | Supplies tokens and UI conventions | Consumes tokens and validates chart-specific primitives |
| `pitant-web` | Owns web routes, saved views, app state | Provides chart screens and components |
| `pitant-client` | Owns desktop/offline shell | Provides offline chart surfaces |
| `pitant-hmi-sdk` | Owns operator HMI boundary | Provides display-only HMI trend components |
| `pitant-mobile` | Owns mobile shell | Provides constrained chart views |
| `pitant-directus` | May host docs/admin content | Embeds chart previews if needed |
| `pitant-copilot` | Supplies cited investigation prompts | Renders cited answer evidence windows |
| `pitant-alarm-mgmt` | Supplies alarm states and acknowledgements | Renders alarm bands and event overlays |
| `pitant-notifications` | Supplies alert context | Renders notification-linked windows |
| `pitant-cmms` | Supplies maintenance events | Renders maintenance overlays |
| `pitant-eam` | Supplies asset and calibration context | Renders calibration/event markers |
| `pitant-reliability` | Supplies failure and health analytics | Renders reliability overlays |
| `pitant-oee` | Supplies OEE buckets and losses | Renders OEE KPI charts |
| `pitant-spc` | Supplies SPC rules and limits | Renders control charts and capability histograms |
| `pitant-batch` | Supplies batch events and profiles | Renders batch profile and golden-batch comparison |
| `pitant-energy` | Supplies energy metrics | Renders demand, peak, and waterfall charts |
| `pitant-environmental` | Supplies permit and excursion data | Renders environmental excursions |
| `pitant-compliance` | Supplies regulated evidence requirements | Receives replayable chart export artifacts |
| `pitant-audit` | Supplies audit chain and verification | Receives chart export events |
| `pitant-catalog` | Supplies asset/catalog metadata | Renders metadata-aware labels |
| `pitant-lake` | Supplies cold analytics datasets | Renders data science and lake query outputs |
| `pitant-training` | Supplies guided operator workflows | Provides training chart fixtures |
| `pitant-model-registry` | Supplies model versions and inference metadata | Renders model score overlays |
| `pitant-fleet` | Supplies cross-site summary data | Renders federated summary charts |
| `pitant-integrations` | Supplies third-party adapter metadata | Renders migration and adapter comparison views |
| `pitant-sis-observer` | Supplies observation-only SIS evidence | Renders safety observer timelines without writes |
| `pitant-control-bridge` | Owns any approved command boundary | Charts remain display-only inputs |
| `pitant-simulation` | Supplies simulated plant traces | Renders simulator and replay views |
| `pitant-autonomy` | Supplies advisory state, never chart-owned actions | Renders supervised recommendations with warnings |
| `pitant-marketplace` | Packages chart packs | Provides package metadata and examples |

### Remaining Integration Slots

- `pitant-visual-regression`: owns screenshot baselines and pixel diff gates.
  [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- `pitant-render-farm`: owns server-side certified rendering if required later.
  [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- `pitant-chart-lab`: owns experimental chart pack prototypes.
  [Both] {Proof=unsigned; Workflow=inspect; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=informational}

### Cross-Repo Capability Flywheels

The historian flywheel starts in `pitant-fieldlink`, flows through
`pitant-streams` into `pitant-historian`, and lands in `pitant-charts` through
`pitant-web`. Better chart fixtures reveal missing historian quality metadata,
which tightens contracts and improves the next fieldlink payload.

The compliance flywheel starts in `pitant-historian` evidence windows, flows
through `pitant-charts` replayable exports, and ends in `pitant-compliance` and
`pitant-audit`. Each export gap produces a stricter fixture and a clearer mode
vector.

The AI investigation flywheel starts in `pitant-sentinel` and
`pitant-model-registry`, uses `pitant-copilot` for cited explanations, and uses
`pitant-charts` to show the evidence window behind the answer. Unsupported
answers are rejected when the chart cannot reproduce the cited window.

The migration flywheel compares incumbent trend windows through
`pitant-integrations`, stores replacement evidence in `pitant-historian`, and
uses `pitant-charts` to show side-by-side visual equivalence and drift.

## Beyond-Competition Future Surface

### Semantic Plant Memory Graph

- Time-bound chart annotations attach to asset graph nodes. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Chart selections become reusable investigation memory. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Historical chart views resolve against asset names as-of the event time. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Quality explanations link to source diagnostics. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=operational}
- Chart evidence windows become copilot citations. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}

### Temporal Digital Twin Backbone

- Replayable chart views show current vs counterfactual traces. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Simulation overlays are visually separated from observed data. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=informational}
- Twin residual tracks render model-data mismatch. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Model version labels appear on every inferred series. [Frontend] {Proof=signed; Workflow=observe; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Counterfactual exports carry disabled-by-default labels. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=supervised; Privacy=confidential; Liability=engineering-review}

### Cyber-Physical Forensics

- Black-box timeline renders power, network, source, alarm, and operator lanes. [Both] {Proof=threshold-signed; Workflow=regulator-review; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Screenshot-equivalent exports include replay spec and data hashes. [Both] {Proof=signed; Workflow=approve; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Forensic chart mode disables decorative simplification. [Frontend] {Proof=signed; Workflow=inspect; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Evidence gaps are shown as first-class lanes. [Frontend] {Proof=signed; Workflow=inspect; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Notarized chart export manifests are supported. [Backend/Compute] {Proof=externally-notarized; Workflow=regulator-review; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}

## Premium Moat Feature Families

### Truthful Trend Workbench

- Multi-pen historian trend with independent axes. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- Gap-visible trend lane. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Quality-coded point and interval rendering. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Compare-to-past overlay with DST-safe alignment. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Persistent data tips with reviewer notes. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Ruler and measurement cursor with delta, slope, min, max, mean, RMS. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- View replay spec export. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}

### Industrial Analysis Packs

- Spectrogram chart with shared time axis. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- Power spectrum chart with peak labels. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- Control chart with rule violation markers. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=quality-impacting}
- Capability histogram with Cp/Cpk overlays. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=quality-impacting}
- Batch profile with golden-batch envelope. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Anomaly timeline with detector lanes. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}

## Futuristic First-Owner Features

- Self-proving chart artifact that verifies data, view state, renderer version, and token set. [Both] {Proof=externally-notarized; Workflow=regulator-review; Sovereignty=jurisdiction-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Multimodal plant memory canvas with trends, images, video, logs, and event evidence. [Frontend] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Counterfactual plant twin visual diff. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=supervised; Privacy=confidential; Liability=engineering-review}
- Human capability twin overlays for training and operator support. [Frontend] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=operator-linked; Liability=operational}
- Control-safe advisory visualization market with no chart-owned action path. [Frontend] {Proof=threshold-signed; Workflow=approve; Sovereignty=jurisdiction-bound; Autonomy=supervised; Privacy=confidential; Liability=safety-supporting}

## Ingest Inventory

- Columnar typed-array ingestion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- BigInt timestamp ingestion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Float64 value ingestion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Optional quality flag ingestion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- ArrayBuffer transfer ingestion. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Historian trend-window adapter. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Historian query-response to TimeSeries columnar adapter. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- Historian frontend trend fixture to TimeSeries columnar adapter. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- Historian quality-class to compact chart quality-code mapping. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- SPC result adapter. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=quality-impacting}
- OEE bucket adapter. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- Batch profile adapter. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Anomaly score adapter. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Fixture data ingestion. [Backend/Compute] {Proof=unsigned; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Streaming append ingestion. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}

## Normalize Inventory

- Quality code preservation for good, uncertain, bad, stale, substituted, manual, calculated, corrected, interpolated, clipped, saturated, out-of-service, and communication-failed. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Gap detection and gap rendering policy. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Unit label and engineering-unit formatter. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Timestamp formatter for UTC, local, site-local, and relative time. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Linear, log, categorical-state, and percent axes. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Provenance label rendering. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Data correction label rendering. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Forecast vs observed separation. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Alarm threshold normalization. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- Confidence band normalization. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}

## Transform Inventory

- Min-max LOD pyramid build. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Viewport query by time range and pixel width. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Incremental append propagation. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Ring-buffer eviction policy. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Step-line transform for digital channels. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Envelope polygon generation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- Histogram bin generation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- Spectrogram tile generation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}
- Nearest-point lookup index. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Selection-range aggregate computation. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=assisted; Privacy=telemetry-only; Liability=engineering-review}

## Layout Inventory

- Plot area layout. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Left, right, top, and bottom axis layout. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Grid line layout. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Formatted x-axis and y-axis tick label layout. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Axis title layout for TimeSeries and DigitalChannel views. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Screen-space text placement independent from data-space transforms. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Multi-panel shared-axis layout. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Overlay lane layout for annotations and anomalies. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}
- Legend reservation and collision avoidance. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Tooltip placement with viewport collision handling. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- High-DPI resize layout. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}

## Render Inventory

- WebGPU line renderer. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Canvas2D line renderer. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Auto renderer selection. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Anti-aliased line rendering. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Fill region rendering. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Rectangle and band rendering. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Text rendering. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Canvas2D screen-space text reset for axis labels. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- WebGPU Canvas2D text overlay for tick labels and axis titles. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Clipping and z-layer ordering. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Degraded renderer warning. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Renderer diagnostics panel. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

## Interact Inventory

- Pointer coordinate mapping between browser client pixels, chart pixels, plot ratios, relative x values, absolute x values, and y values. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Plot-boundary detection for pointer interactions. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Optional pointer clamping to nearest plot edge for axis scrubbing and bounded cursor reads. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Data-to-chart reverse mapping for cursor, annotation, and tooltip placement. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Region zoom. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Plot-bounded region zoom overlay with drag threshold and visual selection band. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Double-click full-range reset for interactive chart components. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Axis-constrained x-range zoom for plot and x-axis gestures. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Core x-window clamping helper that preserves span when panning near source bounds. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Core pixel-to-range pan helper shared by wheel, Alt-drag, touch drag, DataZoom, and benchmarks. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Core anchor and center zoom helpers with minimum-span and full-range clamping. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Core range equality helper for avoiding redundant range propagation and render work. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Cursor-anchored wheel and trackpad zoom with pixel, line, and page delta normalization. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Wheel zoom full-range clamping so zoom-out cannot exceed source data bounds. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- DOM-overlay hover crosshair that moves without renderer redraw. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Binary-search nearest timestamp lookup for cursor and tooltip payloads. [Backend/Compute] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Multi-series TimeSeries tooltip payload with visible-series filtering. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- DigitalChannel tooltip payload with state-label formatting. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Tooltip quality, gap, and provenance metadata display for degraded historian reads. [Both] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- Coded provenance columns for dense tooltip evidence without per-sample string objects in the source payload. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Pan and scroll navigation. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Horizontal wheel and shifted-scroll x-range panning with full-range clamping. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Alt-drag x-range panning that does not draw a region-selection band. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Keyboard navigation. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Keyboard pan keys: ArrowLeft, ArrowRight, Shift+ArrowLeft, Shift+ArrowRight, PageUp, PageDown. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Keyboard zoom and reset keys: ArrowUp, ArrowDown, +, -, Home, End, 0, Escape. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Touch and pinch navigation. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- One-finger touch drag x-range panning without region-selection overlay. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Two-finger pinch x-range zoom with full-range and minimum-span clamping. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Touch gestures publish through the same x-range callback used by wheel, keyboard, DataZoom, and sync. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Hover crosshair. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Snap-to-nearest tooltip. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Persistent data tip. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Brush selection. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- DataZoom minimap. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `ChartDataZoom` opt-in React primitive exported from `@pitant/charts-react`. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Fixed-sample minimap path generation capped by `maxSampleCount` to avoid full-series DOM/SVG work on every render. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- DataZoom track click recentering while preserving current x-window span. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- DataZoom window drag panning through the same x-range callback used by zoom, pan, keyboard, and sync. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- DataZoom start/end handle resizing with full-range and minimum-span clamping. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Undo and redo zoom stack. [Frontend] {Proof=unsigned; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}

### Interact Use Boundaries

| Interaction | Use when | Do not use when |
|---|---|---|
| Region zoom | The user deliberately brackets a time window in the plot to inspect analog or digital history at higher resolution. | The gesture starts outside the plot, is below the drag threshold, or should select records/annotations instead of changing viewport range. |
| Double-click full-range reset | The user needs to return to the source data window after exploratory zooming. | The chart is pinned to a regulatory evidence window, replay checkpoint, or externally owned viewport that must not be reset locally. |
| Axis-constrained x-range zoom | The interaction changes visible time/range only while leaving y-scale, lane layout, and source data unchanged. | The workflow needs y-axis rescale, data decimation changes, process action, acknowledgement, or saved-view mutation. |
| Core range-navigation helpers | React gestures, core consumers, or benchmarks need deterministic range math without allocating DOM or renderer objects. | The behavior depends on visible overlay state, data fetch policy, sync authorization, or workflow approval beyond pure range math. |
| Wheel and trackpad zoom | The pointer is inside the plot or x-axis area and the user expects cursor-anchored range magnification. | The wheel event belongs to page scroll, sidebar scroll, y-axis scaling, pinch gesture ownership, or an app-level navigation container. |
| Pan and scroll navigation | The user moves an already selected time window without changing its span; use horizontal wheel, shifted scroll, or Alt-drag inside the plot. | The source query window, replay checkpoint, evidence custody boundary, page scroll container, or app-level navigator owns the movement. |
| Keyboard navigation | The chart overlay has focus and the user needs accessible range movement, zoom, alignment, or reset without pointer input. | Keystrokes belong to text entry, global app shortcuts, workflow approval commands, or a locked display profile. |
| Touch and pinch navigation | The chart is used on a tablet or touch panel where pointer drag/wheel is unavailable; use one finger to pan and two fingers to pinch the x-range. | The panel is a locked operator display, HMI action surface, safety-relevant control screen, or a workflow where touch gestures are owned by the app shell. |
| Hover crosshair | The user is inspecting values without committing a selection or annotation. | Hover is unavailable, the chart is in touch-only mode, or the displayed result needs a persisted evidence artifact. |
| Snap-to-nearest tooltip | The user needs exact visible-point values, quality, gaps, provenance, and lane state. | The nearest point is outside the current viewport, hidden by pen visibility, or must be calculated by a sibling analytics repo. |
| Persistent data tip | The user explicitly pins a value or comparison for review, export, or discussion. | The user is only hovering, the feature lacks identity/audit context, or the note belongs in CAPA/compliance workflow. |
| Brush selection | The user needs a temporary subset for export, compare, or annotation preparation. | The brush would imply deleting data, changing historian state, or approving an operational workflow. |
| DataZoom minimap | The user needs opt-in overview-plus-detail navigation over a large source window; use it when the fixed-sample overview is enough to orient the current viewport. | The source range is tiny, the minimap would violate frame budget, a high-fidelity overview needs its own LOD track, or the dashboard already owns a shared navigator. |
| Undo and redo zoom stack | The user needs local navigation recovery during exploratory analysis. | The range is externally synchronized, evidence-pinned, or controlled by replay state from another repo. |

## Compose Inventory

- `ChartContainer` primitive. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- `ChartCanvas` primitive. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- `ChartLegend` primitive. [Frontend] {Proof=unsigned; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `ChartTooltip` primitive. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `ChartSyncGroup` primitive. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `useChart()` lifecycle hook. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `useTimeSeries()` hook. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- `TimeSeries` component. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}
- `TimeSeriesChart` imperative core class for non-React consumers. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `DigitalChannelChart` imperative core class for non-React consumers. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- `DigitalChannel` component. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Accessible data table fallback. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- React time-series composition example with legend and tooltip slot. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- React digital-channel composition example with state lanes and legend slot. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Core imperative chart example for non-React consumers. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}

## Synchronize Inventory

- Cursor timestamp synchronization. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- X-range synchronization. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Zoom synchronization. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Stable `chartKey` participation for TimeSeries and DigitalChannel sync groups. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Source-suppressed x-range propagation to prevent feedback loops between peers. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Source-suppressed cursor tooltip propagation with nearest timestamp payload rebuild on peers. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Cursor propagation latency gate for four synchronized panels and four pens per panel. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Synchronized vertical cursor marker for peer charts without local horizontal crosshair fabrication. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Series visibility synchronization. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Sync conflict resolution. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Tenant/site sync boundary. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Replayable sync state. [Both] {Proof=signed; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Synchronized dashboard example with explicit Phase 4 interaction boundary. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=informational}

### Synchronize Use / Do Not Use Rules

| Feature | Use when | Do not use when |
|---|---|---|
| Cursor timestamp synchronization | Peer charts share a time base and a cursor timestamp should select comparable samples. | Peer panels use unrelated clocks, categorical x-axes, replay-pinned evidence windows, or hidden tenant/site scopes. |
| X-range synchronization | A dashboard should keep every participating chart on the same time window during zoom and reset. | A chart owns an independent analysis window, an evidence-pinned range, or a workflow-level navigator already controls the range. |
| Stable `chartKey` participation | A chart must publish sync updates and ignore its own echoed updates inside one `ChartSyncGroup`. | The chart is transient, duplicated without a stable identity, or intentionally read-only inside a static export. |
| Peer cursor marker | A peer chart should show the synchronized timestamp without inventing a local pointer y-position. | The user needs exact local y inspection; require a local hover or keyboard cursor movement instead. |
| Series visibility synchronization | Shared dashboards need one legend or saved view to hide the same logical series across panels. | Panels compare different assets, units, or semantic lanes where matching names do not imply matching signals. |
| Tenant/site sync boundary | All participating panels are inside one declared tenant, site, zone, and evidence scope. | Any chart crosses a tenancy, sovereignty, legal-hold, or evidence boundary without explicit workflow approval. |

## Theme Inventory

- CSS variable token map. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Light theme. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Dark theme. [Frontend] {Proof=unsigned; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- High-contrast theme. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Reduced-motion behavior. [Frontend] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Series palette resolver. [Both] {Proof=checksum; Workflow=observe; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Quality color mapping. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Alarm severity color mapping. [Both] {Proof=signed; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}

## Export Inventory

- PNG export. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- SVG export. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- PDF export. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Replay spec export. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Data slice manifest export. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Export degraded-data warning labels. [Frontend] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}
- Export checksum. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Export signature handoff. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=regulated-sensitive; Liability=regulated-record}

## Benchmark Inventory

- LOD pyramid build benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- LOD query benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Streaming append benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Memory overhead benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- WebGPU FPS benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Canvas2D fallback FPS benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `harness:fps` browser interaction frame-loop benchmark for Canvas2D and WebGPU-capable environments. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Browser FPS report fields: average FPS, minimum FPS, p95 frame time, maximum frame time, dropped frame count, sample count, and target FPS. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Browser visual regression baseline for compact and large chart profiles. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Browser render-harness `bands` profile for mounted React TimeSeries value-band and envelope-band rendering. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `harness:cross-browser` smoke verification for Chromium, Firefox, WebKit, and Microsoft Edge compact Canvas2D render output. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Visual baseline update command with explicit reviewer intent. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Interaction latency benchmark. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `018_interaction_range_1000_cycles` benchmark for 1000 mixed zoom, pan, DataZoom, keyboard-style zoom, and touch range updates. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Interaction heap-growth benchmark for 10000 range updates with a 2 MB gate. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `019_cursor_propagation_4panels` benchmark for source-suppressed cursor propagation, nearest timestamp lookup, per-pen value reads, and quality reads across synchronized panels. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `020_time_series_bands_8x1M` benchmark for eight high-density trend pens plus value and envelope bands in the core command-list path. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `021_time_series_derived_8x1M` benchmark for eight high-density trend pens plus eight derived moving-average/rate-of-change overlays before render-plan generation. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `022_time_series_annotations_8x1M` benchmark for eight high-density trend pens plus one thousand persistent x-line, y-line, x-range, y-range, and ruler overlays in the core command-list path. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `023_time_series_event_markers_8x1M` benchmark for eight high-density trend pens plus ten thousand sparse event markers with bounded opt-in labels in the core command-frame path. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- `025_time_series_spc_tracks_10k` benchmark for approved Xbar/R-style control limits, warning zones, center lines, and sparse Western Electric rule markers in the core command-frame path. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=quality-impacting}
- Export duration benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Bundle-size benchmark. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Strict local benchmark profile that owns release-candidate performance claims and baseline updates. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- CI hosted-runner benchmark profile that allows bounded scheduler variance while refusing baseline updates. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Fresh-checkout harness build gate that rebuilds package declarations before compiling the browser harness. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}

## Package Inventory

- Core npm package. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- React npm package. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- v1.0.0 SemVer package manifests for core and React packages. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- npm public/provenance publish metadata for both packages. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- npm publish dry-run evidence for both packages. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Phase 5 release-candidate evidence artifact that records package, registry, publish dry-run, and browser smoke commands. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- npm-safe React peer dependency on `@pitant/charts` without `workspace:*` in publish-facing dependency fields. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Package README files with install, use/do-not-use, typed-array data, PNG/SVG export, and registry block guidance. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Package changelog and license files included in npm tarballs. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Subpath exports. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Type declaration output. [Backend/Compute] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- shadcn registry blocks. [Frontend] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Initial registry items for TimeSeries, DigitalChannel, synchronized dashboard, and DataZoom with shadcn target placeholders. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Expanded registry items for streaming live-edge append, separated-unit multi-axis panels, PNG export command wiring, and dashboard overview. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=operational}
- Registry validation script for schema URL, item types, dependencies, targets, and referenced files. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Registry block typecheck gate against public `@pitant/charts-react` package types. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Real shadcn CLI smoke gate that builds registry item JSON, initializes a fresh Vite consumer, dry-runs public dependencies, installs all initial blocks through local package tarballs, imports them, typechecks, and bundles. [Backend/Compute] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Live docs app that imports registry block source directly and builds through Vite for all eight installable examples. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- First-run quick start for package install, token import, renderer fallback, typed-array data rules, and registry block selection. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Examples index with use/do-not-use guidance for each primitive. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Frontend contract packs for historian trend, digital channel, and synchronized dashboard. [Frontend] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=informational}
- Migration guide from SciChart. [Both] {Proof=checksum; Workflow=inspect; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Package provenance. [Backend/Compute] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=operational}

## Govern Inventory

- Maturity label per feature. [Both] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Profile gate metadata. [Both] {Proof=checksum; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- No-control-write proof. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=safety-supporting}
- Quality visibility review gate. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Renderer fallback claim boundary. [Both] {Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}
- Enterprise readiness scorecard. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}
- Claims-vs-evidence ledger. [Both] {Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=manual; Privacy=confidential; Liability=engineering-review}

## Family Use / Do Not Use Summary

This summary is the review shortcut. If a proposed PR cannot fit one of these
use cases, it probably belongs in a sibling repo or a later phase.

| Family | Use when | Do not use when |
|---|---|---|
| Ingest | A chart needs to accept, validate, normalize, or adapt incoming chart data. | The work fetches data from devices, historians, or databases; sibling repos own acquisition and query. |
| Normalize | The displayed value needs units, quality, gaps, provenance, time semantics, or degraded-state handling. | The change only changes visual styling and does not affect data meaning. |
| Transform | Data volume must be reduced, indexed, streamed, or reshaped before render. | The source service should calculate domain semantics such as SPC violations, OEE, or batch phases. |
| Layout | The chart must compute axes, panels, lanes, labels, grids, or collision behavior. | The work is app shell layout, navigation, routing, or dashboard persistence. |
| Render | Pixels, vector commands, GPU buffers, Canvas paths, text, fills, bands, or lines are produced. | The work is data fetch, business calculation, or app-level workflow state. |
| Interact | The user changes view state through pointer, wheel, keyboard, touch, cursor, brush, or selection. | The interaction implies process action, acknowledgement, setpoint change, or workflow approval outside chart scope. |
| Compose | React users need primitives, hooks, refs, accessibility, or DOM overlay composition. | A product screen, route, saved view, or app-specific workflow is being built. |
| Synchronize | Multiple chart instances share cursor, range, visibility, or replay state. | The charts cross tenant/site/evidence boundaries or compare unrelated contexts without explicit scope metadata. |
| Theme | Visual tokens, high contrast, quality colors, or renderer/DOM style consistency are involved. | The work belongs to the global design system and is not chart-specific. |
| Export | A chart view becomes PNG, SVG, PDF, replay spec, or evidence artifact. | The artifact is a regulated record package, signature workflow, or legal hold owned by compliance/audit repos. |
| Benchmark | A claim needs performance, size, memory, browser, or regression evidence. | The metric is domain correctness unrelated to chart rendering or interaction cost. |
| Package | Work changes npm exports, registry blocks, docs examples, migration notes, or release flow. | Deployment orchestration, hosting, or app shell packaging is being changed. |
| Govern | Work changes maturity labels, profile gates, claim boundaries, no-write proof, or evidence policy. | The policy belongs to identity, compliance, audit, or deploy repos and the chart only consumes its result. |
| Premium moat | The feature differentiates Pitant in high-value workflows while preserving v1 performance. | The line-chart performance contract is not yet closed or the feature has no benchmark/evidence path. |
| Future surface | The feature declares a long-range product direction or protects a design slot. | The feature is being enabled at runtime without contract, profile gate, fixture, and performance evidence. |

## First-Class Acceptance Statement

`pitant-charts` is feature-complete at its premium v1 target when a Pitant team
can use it as the daily industrial charting layer for historian trends, anomaly
review, and multi-panel investigation while SciChart and other incumbent
libraries become optional migration adapters rather than mandatory runtime
systems.
