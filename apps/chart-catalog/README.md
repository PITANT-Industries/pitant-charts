# PITANT Chart Catalog

React chart components and a searchable gallery indexed against the [shadcn.io React chart catalog](https://www.shadcn.io/charts). The catalog includes 44 chart families with 320 examples plus 11 tooltip examples.

## Run the gallery

From the PITANT Charts repository root, run `bun install --frozen-lockfile` and `bun run catalog:dev`.

Open the URL printed by Vite. Search or filter by family, switch to list view, and save examples for later. The browser stores saved charts and theme preferences. A variant’s URL opens it directly. **Compare** puts the local chart alongside the live shadcn.io preview and shows the available parity notes. **Match reference styling** applies the measured palette and Hanken Grotesk typeface to the local comparison chart. For variants with verified plot sizes, Compare uses the reference plot proportions and fits fixed-size charts to narrow panes. **Code** shows how to use the example in React. **Parity review** tracks notes for each family, with a filter for variants that have measured plot sizing.

The gallery uses Hanken Grotesk, neutral surfaces, and a blue accent in both themes. The header theme button switches the gallery and its charts together. The Compare palette uses the measured colors from the reference preview.

Search within **Parity review** to find checked behavior and remaining gaps by keyword. Copy the URL while **Compare** or **Code** is selected to share that view of the variant.

The header’s **Component index** opens the gallery’s built-in Parity review. It works without a connected workspace account. [Source index and verification progress](PARITY.md) · [Detailed remaining work for all 331 examples](REMAINING_WORK.md).

The agreed project closeout finishes the current Line caller-data batch and records the remaining work. Catalogue coverage is complete; exact reference parity remains open in the backlog. Further parity implementation is outside this closeout.

## Use the React library

`bun run catalog:build` builds the gallery and creates the ESM module, CSS, and TypeScript declarations. Run `npm pack ./apps/chart-catalog` to create an installable archive of the private catalog package. Its version is checked against the `pitant-charts` dashboard package in CI.

```tsx
import { ChartPreview, getExample } from '@pitant/chart-catalog'
import '@pitant/chart-catalog/styles.css'

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

See [caller-data coverage](https://github.com/PITANT-Industries/pitant-charts/blob/main/apps/chart-catalog/CALLER_DATA.md) for the qualified routes and remaining differences between demo and supplied-data behavior.

`examples`, `families`, `groups`, `getExample`, and `getFamily` expose the catalog. `ChartData` accepts categories and numeric series for common charts and records for family-specific data such as geographic points and hierarchies. Omitting `data` uses demo fixtures. Donut and ring charts accept a `renderCenter` callback with the current value, label, total, and share. Tooltip examples accept `renderTooltip` with the active category, whether the tooltip is pinned, and each series’ current and previous value.

Use a sized container and load the stylesheet before applying your shadcn theme. Chart colors resolve from inherited CSS variables, including scope-specific overrides and OKLCH tokens. Changing a theme class, inline style, or `data-theme` on an ancestor refreshes the chart. For a dynamically replaced stylesheet, dispatch `new Event('chart-theme-change')` on `window` after the new styles apply.

Sparkline charts accept nullable sample values and leave a gap at missing samples. The stat card can compare each value with a prior period supplied as `rows: [{ previous: 100 }, ...]`, aligned with the series.

Area examples accept ISO dates in `categories`, or aligned `rows: [{ date: '2026-06-01' }, ...]` when categories are display labels. Omit row dates for undated categories. Caller series retain their names and colors and use a scale based on their values. The four overlay variants also accept ISO datetime rows and nullable gaps. Use `rows.forecast` for the forecast boundary, `referenceLow`/`referenceHigh` for a target band, and `rows.highlight` for a highlighted span. The trend fits each series’ finite samples. See the caller-data guide for fallback and date-axis rules.

Tooltip examples accept supplied categories/series or numeric `rows.value`. Omitted categories use caller row labels or numbered positions. Explicit empty input shows a no-data state; restored input resumes measuring the container. Nullable samples and raw custom-tooltip callback values remain available without inheriting demo dates or labels. Panel width follows its content and can extend beyond the plot, matching the reference placement rule.

Bar examples accept categories and nullable numeric series, or numeric `rows.value`. All eleven variants retain their detailed renderer with supplied data. Missing labels use caller row labels or numbered positions; explicit empty input shows a no-data state. Caller scales and readouts preserve tiny and large finite values, and stacked bars accumulate positive and negative values separately. No demo labels or footer statistics are inherited.

For `line-markers`, align `rows` with the categories and put each date's annotations in `events`, for example `rows: [{ events: [{ icon: '🚀', title: 'Release', description: 'New editor available' }] }]`. Event readouts show the first two annotations and a count of any others. Marker clusters fan out for individual inspection. Emoji/title strings such as `'🚀 Release'` are also accepted.

All 41 Line examples accept supplied data without demo fallback, including their detailed band, projection, range, brush, zoom, table and loading models. ISO categories or aligned `rows.date` provide dates; incomplete calendars retain category positions. Large Data keeps its sample-index axis even when labels are ISO strings. See [Line input formats and overlay fields](CALLER_DATA.md) for these contracts and their limits.

For `density-groups`, supply `rows: [{ x: 1.2, y: 15, group: 'North', label: 'Sample 1' }]`, or categories and numeric series. The legend isolates a group; activating it again restores every group. Caller values use numeric axes and readouts, with an adaptive scale and no demo units. Matching `series` entries can provide group colors.

For `vector-field-stations`, supply Cartesian station rows such as `{ x: 4, y: 6, label: 'Harbor', speed: 9, direction: 245 }`. Coordinates are kilometres and speed is km/h; `speedKmh`, `bearing` and `name` are explicit aliases. Bearings normalize modulo 360. Existing geographic `{ lon, lat, speed, direction, label }` rows continue using their geographic projection and m/s readings. Use one coordinate format per dataset.

For a Live Line example, pass a stable `liveStream` object with `subscribe(receive)` and an optional `initialSamples` array. Call `receive` with batches of `{ timestamp, value, label? }` samples in nondecreasing Unix millisecond order, and return a function that unsubscribes. A `null` value leaves a gap. `capacity` controls retention and defaults to 4,096 readings. Updates are drawn once per browser frame. Pause freezes the displayed window while the stream keeps recording. An optional `data.series[0]` supplies the series name and color.

## Verify changes

```sh
bun run --filter @pitant/chart-catalog test
bun run catalog:build
node apps/chart-catalog/scripts/check-workspace.mjs --pack
```

See [Parity status](https://github.com/PITANT-Industries/pitant-charts/blob/main/apps/chart-catalog/PARITY.md) for verification and known differences, and [Third-party notices](THIRD_PARTY_NOTICES.md) for upstream code and licenses.

The private gallery uses `bun run catalog:site` to build the deployable `dist` directory from PITANT Charts `main`.
