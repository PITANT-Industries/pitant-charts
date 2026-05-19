# PITANT Charts Quick Start

This is the first-run path for teams replacing SciChart inside PITANT web
surfaces. Use it when the consumer is a React app and can accept typed-array
inputs. Use the core package directly only for non-React shells, migration
adapters, or test harnesses that own the canvas lifecycle.

## Install

```sh
bun add @pitant/charts @pitant/charts-react
```

Import PITANT chart tokens once in the application shell:

```ts
import '@pitant/charts/styles/tokens.css'
```

Use `renderer="auto"` unless a diagnostic, screenshot, or known GPU-denied
environment requires `canvas2d`. Do not force WebGPU in production apps; the
library owns renderer fallback.

## First Chart

```tsx
import { useMemo } from 'react'
import { ChartLegend, TimeSeries } from '@pitant/charts-react'

export function FirstTrend() {
  const data = useMemo(
    () => ({
      timestamps: new Float64Array([0, 1_000, 2_000, 3_000]),
      columns: {
        temperature: new Float64Array([91.1, 91.4, 91.2, 91.8]),
      },
      provenance: {
        temperature: 'live adapter',
      },
    }),
    [],
  )

  const config = useMemo(
    () => ({
      series: [
        {
          key: 'temperature',
          label: 'Temperature',
          field: 'temperature',
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value: number) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'degC',
        paddingRatio: 0.08,
      },
      renderer: 'auto' as const,
    }),
    [],
  )

  return (
    <TimeSeries ariaLabel="Temperature trend" aspectRatio={16 / 9} config={config} data={data}>
      {(chart) => (
        <div style={{ position: 'absolute', left: 12, top: 8, pointerEvents: 'auto' }}>
          <ChartLegend items={[...chart.legendItems]} onToggle={(key) => chart.toggleSeries(key)} />
        </div>
      )}
    </TimeSeries>
  )
}
```

## Data Rules

- Use `Float64Array` timestamps and one typed array per series or channel.
- Keep quality flags in `Uint8Array` columns keyed by field name.
- Keep provenance in the data object so tooltips, reports, and evidence views
  do not invent lineage later.
- Memoize `data` and `config` in React. Recreating them every render tells the
  chart it may need to rebuild its plan.
- Use `append()` for live tails. Do not replace the entire dataset for every
  historian tick.
- Do not pass row objects into the render path. Convert once at the edge.

## Registry Blocks

The shadcn registry is the fastest path for app teams that want a working
composition. Blocks install into `@components/pitant/*` and still depend on the
public packages.

| Block | Use When | Do Not Use When |
|---|---|---|
| `pitant-time-series` | Continuous historian trends, analog process values, quality/gap/provenance inspection. | The data is a discrete state lane or the shell is not React. |
| `pitant-digital-channel` | Interlocks, permissives, modes, alarms, binary states, and equipment lanes. | The signal needs analog interpolation or a numeric y-axis. |
| `pitant-synchronized-dashboard` | One workflow needs shared x-range and cursor state across chart panels. | Panels cross tenant, site, evidence, or authorization boundaries. |
| `pitant-datazoom` | Users need overview-plus-detail navigation over a large time window. | The chart is compact or already constrained to a narrow live window. |
| `pitant-streaming-trend` | A live historian tail appends new typed-array chunks at the right edge. | A backfill rewrites earlier timestamps or changes the schema. |
| `pitant-multi-axis` | Signals with different units need synchronized x-ranges and separate y-ranges. | A single-canvas dual-axis overlay is a hard requirement. |
| `pitant-export` | A user needs PNG screenshots for reports, tickets, or support bundles. | The workflow requires evidence-grade SVG or signed export packs. |
| `pitant-dashboard-overview` | One tenant/site/workflow needs a dense trend and state overview. | The view mixes scopes that require separate authorization or evidence context. |

## Local Live Docs

Run:

```sh
bun run docs:dev
```

Build:

```sh
bun run docs:build
```

The live docs import the same registry block source that `registry:smoke`
installs into a fresh consumer app.
