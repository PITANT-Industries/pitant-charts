# Historian Trend Contract Pack

## Workflow

Historian trend. Primary actors are plant operators, process engineers,
reliability engineers, and PITANT application teams embedding the trend surface.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| React component | `TimeSeries` from `@pitant/charts-react` | Compose Inventory |
| React hook | `useTimeSeries()` from `@pitant/charts-react` | Compose Inventory |
| React config | `TimeSeriesConfig.derivedSeries[]` from `@pitant/charts-react` | Transform Inventory |
| React config | `TimeSeriesConfig.annotations[]` from `@pitant/charts-react` | Render Inventory |
| Core adapter | `historianQueryToTimeSeries()` from `@pitant/charts` | Ingest Inventory |
| Core transform | `addTimeSeriesDerivedColumns()` from `@pitant/charts` | Transform Inventory |
| Core chart class | `TimeSeriesChart` from `@pitant/charts` | Compose Inventory |

## Request Or Prop Shape

```ts
<TimeSeries
  ariaLabel="Area A reactor temperature trend"
  config={timeSeriesConfig}
  data={columnarData}
  streaming={{ liveEdge: true, windowSize: 15 * 60_000 }}
/>
```

Derived visual overlays use `config.derivedSeries[]` when the chart consumer
needs moving average, delta, rate-of-change, or scale/offset comparisons
rendered as ordinary series. They must not be used for source-of-record
calculations, SPC rules, OEE, model inference, corrections, regulatory evidence,
or any workflow where the calculated value belongs to a sibling repo.

```ts
const timeSeriesConfig = {
  series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
  derivedSeries: [
    {
      key: 'temp_ma_64',
      label: 'Temperature MA 64',
      kind: 'moving-average',
      sourceField: 'temp',
      windowSize: 64,
      minimumSamples: 16,
    },
    {
      key: 'temp_rate',
      label: 'Temperature rate',
      kind: 'rate-of-change',
      sourceField: 'temp',
      per: 1000,
    },
  ],
}
```

Persistent annotation overlays use `config.annotations[]` when the chart
consumer needs reviewed x/y reference lines, region highlights, rulers, or
investigation labels rendered through the same command-frame path as trends and
SVG export. They must not be used for dense event timelines, workflow
instructions, control actions, audit-record storage, or any free-form note that
has not passed the owning application review/custody workflow.

```ts
const timeSeriesConfig = {
  series: [{ key: 'temp', label: 'Temperature', field: 'temp' }],
  annotations: [
    { kind: 'x-line', key: 'batch-start', label: 'Batch start', x: 1_700_000_000_000 },
    { kind: 'y-line', key: 'setpoint', label: 'Setpoint', y: 72 },
    {
      kind: 'x-range',
      key: 'hold-window',
      label: 'Hold',
      xStart: 1_700_000_010_000,
      xEnd: 1_700_000_080_000,
      fillRgba: [1, 0.75, 0.1, 0.12],
    },
    {
      kind: 'ruler',
      key: 'ramp-rate',
      label: 'Ramp',
      xStart: 1_700_000_030_000,
      xEnd: 1_700_000_090_000,
      yStart: 65,
      yEnd: 80,
    },
  ],
}
```

## Success State Shape

- Canvas has nonblank trend pixels.
- Axis labels and tick labels are visible.
- Legend includes one item per configured visible series.
- Hovering inside the plot shows a crosshair and nearest-timestamp tooltip.
- Tooltip rows include visible series values plus quality, gap, and provenance
  metadata when supplied by the data adapter.
- Derived visual overlays appear in the legend, render plan, tooltip, SVG/PNG
  export path, and live append path as ordinary series with calculated quality
  metadata.
- Persistent annotations appear in the render plan, command frame, SVG/PNG
  export path, and label/text path without changing the raw series data.
- Horizontal wheel, shifted scroll, and Alt-drag move the current x-range
  without changing its span or exceeding the source data bounds.
- Focused chart navigation supports Arrow/Page panning, ArrowUp/ArrowDown and
  +/- zoom, Home/End alignment, and 0/Escape full-range reset.
- When `dataZoom` is enabled, the chart shows an opt-in fixed-sample minimap
  with track recentering, window drag panning, and handle resizing.
- On touch devices, one-finger drag pans the x-window and two-finger pinch zooms
  the x-range without drawing a region-selection overlay.
- `chart.stats.renderedPointCount` is greater than zero.
- `chart.error` is `null`.

## Fixtures

- Success: two continuous analog tags, good quality, no gaps, tooltip values
  for both visible tags, one moving-average overlay, one rate-of-change overlay,
  one x-line annotation, one y-line annotation, one region annotation, one
  ruler annotation, panned/keyboard navigation states, and opt-in
  DataZoom/touch interaction.
- Degraded: one uncertain segment, one explicit gap, one stale value, one
  provenance label such as `historian backfill`, one missing-source derived
  overlay rendered as calculated `NaN`, one hidden annotation, one out-of-range
  annotation warning, and tooltip metadata showing the degraded state.
- Denied: package consumer receives a 403 or app-level gate before chart props
  are constructed; chart package does not implement authorization.
- Validation-error: missing column for one series produces a render-plan warning
  and a visible app-level degraded state.

## State Machine

`loading -> ready -> streaming -> degraded -> ready`

`loading -> denied`

`loading -> validation-error`

`ready -> renderer-degraded -> ready`

## Profile Gating

Enabled for `workshop`, `plant`, `regulated`, `migration`, `enterprise`,
`ai_ready`, and `premium`. Future evidence/export behavior requires the export
or compliance pack before any regulated-record claim.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=confidential; Liability=operational}`

## Visual Regression Expectation

Browser harness must keep Canvas2D and WebGPU screenshots nonblank before this
workflow can claim production readiness.
