# Getting started with PITANT Charts

PITANT Charts provides React dashboard components, a gallery of reusable chart examples, and a rendering engine for industrial data.

## Choose a package

| Package | Use it for | Data |
| --- | --- | --- |
| `pitant-charts` 0.7.0 | Line, grouped bar, donut, and sunburst charts in a React dashboard | Rows with accessors, slices, or a hierarchy |
| `@pitant/chart-catalog` 0.7.0 | Browsing chart designs and embedding a specific variant such as a gauge, Sankey diagram, or heatmap | Categories and series, or records with fields specific to the chart family |
| `@pitant/charts-react` 1.0.0 | Historian trends, streaming signals, state lanes, synchronized charts, and scientific plots in React | Typed arrays or structured inputs specific to the chart |
| `@pitant/charts` 1.0.0 | The industrial renderer and data engine. Use the core directly when your app owns the canvas lifecycle. | Typed arrays and renderer commands |

The dashboard and catalog packages share a version. CI checks that they match. The industrial packages have their own version. [Dashboard package](../packages/charts-ui/README.md) · [Catalog package](../apps/chart-catalog/README.md) · [Industrial React API](../packages/charts-react/README.md)

## Install from source

Use Bun 1.4.4 and Node.js 22.12 or later to build the workspace. In the consuming app, use React and React DOM 19.2 or later within React 19 for dashboard and catalog charts. The industrial React package supports React 19. The commands below use local archives from the checkout.

```sh
git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
```

From the repository root, run the commands for the package you need. Keep the two industrial archives together because the React bindings depend on the core.

```sh
# Dashboard components
npm pack ./packages/charts-ui

# Catalog examples
npm pack ./apps/chart-catalog

# Industrial charts and React bindings
bun run build
npm pack ./packages/charts ./packages/charts-react
```

In your React app, install the archives you built. Replace `/path/to/pitant-charts/` with the checkout path.

```sh
bun add /path/to/pitant-charts/pitant-charts-0.7.0.tgz
bun add /path/to/pitant-charts/pitant-chart-catalog-0.7.0.tgz
bun add /path/to/pitant-charts/pitant-charts-1.0.0.tgz /path/to/pitant-charts/pitant-charts-react-1.0.0.tgz
```

## Add a dashboard chart

Import `pitant-charts/styles.css` once. Supply a meaningful `label`, a category accessor, and one value accessor per series. Return `null` for a missing reading.

```tsx
import { LineChart } from 'pitant-charts'
import 'pitant-charts/styles.css'

const orders = [
  { month: 'Jan', total: 28 },
  { month: 'Feb', total: 41 },
  { month: 'Mar', total: 35 },
]

export function OrdersTrend() {
  return (
    <LineChart
      label="Monthly order volume"
      height={280}
      data={orders}
      category={(row) => row.month}
      series={[{ name: 'Orders', value: (row) => row.total }]}
    />
  )
}
```

| Component | Input and behavior |
| --- | --- |
| `LineChart` | Row data, `category`, and `series`. Each series accepts an optional CSS `color`. Use `formatValue` for axis and tooltip values. |
| `BarChart` | Same props as `LineChart`. Multiple series appear as grouped bars. |
| `DonutChart` | `data` is an array of `{ name, value, color? }`. Slices use positive finite values. Optional props include `legend`, `totalLabel`, and `renderCenter`. |
| `SunburstChart` | `data` is a named root with nested `children`. Leaf values determine branch totals. Arrow keys inspect, Enter drills down, and Escape goes back. `legend` is optional. |

All four accept `className` and `height`, which can be a number in pixels or a CSS length. The default is `16rem`. With shadcn styling, set `--chart-1` through `--chart-8` on a common ancestor. For the optional Warpdrive palette, also import `pitant-charts/warpdrive.css`, wrap the charts in `.chart-library-theme`, and set `data-theme="dark"` for Night. [Dashboard component guide](../packages/charts-ui/README.md) · [Palette reference](../packages/charts-ui/PALETTE.md)

## Browse and embed a catalog variant

