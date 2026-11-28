# @pitant/charts-react

React 19 components for high-density PITANT industrial charts. Use this package
for PITANT web screens that need TimeSeries trends, digital state lanes,
synchronized dashboards, DataZoom, quality/gap/provenance tooltips, and
PNG/SVG export.

Use `@pitant/charts` directly only for non-React shells, adapter tests, or
render harnesses that own the canvas lifecycle.

## Install

```sh
bun add /path/to/pitant-charts/pitant-charts-1.1.0.tgz /path/to/pitant-charts/pitant-charts-react-1.1.0.tgz
```

Build and pack both archives from the same repository checkout. [Source installation](../../docs/getting-started.md#install-from-source)

Import PITANT chart tokens once in the app shell:

```ts
import '@pitant/charts/styles/tokens.css'
```

## TimeSeries

```tsx
import { useMemo } from 'react'
import { ChartLegend, TimeSeries } from '@pitant/charts-react'

export function PressureTrend() {
  const data = useMemo(
    () => ({
      timestamps: new Float64Array([0, 1_000, 2_000, 3_000]),
      columns: {
        pressure: new Float64Array([1.1, 1.4, 1.3, 1.8]),
        pressure_low: new Float64Array([1.0, 1.1, 1.1, 1.2]),
        pressure_high: new Float64Array([1.5, 1.6, 1.6, 1.7]),
      },
      quality: {
        pressure: new Uint8Array([0, 0, 1, 0]),
      },
      provenance: {
        pressure: 'pitant-historian:pressure',
      },
    }),
    [],
  )

  const config = useMemo(
    () => ({
      renderer: 'auto' as const,
      series: [{ key: 'pressure', label: 'Pressure', field: 'pressure' }],
      bands: [
        {
          kind: 'value-band' as const,
          key: 'high-warning',
          label: 'High warning',
          yStart: 1.7,
          yEnd: 2.0,
          fillRgba: [1, 0.1, 0.05, 0.12],
          lineRgba: [1, 0.1, 0.05, 0.65],
        },
        {
          kind: 'envelope' as const,
          key: 'model-envelope',
          lowerField: 'pressure_low',
          upperField: 'pressure_high',
          fillRgba: [0.1, 0.4, 1, 0.1],
        },
      ],
      annotations: [
        {
          kind: 'x-line' as const,
          key: 'batch-start',
          label: 'Batch start',
          x: 1_000,
          rgba: [0.1, 0.3, 0.9, 0.8],
        },
        {
          kind: 'ruler' as const,
          key: 'pressure-ramp',
          label: 'Ramp',
          xStart: 1_000,
          xEnd: 3_000,
          yStart: 1.4,
          yEnd: 1.8,
        },
      ],
      eventMarkers: [
        {
          key: 'batch-start',
          label: 'B42',
          x: 1_000,
          eventType: 'batch' as const,
          labelVisible: true,
        },
        {
          key: 'pressure-alarm',
          label: 'HI',
          x: 2_000,
          eventType: 'alarm' as const,
          placement: 'full-height' as const,
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value: number) => new Date(value).toLocaleTimeString(),
      },
      yAxis: { label: 'bar', paddingRatio: 0.08 },
    }),
    [],
  )

  return (
    <TimeSeries ariaLabel="Pressure trend" aspectRatio={16 / 9} config={config} data={data}>
      {(chart) => (
        <div style={{ position: 'absolute', left: 12, top: 8, pointerEvents: 'auto' }}>
          <ChartLegend items={[...chart.legendItems]} onToggle={(key) => chart.toggleSeries(key)} />
        </div>
      )}
    </TimeSeries>
  )
}
```

### Independent Y axes

Pass named axes in `config.yAxes` and bind each signal with `yAxisKey`. The
first axis is primary. Series without a key use that axis, and the existing
`yAxis` configuration supplies primary defaults. Each named axis can
auto-range independently or use an explicit range.

```tsx
import { TimeSeries, type TimeSeriesConfig } from '@pitant/charts-react'

const config: TimeSeriesConfig = {
  series: [
    { key: 'temperature', label: 'Temperature', field: 'temp', yAxisKey: 'temperature' },
    { key: 'pressure', label: 'Pressure', field: 'pressure', yAxisKey: 'pressure' },
  ],
  yAxes: [
    { key: 'temperature', label: '°C', formatValue: (value) => value.toFixed(1) },
    { key: 'pressure', side: 'right', label: 'bar', range: [0, 10] },
  ],
}

// Both fields use the same millisecond timestamp column.
const data = {
  timestamps: new Float64Array([0, 1_000, 2_000]),
  columns: {
    temp: new Float64Array([36.4, 36.8, 37.1]),
    pressure: new Float64Array([2.1, 3.5, 2.9]),
  },
}

export function TemperatureAndPressure() {
  return <TimeSeries ariaLabel="Temperature and pressure trend" config={config} data={data} />
}
```

Use the matching `yAxisKey` for derived series, value and envelope bands,
Y annotations, rulers, and SPC tracks. The axis formatter also applies to
tooltip values. PNG and SVG use the same axes as the live chart.

### Scales, marks, and asynchronous channels

- Set `xAxis.calendar` to `{ timeZone: 'Europe/Berlin' }` to place day and hour
  ticks in that zone using epoch-millisecond timestamps. Use `xAxis.scale` or
  the relevant Y axis's `scale` for linear, logarithmic, asinh, ordinal, or
  custom mappings. `tickCount`, `tickValues`, and `formatValue` refine each
  axis. A named Y axis can derive another unit's positions through `from`.
- Set `mark` on a series to `'line'`, `'area'`, `'bar'`, or `'point'`. Line
  interpolation also accepts `'spline'`. Per-series `baseline`, `fillRgba`,
  `dash`, `points`, and `spanGaps` customize supported marks. `points.style`
  and `barStyle` configure individual samples, including visibility. `path`
  replaces the default geometry with renderer-neutral draw commands.
- Use `config.stack.groups` with series keys when a group shares its time
  positions and Y axis. Set `percent: true` to show signed proportions.
- Supply per-field sorted `seriesTimestamps` for asynchronous channels.
  With no field-specific timestamps, a channel uses the shared `timestamps`
  column. `alignTimeSeriesColumns` from `@pitant/charts` can also build one
  sorted union with a `sampleKinds` mask, which preserves the distinction
  between alignment holes and explicit gaps.

### Inspection and rendering controls

`TimeSeries` accepts an `interaction` prop. Select `mode: 'x'`, `'y'`, or
`'xy'` under `interaction.selection`. Set `zoom: false` for an inspection
rectangle and read the result through `onSelectionChange`. Programmatic
`selectedRanges` use absolute X and primary Y data values. In the
`TimeSeries` render prop or with `useTimeSeries`, call
`chart.setSelection({ xRange: [start, end], yRange: [low, high] })` to show an
inspection rectangle without zooming. Omit an axis to span that direction.
Call `chart.setSelection(null)` to clear it. When `interaction.selectedRanges`
controls the rectangle, the caller updates it through `onSelectionChange`.

Set `hoverLock` for click-to-pin, `snapToSample` for nearest-sample snapping, or
`focusClosestSeries` to dim other traces near the cursor. Y zoom acts on the
primary value axis. Use `setVisibleYRange(null)` to restore its original range.

Set `config.orientation: 'rotated'` to show time from top to bottom and
values increasing left to right. Selection modes and crosshair options
still refer to the data axes. Drag along the vertical time axis to zoom,
use Up and Down to pan, and use Shift with the wheel to pan. The overview
slider follows the time axis when enabled.

A `TimeSeries` series or `DigitalChannel` channel can set `hoverIndex` to `'previous'`, `'next'`, `'exact'`, or a
callback. The callback receives that field's raw timestamps, values, quality
flags, sample kinds, and nearest index. Return a zero-based index, `undefined`
to keep the nearest sample, or `null` to leave the reading empty. The tooltip header
keeps the cursor timestamp and alternate readings expose their actual
`sampleTimestamp` for custom tooltip rendering.

`ChartSyncGroup` defaults to timestamps and X ranges. Supply
`cursor={{ x: 'relative', y: 'relative' }}` to synchronize fractional cursor
positions across different charts. Use `cursor.y: 'value'` or `sync={['yRange']}`
for charts that use matching primary Y units. Enable `'series'` for visibility
toggles or `'focus'` for the focused series. `mapSeriesKey` maps equivalent
channels that have different keys. `filters.publish` and `filters.receive` can
restrict each event. `DigitalChannel` shares X interaction and time and series
visibility synchronization while its lanes retain their state scale.

In `TimeSeries` and `DigitalChannel`, `tooltip` controls filtering, sorting,
the visible row limit, list, inline or table layout, and the custom renderer.
Standalone `ChartLegend` accepts the same display options for ordering entries
and a `renderValue` callback for live values or series summaries.

Set `pixelRatio` on a chart for a fixed interactive backing-store ratio.
Export options can request their own ratio. Add `config.plugins` to extend the
chart's command frame or run code around native drawing. Use `extendFrame` for
geometry that must appear in Canvas2D, WebGPU, and SVG.
A plugin can also implement `mount(context)` and return a cleanup function
for live renderer resources. React calls cleanup when the plugin is removed
or the renderer is disposed. Keep plugin objects stable to retain their
mounts across React renders. Frame export uses drawing hooks independently of
the live mount.

## Numeric heatmap

Use `Heatmap` for a Z value over an X/Y cell. Provide explicit grid edges
for nonuniform cells or a list of sparse rectangular cells. For a dense grid
the default value order is one row of X cells for each Y interval.

```tsx
import { Heatmap } from '@pitant/charts-react'

<Heatmap
  data={{
    xEdges: new Float64Array([0, 1, 4]),
    yEdges: new Float64Array([0, 2, 5]),
    values: new Float32Array([1, 2, NaN, 4]),
  }}
  config={{ xAxis: { label: 'Distance' }, yAxis: { label: 'Pressure' } }}
/>
```

For sparse input, use `data={{ cells: [{ xRange: [0, 1], yRange: [2, 5], value: 4 }] }}`.
The chart works with Canvas2D, WebGPU and PNG and SVG export.

## PNG And SVG Export

Concrete `TimeSeries` and `DigitalChannel` chart returns expose `exportImage`.
Use PNG for screenshots and support bundles. Use SVG when a vector chart is
needed and the workflow does not require signed evidence custody.

```tsx
async function downloadChart(chart: { exportImage: TimeSeriesExport }) {
  const png = await chart.exportImage('png', {
    width: 1280,
    height: 720,
    pixelRatio: 2,
    background: '#ffffff',
  })

  const svg = await chart.exportImage('svg', {
    width: 1280,
    height: 720,
    background: '#ffffff',
  })

  console.log(png.type, svg.type)
}

type TimeSeriesExport = (
  format: 'png' | 'svg',
  options?: {
    width?: number
    height?: number
    pixelRatio?: number
    background?: string
  },
) => Promise<Blob>
```

## Registry Blocks

The shadcn registry blocks are source-level starting points for PITANT apps.
They install into `@components/pitant/*` and depend on the public packages.

| Block | Use when | Do not use when |
|---|---|---|
| `pitant-time-series` | Continuous historian trends and analog values. | The signal is a discrete state lane. |
| `pitant-digital-channel` | Interlocks, permissives, modes, alarms, and binary states. | The signal needs numeric interpolation. |
| `pitant-synchronized-dashboard` | One workflow needs shared x-range and cursor state. | Panels cross tenant, site, evidence, or authorization boundaries. |
| `pitant-datazoom` | Users need overview-plus-detail navigation. | The chart is compact or live-window only. |
| `pitant-streaming-trend` | Live historian tails append typed-array chunks. | Backfills rewrite earlier timestamps or schema. |
| `pitant-multi-axis` | Signals with different units share one time axis and use independent Y axes. | The signals need separate time windows. |
| `pitant-export` | The workflow needs PNG export wiring. | Evidence-grade signed export is required. |
| `pitant-dashboard-overview` | One tenant/site/workflow needs dense trend and state overview. | The view mixes scopes that must stay separate. |

Release smoke coverage builds the registry, initializes a fresh Vite consumer,
installs every block, typechecks, and bundles the consumer.

## Use When

- The app is a React 19 PITANT surface.
- The chart data can be supplied as typed arrays.
- Quality, gap, provenance, tooltip, zoom, sync, and export behavior should be
  owned by the chart component.
- Alarm/value bands and model envelopes need to be rendered inside the same
  high-density TimeSeries command path as the base trend.
- Reviewed reference lines, region highlights, and rulers must render and
  export with the chart without becoming React DOM overlays.
- Sparse starts, stops, alarms, comments, batches, holds, corrections,
  maintenance events, and investigation pins must align to the trend time axis
  without becoming a dense event table.

## Do Not Use When

- The app cannot mount React components.
- A workflow needs direct PLC/DCS/SIS write authority.
- Overlay data is decorative, unverified, or dense enough to obscure the base
  trend.
- Notes are operational instructions, dense event timelines, or authoritative
  audit records that belong to an application workflow or sibling repo.
- Event state owns workflow lifecycle, acknowledgement, signatures, or
  genealogy that belongs to alarm, batch, audit, or compliance repos.
- The export must be a signed regulator record. Use future compliance/evidence
  handoff surfaces for that path.

## License

PITANT-owned code is available under MPL-2.0. [License](LICENSE) · [Source access](SOURCE.md)
