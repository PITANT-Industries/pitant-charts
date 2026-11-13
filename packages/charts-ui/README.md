# PITANT Charts

Four typed React charts for application data: line, bar, donut and sunburst. They use Recharts and read inherited shadcn color tokens. The optional Warpdrive profile includes Day and Night colors.

## Try a local release

Requires Bun 1.4.4 to develop the library and React and React DOM 19.2 or newer within React 19 in your app.

Run the first command from the repository root. Use Node.js 22.12 or later for the build.

```sh
bun install --frozen-lockfile
cd packages/charts-ui
bun run check
bun run palette:check
bun pm pack
bun scripts/check-package.ts pitant-charts-0.7.0.tgz
```

From your React app, run `bun add /path/to/pitant-charts-0.7.0.tgz`.

[Repository setup and release checks](../../docs/release-checklist.md#dashboard-and-catalog)

```tsx
import { LineChart } from 'pitant-charts'
import 'pitant-charts/styles.css'
import 'pitant-charts/warpdrive.css'

const orders = [
  { month: 'Jan', orders: 28 },
  { month: 'Feb', orders: 41 },
  { month: 'Mar', orders: 35 },
]

export function OrdersChart() {
  return (
    <div className="chart-library-theme">
      <LineChart
        label="Monthly orders"
        data={orders}
        category={row => row.month}
        series={[{ name: 'Orders', value: row => row.orders }]}
      />
    </div>
  )
}
```

| Component | Data and options |
| --- | --- |
| `LineChart` | Row data, category and value accessors, optional CSS colors and value formatter. Return `null` for a missing point. |
| `BarChart` | Same row API as line. Multiple series are grouped by category. |
| `DonutChart` | Array of `{ name, value, color? }`. Optional legend, total label and custom center renderer. Only positive finite values are plotted. |
| `SunburstChart` | A named root with nested `children`. Leaf values are positive numbers. Branch totals are derived from their children. Optional legend. Use arrow keys to inspect a segment, Enter to drill down and Escape to go back. |

All charts take an accessible `label`, an optional `className`, and an optional `height` in pixels or as a CSS length. The default is `16rem`.

## Theme

Import `warpdrive.css` and put `chart-library-theme` on the element that should supply the theme. Add `data-theme="dark"` or `dark` to switch to Night. If your app already supplies its own tokens, import `styles.css` and the chart will read the nearest theme. Theme tokens accept full CSS colors or raw HSL channels. Set `--chart-1` through `--chart-8` to override the categorical series, and use `--font-interface` to inherit the app's typography. Each series or slice can also supply a CSS color directly.

See the [palette comparison](PALETTE.md) for the design rationale and measurements.

## Using the theme with other charts

The optional theme provides the same `--chart-1` through `--chart-8` series tokens used by other shadcn charts. Apply it to a common parent when you want charts with different renderers to share a palette. The charts also recognize the industrial chart token names for axes (`--chart-axis-color`), grid (`--chart-grid-color`), and tooltip colors and styling (`--chart-tooltip-*`). Use those tokens when you want both renderers to inherit the same UI settings. Time series with streaming, downsampling or synchronized cursors can keep their existing renderer and use the same theme.

## License

Original code is MIT. The adapted sunburst layout and Warpdrive theme retain their upstream copyright notices. See [third-party notices](THIRD_PARTY_NOTICES.md).
