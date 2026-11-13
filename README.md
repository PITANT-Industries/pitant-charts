# Chart Library

React chart components and a searchable gallery indexed against the [shadcn.io React chart catalog](https://www.shadcn.io/charts). The catalog includes 44 chart families with 320 examples plus 11 tooltip examples.

## Run the gallery

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Search or filter by family, switch to list view, and save examples for later. The browser stores saved charts and theme preferences. A variant’s URL opens it directly. **Compare** puts the local chart alongside the live shadcn.io preview and shows the available parity notes. **Match reference styling** applies the measured palette and Hanken Grotesk typeface to the local comparison chart. For variants with verified plot sizes, Compare uses the reference plot proportions and fits fixed-size charts to narrow panes. **Code** shows how to use the example in React. **Parity review** tracks notes for each family, with a filter for variants that have measured plot sizing.

Search within **Parity review** to find checked behavior and remaining gaps by keyword. Copy the URL while **Compare** or **Code** is selected to share that view of the variant.

[Component index and progress](https://chatgpt.com/space/page_158565692cf88191bb821bf62112a8d1)

## Use the React library

`npm run build:library` creates the ESM module, CSS and TypeScript declarations in `dist-library`. Use `npm pack` to create an installable local archive.

```tsx
import { ChartPreview, getExample } from 'chart-library'
import 'chart-library/styles.css'

export function OrdersChart() {
  const example = getExample('line-default')
  if (!example) return null

  return (
    <div style={{ height: 280 }}>
      <ChartPreview example={example} data={{
        categories: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        series: [{ name: 'Orders', values: [28, 34, 31, 43, 40] }],
      }} />
    </div>
  )
}
```

`examples`, `families`, `groups`, `getExample`, and `getFamily` expose the catalog. `ChartData` accepts categories and numeric series for common charts and records for family-specific data such as geographic points and hierarchies. Omitting `data` uses demo fixtures. Donut and ring charts accept a `renderCenter` callback with the current value, label, total, and share. Tooltip examples accept `renderTooltip` with the active category, whether the tooltip is pinned, and each series’ current and previous value.

Use a sized container and load the stylesheet before applying your shadcn theme. Chart colors resolve from inherited CSS variables, including scope-specific overrides and OKLCH tokens. Changing a theme class, inline style, or `data-theme` on an ancestor refreshes the chart. For a dynamically replaced stylesheet, dispatch `new Event('chart-theme-change')` on `window` after the new styles apply.

Sparkline charts accept nullable sample values and leave a gap at missing samples. The stat card can compare each value with a prior period supplied as `rows: [{ previous: 100 }, ...]`, aligned with the series.

## Verify changes

```sh
npm test
npm run build
```

See [Parity status](PARITY.md) for verification and known differences, and [Third-party notices](THIRD_PARTY_NOTICES.md) for upstream code and licenses.
