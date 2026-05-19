# Core Imperative Charts

Use `TimeSeriesChart` and `DigitalChannelChart` for non-React consumers:
migration shells, benchmark harnesses, embedded app surfaces, direct canvas
tests, and any adapter that already owns DOM lifecycle. Do not use these
classes from normal React screens unless React cannot own the canvas lifecycle.

The imperative classes are thin wrappers over the same render-plan functions
used by React. They do not introduce a second data engine, scheduler, or hidden
state model.

## TimeSeriesChart

```ts
import { TimeSeriesChart } from '@pitant/charts'

const chart = await TimeSeriesChart.create(canvas, {
  renderer: 'auto',
  data: {
    timestamps: new Float64Array([0, 1_000, 2_000, 3_000]),
    columns: {
      reactor_temp: new Float64Array([91.2, 91.4, 91.1, 91.8]),
    },
    series: [
      {
        key: 'reactor',
        label: 'Reactor temp',
        field: 'reactor_temp',
        lineWidth: 1.5,
      },
    ],
  },
  render: {
    gapThreshold: 90_000,
    yPaddingRatio: 0.08,
  },
})

chart.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio)
chart.setRenderOptions({ xRange: [1_000, 3_000], yPaddingRatio: 0.08 })
chart.dispose()
```

## DigitalChannelChart

```ts
import { DigitalChannelChart } from '@pitant/charts'

const chart = await DigitalChannelChart.create(canvas, {
  renderer: 'canvas2d',
  data: {
    timestamps: new Float64Array([0, 1_000, 2_000, 3_000]),
    columns: {
      permissive_ok: new Float64Array([1, 1, 0, 0]),
    },
    channels: [
      {
        key: 'permissive',
        label: 'Permissive',
        field: 'permissive_ok',
        stateLabels: { 0: 'Blocked', 1: 'OK' },
      },
    ],
  },
  render: {
    channelHeight: 24,
    channelGap: 8,
  },
})

chart.resize(960, 320, window.devicePixelRatio)
chart.setData(nextData)
chart.dispose()
```

## Context Ownership

`create()` owns the render context and disposes it when the chart is disposed.
The constructor does not own an injected context unless `ownsContext: true` is
passed.

```ts
import { TimeSeriesChart, createRenderContext } from '@pitant/charts'

const context = await createRenderContext(canvas, { renderer: 'auto' })
const chart = new TimeSeriesChart(context, {
  data,
  autoRender: false,
})

chart.render()
chart.dispose()
context.dispose()
```

