# Anomaly Review Contract Pack

## Workflow

Anomaly review overlays model or rule output onto high-density historian trends.
Primary actors are reliability engineers, process engineers, model reviewers,
and incident investigators.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| React component | `TimeSeries` from `@pitant/charts-react` | Compose Inventory |
| React config | `TimeSeriesConfig.bands[]` value bands | Phase 6 Chart Family Use / Do Not Use Catalog |
| React config | `TimeSeriesConfig.bands[]` envelope bands | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future overlay | `AnomalyScoreTrack` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future overlay | `AnnotationLayer` | Phase 6 Chart Family Use / Do Not Use Catalog |

## Request Or Prop Shape

```ts
<TimeSeries
  ariaLabel="Compressor vibration anomaly review"
  data={columnarData}
  config={{
    ...trendConfig,
    bands: [...alarmBands, ...envelopeBands],
  }}
/>
```

## Success State Shape

- Trend data remains the primary visual object.
- Alarm and envelope bands are clipped to the plot and never hide raw values.
- Anomaly score tracks remain future work and must render as bounded lanes with
  model version and threshold before pilot.
- Annotation markers remain future work and must show reviewer, timestamp,
  custody state, and visibility before pilot.
- Tooltip payload includes raw value, quality, gap, provenance, overlay source,
  model version, and reviewer state.

## Fixtures

- Success: `trend-alarm-band-8x1m` and `trend-envelope-band-1m` render through
  `020_time_series_bands_8x1M` without dropping below the accepted Phase 6
  benchmark budget, and through the render harness `bands` browser profile;
  `anomaly-score-track-4x1m` remains contract-only.
- Degraded: one overlay has stale limits, one anomaly score lacks confidence,
  and one annotation is pending review.
- Denied: user can read trend values but lacks `model.review` or
  `annotation.approve` permission.
- Validation-error: overlay time base does not match the trend time base and is
  rejected before render.

## State Machine

`loading -> ready -> overlay-degraded -> ready`

`loading -> denied`

`loading -> validation-error`

`ready -> annotation-review -> signed`

## Profile Gating

Enabled for `plant`, `regulated`, `enterprise`, `ai_ready`, and `premium`.
Hidden in `workshop` unless fixtures are local and model review is disabled.

## Mode Vector Summary

`{Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}`

## Use Boundary

Use this pack when overlays change interpretation of an existing trend. Do not
use it for autonomous control advice, unsupported model output, or dense event
timelines that need a separate event-table workflow.
