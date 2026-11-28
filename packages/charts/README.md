# @pitant/charts

High-density TypeScript chart core for PITANT industrial time-series. Use this
package when you own the canvas lifecycle, are building adapters, or need the
core data and render primitives without React.

Use `@pitant/charts-react` when the consumer is a React app. Do not use the
core package directly for ordinary PITANT web screens unless the screen already
owns canvas mounting, resize, accessibility, and interaction state.

## Install

```sh
bun add /path/to/pitant-charts/pitant-charts-1.0.0.tgz
```

Build and pack the archive from the repository checkout. [Source installation](../../docs/getting-started.md#install-from-source)

Import tokens once when the app uses PITANT chart CSS variables:

```ts
import '@pitant/charts/styles/tokens.css'
```

## Core Time-Series Plan

```ts
import {
  buildTimeSeriesCommandFrame,
  buildTimeSeriesRenderPlan,
  commandFrameToSvg,
  createRenderContext,
  TimeSeriesChart,
} from '@pitant/charts'

const timestamps = new Float64Array([0, 1_000, 2_000, 3_000])
const data = {
  timestamps,
  columns: {
    pressure: new Float64Array([1.1, 1.4, 1.3, 1.8]),
    pressure_low: new Float64Array([1.0, 1.1, 1.1, 1.2]),
    pressure_high: new Float64Array([1.5, 1.6, 1.6, 1.7]),
  },
  series: [
    {
      key: 'pressure',
      label: 'Pressure',
      field: 'pressure',
    },
  ],
  bands: [
    {
      kind: 'value-band',
      key: 'trip',
      label: 'Trip range',
      yStart: 1.75,
      yEnd: 2.0,
      fillColor: [1, 0.1, 0.05, 0.12],
      lineColor: [1, 0.1, 0.05, 0.65],
    },
    {
      kind: 'envelope',
      key: 'model-envelope',
      lowerField: 'pressure_low',
      upperField: 'pressure_high',
      fillColor: [0.1, 0.4, 1, 0.1],
    },
  ],
  annotations: [
    {
      kind: 'x-line',
      key: 'batch-start',
      label: 'Batch start',
      x: timestamps[1]!,
      color: [0.1, 0.3, 0.9, 0.8],
    },
    {
      kind: 'ruler',
      key: 'pressure-ramp',
      label: 'Ramp',
      xStart: timestamps[1]!,
      xEnd: timestamps[3]!,
      yStart: 1.4,
      yEnd: 1.8,
    },
  ],
  eventMarkers: [
    {
      key: 'batch-start',
      label: 'B42',
      x: timestamps[1]!,
      eventType: 'batch',
      labelVisible: true,
    },
    {
      key: 'pressure-alarm',
      label: 'HI',
      x: timestamps[2]!,
      eventType: 'alarm',
      placement: 'full-height',
    },
  ],
}

const canvas = document.querySelector('canvas')!
const context = await createRenderContext(canvas, { renderer: 'auto' })
const chart = new TimeSeriesChart(context, { data })

chart.setRenderOptions({
  xRange: [timestamps[0]!, timestamps[timestamps.length - 1]!],
  yPaddingRatio: 0.08,
})

const plan = buildTimeSeriesRenderPlan(data, { yPaddingRatio: 0.08 })
const frame = buildTimeSeriesCommandFrame(plan, 960, 540)

const svg = commandFrameToSvg(frame, {
  title: 'Pressure trend',
  background: '#ffffff',
})
```

## Independent Y axes

Supply ordered named scales in the render options and bind channels with `yAxisKey`.
The first scale is primary. Channels and overlays without a key use that scale.

```ts
const trend = new TimeSeriesChart(context, {
  data: {
    timestamps,
    columns: { temperature, pressure },
    series: [
      { key: 'temperature', label: 'Temperature', field: 'temperature', yAxisKey: 'temperature' },
      { key: 'pressure', label: 'Pressure', field: 'pressure', yAxisKey: 'pressure' },
    ],
  },
  render: {
    yAxes: [
      { key: 'temperature', label: '°C' },
      { key: 'pressure', label: 'bar', side: 'right', range: [0, 16] },
    ],
  },
})
```

Each scale can define its own bounds, padding, tick count, formatter, and gutter.
A scale can also set its own label color and grid style. Grids normally follow
the primary scale. Set `grid: true` or provide a line style on a secondary scale
to draw its grid, or set `grid: false` on an axis to suppress that axis's grid.
A band, Y annotation, ruler, or SPC track can use the corresponding `yAxisKey`.
The command frame uses the same axis transformations for Canvas2D, WebGPU, and SVG.

## Batch updates and redraw

All native chart objects support `batch()`, `redraw()`, and `clearCache()`.
Use a synchronous batch to coalesce data, scale, frame and size changes into one
plan and paint. Methods called inside a batch return the previous plan until
the outer batch finishes. If the update callback throws, the queued chart
changes are discarded.

```ts
chart.batch((trend) => {
  trend.addSeries({ key: 'reference', label: 'Reference', field: 'pressure' })
  trend.updateSeries('reference', { visible: true })
  trend.addBand({ kind: 'value-band', key: 'safe', yStart: 1, yEnd: 2 })
  trend.setRenderOptions({ yRange: [0, 3] })
})

chart.redraw()
```

`redraw()` reuses the last prepared geometry when the canvas size and pixel
ratio match. It still runs native draw hooks. Call `render()` after modifying
input arrays in place, or call `clearCache()` to release the saved frame and
rebuild it on the next redraw. `TimeSeriesChart` also provides `removeSeries`,
`updateBand` and `removeBand` for key-based changes.

## Scale and frame customization

Cartesian frame layouts accept linear, logarithmic, asinh, ordinal and custom
invertible scales. Set `reverse: true` on a scale to reverse its direction.
For an industrial TimeSeries Y axis, set
`scale: { type: 'asinh', threshold: 'auto' }` to choose the smallest nonzero
absolute value among finite plotted samples visible on that axis. The automatic
threshold falls back to 1 when the window has no eligible samples. Omitted and
explicit numeric thresholds keep their fixed behavior. Use
`xAxis.side: 'top'` or `yAxis.side: 'right'` to change axis placement. The tick
configuration supports explicit values, CSS-pixel spacing, a formatter, and
soft or hard bounds through `rangePolicy`.

Set `layout.orientation: 'rotated'` to plot X downward and Y to the right.
The layout, pointer projections, marks and image exports use the same orientation.

Set `xAxis.calendar: { timeZone: 'Europe/Berlin' }` for calendar ticks on dated
millisecond data. For a layout using relative X values, set `xAxis.valueOffset`
to the render plan's `xOrigin`. A named secondary axis can use `from` to keep
a unit conversion aligned with an earlier source axis.

All eight imperative chart classes accept `frame.plugins`. Implement
`extendFrame(frame, plan)` to append render commands that appear in live charts
and exports. `beforeDraw` and `afterDraw` run inside the native rendering frame
for work that needs the rendering context.
Use `mount(context)` for live setup and return a function to release resources
when the plugin is removed or the chart is disposed.

### Style individual points and bars

Use `points.style(sample)` to change a marker’s color, diameter or shape.
On bar series, use `barStyle(sample)` to set color, an exact width in CSS
pixels or a fraction of neighboring sample spacing. Return `{ visible: false }`
to skip a mark while retaining its sample for the line and domain calculations.

```ts
const pressureBars = {
  key: 'pressure',
  label: 'Pressure',
  field: 'pressure',
  mark: 'bar',
  barStyle: ({ value }) => value > 1.7
    ? { color: [0.9, 0.15, 0.1, 1], widthRatio: 0.85 }
    : undefined,
} satisfies import('@pitant/charts').TimeSeriesSeries
```

Callbacks run for drawable input samples in the current render plan. A sample
carries its exact input timestamp and value, its index in the input arrays, and
its plotted value after stacking. Bar callbacks also receive their baseline.
Use the timestamp for identity across viewport queries. Style overrides share
the same geometry on Canvas2D, WebGPU and SVG.

Set a trend series' `dash` to alternating stroke and gap lengths in CSS pixels.
Dash lengths stay fixed when the axis range or device pixel ratio changes.

## Data Rules

- Use `Float64Array` timestamps and one typed array per series.
- Convert row-shaped historian data once at the edge; do not pass row objects
  into the render loop.
- Preserve quality, gap, and provenance metadata before handoff to React
  surfaces so tooltips and evidence views do not invent lineage.
- Use `bands` for alarm ranges, static limits, and model envelopes when the
  band changes interpretation of an existing trend. Do not use bands for dense
  event timelines or unsupported control advice.
- Use `annotations` for reviewed reference lines, region highlights, and
  rulers that must export with the chart. Do not use annotations for dense
  event history, control instructions, or audit-record storage.
- Use `eventMarkers` for sparse starts, stops, alarms, comments, batches,
  holds, corrections, maintenance events, and investigation pins aligned to a
  trend. Do not use event markers as a dense event table or as the workflow
  state owner.
- Prefer `renderer: 'auto'`; do not force WebGPU in production apps.

## Use When

- A non-React shell owns canvas creation and resize.
- A benchmark, adapter, or render harness needs deterministic chart plans.
- A service or build step needs SVG from command frames.
- A PITANT sibling repo needs typed-array validation or viewport queries.

## Do Not Use When

- The caller is a normal React screen. Use `@pitant/charts-react`.
- The workflow needs signed evidence packs, PDF export, or regulator custody.
  Those are future PITANT compliance surfaces.
- The data crosses tenant, site, or evidence boundaries without upstream scope
  checks.

## License

PITANT-owned code is available under MPL-2.0. [License](LICENSE) · [Source access](SOURCE.md)
