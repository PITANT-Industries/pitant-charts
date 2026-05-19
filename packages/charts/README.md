# @pitant/charts

High-density TypeScript chart core for PITANT industrial time-series. Use this
package when you own the canvas lifecycle, are building adapters, or need the
core data and render primitives without React.

Use `@pitant/charts-react` when the consumer is a React app. Do not use the
core package directly for ordinary PITANT web screens unless the screen already
owns canvas mounting, resize, accessibility, and interaction state.

## Install

```sh
bun add @pitant/charts
```

Import tokens once when the app uses PITANT chart CSS variables:

```ts
import '@pitant/charts/styles/tokens.css'
```

## Core Time-Series Plan

```ts
import {
  buildTimeSeriesCommandFrame,
  commandFrameToSvg,
  createRenderContext,
  TimeSeriesChart,
} from '@pitant/charts'

const timestamps = new Float64Array([0, 1_000, 2_000, 3_000])
const data = {
  timestamps,
  columns: {
    pressure: new Float64Array([1.1, 1.4, 1.3, 1.8]),
  },
  series: [
    {
      key: 'pressure',
      label: 'Pressure',
      field: 'pressure',
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

const frame = buildTimeSeriesCommandFrame(data, {
  width: 960,
  height: 540,
  renderOptions: { yPaddingRatio: 0.08 },
})

const svg = commandFrameToSvg(frame, {
  title: 'Pressure trend',
  background: '#ffffff',
})
```

## Data Rules

- Use `Float64Array` timestamps and one typed array per series.
- Convert row-shaped historian data once at the edge; do not pass row objects
  into the render loop.
- Preserve quality, gap, and provenance metadata before handoff to React
  surfaces so tooltips and evidence views do not invent lineage.
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
