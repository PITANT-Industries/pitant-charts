# @pitant/charts-react

React 19 components for high-density PITANT industrial charts. Use this package
for PITANT web screens that need TimeSeries trends, digital state lanes,
synchronized dashboards, DataZoom, quality/gap/provenance tooltips, and
PNG/SVG export.

Use `@pitant/charts` directly only for non-React shells, adapter tests, or
render harnesses that own the canvas lifecycle.

## Install

```sh
bun add /path/to/pitant-charts/pitant-charts-1.0.0.tgz /path/to/pitant-charts/pitant-charts-react-1.0.0.tgz
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
| `pitant-multi-axis` | Different units need separated y-ranges. | A single-canvas dual-axis overlay is required. |
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
