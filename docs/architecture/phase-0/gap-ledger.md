# Phase 0 Gap Ledger

This ledger started as the Phase 0 import gap list. It is now maintained as a
traceability record: closed gaps stay listed with their closing evidence, and
new gaps are added only when they block a phase gate or change product scope.

## Closed V1 Gaps

| Gap | Family | Initial severity | Closed by | Evidence |
|---|---|---:|---|---|
| No concrete TimeSeries chart | Render / Compose | High | Phase 3 | `TimeSeriesChart`, React `TimeSeries`, render-plan tests, docs examples |
| No DigitalChannel chart | Render / Compose | High | Phase 3 | `DigitalChannelChart`, React `DigitalChannel`, digital-channel tests, registry block |
| Generic `useChart().setData()` / `append()` ambiguity | Ingest / Transform | High | Phase 3 | Concrete hooks own ingestion; generic hook reports unsupported data controls explicitly |
| No chart layout engine | Layout | High | Phase 3 | `createChartLayout`, plot reservation, axis text geometry tests |
| No zoom/pan/crosshair/DataZoom | Interact | High | Phase 4 | `ChartRegionZoomLayer`, `ChartDataZoom`, range-navigation tests, interaction benchmarks |
| No browser render screenshots or FPS checks | Benchmark | High | Phase 1/3/5 | `harness:verify`, `harness:fps`, cross-browser CI matrix |
| No true SVG export | Export | Medium | Phase 5 | Command-frame SVG export tests and package docs |
| No shadcn registry blocks | Package | Medium | Phase 5 | Eight registry blocks, `registry:validate`, `registry:typecheck`, `registry:smoke` |
| No frontend contract packs beyond README | Compose / Govern | Medium | Phase 3-5 | Trend, digital-channel, and synchronized-dashboard contract packs |
| Publish workflow dry-run missing from external evidence | Package / Govern | Medium | Phase 5 | Publish workflow run `26090262210` on `main` passed release gate, registry smoke, and npm dry-run |

## Active Or Managed Gaps

| Gap | Family | Severity | Disposition |
|---|---|---:|---|
| Doc 06 is performance-depth but not full broad-catalog depth | Govern | Low | Managed; keep expanding non-v1 packs at Phase 6+ gates |
| Remaining post-v1 industrial chart packs need benchmark fixtures | Govern / Package | Medium | Alarm/envelope bands now have `020_time_series_bands_8x1M` plus browser harness `bands` coverage; SPC, scientific, correlation, KPI, and PDF packs still need concrete fixtures |
| PDF export remains future work | Export | Low | Phase 6 / v1.3 after SVG and PNG remain stable |

## Current Gate State

- Phase 5 local release candidate: closed.
- PR CI matrix: closed on
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26089906506.
- Main CI matrix after publish-workflow fix: closed on
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090260058.
- External publish dry-run: closed on
  https://github.com/PITANT-Industries/pitant-charts/actions/runs/26090262210.