Run `bun run catalog:dev` from the checkout or open the private gallery. Search by name, filter by family, or save examples in the browser. An example’s **Code** tab shows its React import and slug. **Compare** opens the live shadcn.io example alongside the PITANT rendering. **Parity review** records checks and outstanding differences. [Private gallery](https://chart-library-catalog.stony-boar-2041.chatgpt.site) · [Component index](https://chatgpt.com/space/page_158565692cf88191bb821bf62112a8d1) · [shadcn.io reference](https://www.shadcn.io/charts)

| Gallery group | Examples | Families |
| --- | ---: | --- |
| Trends & time series | 94 | Line, area, live line, sparkline, candlestick, stream |
| Comparisons & rankings | 48 | Bar, diverging bar, composed, lollipop, dumbbell, bump, slope, radar |
| Composition & KPIs | 59 | Pie, ring, radial, gauge, waffle, marimekko |
| Processes & schedules | 28 | Funnel, Sankey, waterfall, Gantt |
| Hierarchies & networks | 17 | Sunburst, treemap, tree, network |
| Distributions & statistics | 52 | Scatter, heatmap, uncertainty, histogram, ridgeline, ECDF, beeswarm, violin, box plot, hexbin, density |
| Maps & spatial data | 22 | Choropleth, bubble map, route map, globe, vector field |
| Tooltips | 11 | Tooltip and indicator variants |

Wrap `ChartPreview` in a container with a set height. This example uses custom rows for a Sankey diagram.

```tsx
import { ChartPreview, getExample } from '@pitant/chart-catalog'
import '@pitant/chart-catalog/styles.css'

export function SignupFlow() {
  const example = getExample('sankey-default')
  if (!example) return null

  return (
    <div style={{ height: 440 }}>
      <ChartPreview
        example={example}
        data={{ rows: [
          { source: 'Visit', target: 'Trial', value: 80 },
          { source: 'Trial', target: 'Paid', value: 34 },
        ] }}
      />
    </div>
  )
}
```

For a line or bar example, use `data={{ categories: ['Jan', 'Feb'], series: [{ name: 'Orders', values: [28, 41] }] }}`. Align series values by index with their categories. For candlesticks, use rows with `date`, `open`, `high`, `low`, and `close`. Omitting `data` displays the variant’s demo fixture. Live-line demo values are simulated.

Use `getExample(slug)` to look up a variant and `getFamily(id)` to list its family. The `examples`, `families`, and `groups` exports let you build your own index. `renderCenter` receives the active name, value, total, and share for donut and ring variants. Some rings also provide a target. `renderTooltip` is available on Tooltip family examples and receives the category, sample index, pin state, and current and previous series values. [Catalog usage and types](../apps/chart-catalog/README.md) · [Public type definitions](../apps/chart-catalog/src/types.ts)

The catalog contains 320 chart examples across 44 families plus 11 tooltip examples. The parity audit covers rendering in Chrome at desktop and mobile widths in both themes. **With measured plot sizing** shows the variants whose Compare dimensions have been checked. Exact styling, motion, and interactions remain open where the parity notes record gaps. [Parity status](../apps/chart-catalog/PARITY.md) · [Measured examples](https://chart-library-catalog.stony-boar-2041.chatgpt.site/#review=measured)

## Plot an industrial trend

`TimeSeries` consumes a `Float64Array` of timestamps and a `Float64Array` for each measured field. Use `renderer: 'auto'` to allow WebGPU with Canvas2D fallback. The axis formatter below treats timestamps as Unix milliseconds.

```tsx
import { TimeSeries } from '@pitant/charts-react'
import type { TimeSeriesConfig } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

const start = Date.UTC(2026, 10, 13, 8)
const data = {
  timestamps: new Float64Array([start, start + 1_000, start + 2_000]),
  columns: { temperature: new Float64Array([91.1, 91.4, 91.2]) },
}
const config: TimeSeriesConfig = {
  renderer: 'auto',
  series: [{ key: 'reactor', label: 'Reactor temperature', field: 'temperature' }],
  xAxis: { label: 'Time', formatValue: (value) => new Date(value).toLocaleTimeString() },
  yAxis: { label: '°C' },
}

export function ReactorTrend() {
  return (
    <TimeSeries
      ariaLabel="Reactor temperature trend"
      aspectRatio={16 / 9}
      config={config}
      data={data}
    />
  )
}
```

Keep timestamps ordered, with matching sample counts across columns. If data or config is computed in React, memoize it. For streaming use `append()` from `useTimeSeries` or the `TimeSeries` render callback. Attach quality flags as `Uint8Array` columns keyed by field, and carry gaps and provenance with the data. Use `DigitalChannel` for equipment states or alarm lanes, and `ChartSyncGroup` for related panels that share cursor or range state. [Industrial quick start](quick-start.md) · [Streaming and overlay examples](examples/README.md) · [shadcn registry blocks](../registry/README.md)

## Verify a change locally

| Area | Commands from the repository root |
| --- | --- |
| Dashboard | `bun run --filter pitant-charts check` and `bun run --filter pitant-charts palette:check` |
| Catalog | `bun run --filter @pitant/chart-catalog test`, `bun run catalog:build`, and `node apps/chart-catalog/scripts/check-workspace.mjs --pack` |
| Industrial | `bun run typecheck`, `bun run test`, and `bun run registry:validate` |

When changing a catalog example, open its **Compare** tab, check the affected states in light and dark themes, and record what was verified in the example’s parity notes. For a chart that supports interaction, exercise the keyboard and pointer or touch paths that the change affects. [Catalog audit instructions](../apps/chart-catalog/PARITY.md) · [Industrial release checklist](release-checklist.md)
