# Catalog parity

The [shadcn.io React reference](https://www.shadcn.io/charts) enumerates 44 chart families with 320 examples, plus 11 tooltip examples. The library preserves the reference order within each family and exposes each example under its reference slug.

| Check | Status |
| --- | --- |
| Reference entries accounted for | 331 of 331 unique example IDs and reference URLs |
| Renderer routing | All 44 chart families and Tooltips |
| Reference Chromium render sweep | 331 live reference previews in desktop light, desktop dark, mobile light, and mobile dark |
| Local Chromium render sweep | 331 production-build previews in desktop light, desktop dark, mobile light, and mobile dark |
| Gallery | Desktop and mobile layout, family filters, search, saved examples across reloads, list view, deep links, theme and usage snippets checked |
| Live side-by-side comparison | Compare uses the selected variant and theme. The UI SDK toggle applies the measured palette and Hanken Grotesk font to the library pane. It remembers the preference and works with keyboard input in both themes. Measured charts use reference plot proportions and fixed-size plots fit narrow panes. |
| Variant parity notes | 331 variants have targeted behavior findings and specific remaining checks. |
| Donut interaction | Eight donut previews checked for keyboard selection, accessible value and share, and Escape clearing selection. |
| Representative chart behaviors | Time range, range selection, synchronized sparklines, data table, PNG and SVG export, live pause, gauge controls, tooltip pinning, hierarchy drill-down, loading states, large scatter, heatmap scrolling, map zoom, and globe drag checked |
| Tooltip sample readouts | All 270 captured date and value readouts match across 11 variants. Guide styles, pinning, and reduced motion were checked separately. |
| Matched hierarchy geometry | At desktop widths, mean node position differences are 0.005 px for the radial tree and 0.033 px for the network. The default treemap's five group boxes average 1.19 px difference at desktop width and 0.64 px at narrow width. |
| Default Cartesian geometry | All 30 dates match for each of the default area and line examples. The default bar matches all six monthly values, 83.61 px bar width at a 728 px plot, and idle-bar dimming. |
| Matched stacked bars and latency threshold | Stacked marks differ by at most 0.008 px across three matched sizes. The p95 and median line paths differ by under 0.001 px, and all 60 readout values match. |
| Area variants | All 20 variants were compared in desktop light and mobile dark. Samples match at the start, second point, and end of the 18 single-plot examples with stable data. The six small multiples share the reference plot dimensions and regional totals. |
| Bar variants | All 11 variants were compared at three desktop and mobile profiles. Mark bounds differ by at most 0.013 px except for the default chart's existing height rounding. Keyboard and touch inspection, synchronized panels, legend selection, and loading controls were checked. |
| Line variants | 30 additional variants were checked at two matched plot sizes. Grid and tick checks passed and visible path endpoints differ by at most 0.011 px. Range controls, drag selection, clustered markers, legend focus, and loading controls were checked. |
| Line brush, zoom, and linked views | Three brush examples, three synchronized metrics, and two chart/table examples were compared at desktop and mobile sizes. Zoom matches all 365 daily values and was checked during zoom, pan, and reset. SVG and PNG export dimensions, keyboard and touch input, and the three large-data point counts were checked. |
| Composed variants | All 11 variants match 276 distinct keyboard readouts. At two matched widths, grids differ by at most 0.0051 px, bar and candle bounds by 0.016 px, and sampled path coordinates by 0.0631 px. |
| Scatter fixture and geometry checks | All 121 sampled weekly and daily readouts match across the default, rings, solid, and outline variants. Point centers and grid positions differ by at most 0.005 px at 728 × 364 and 358 × 179 in both themes. |
| Candlestick geometry and readouts | Six variants and all three range windows were measured at three matched plot sizes in both themes. Bodies, wicks, grids, and labels differ by at most 0.0051 px. All 189 distinct date and price readouts in the five interactive variants match. |
| Pie geometry and inspection | All 58 idle wedge paths match across 14 variants at desktop and narrow sizes. Selected bounds match within 0.00007 px in 26 sampled pointer states. Keyboard inspection, effect controls, and legend selection were checked. |
| Ring geometry and progress | All 21 track paths match across six variants at desktop and narrow sizes. Goal readouts, legend, and keyboard inspection were checked. |
| Radial geometry and inspection | All 422 measured paths match across 11 variants at desktop and narrow sizes, including 255 population bars, 126 clock bars, and 15 area paths. The 1,036 dot positions align within 0.0051 px at each size. |
| Funnel geometry and stage readouts | All 11 variants were checked in 44 size and theme profiles. All 608 stage paths match within 0.005 px. Stage values, names, ratios, label positions, and fill opacity match. |
| Gauge layout and controls | All 21 variants were checked at desktop and mobile widths in both themes. Tests exercised the four quarter selections, six dial readings, live pause and resume, and custom values and labels. |
| Compare plot dimensions | 208 variants were checked in desktop light and mobile dark. Measured plots align within 0.6 px, with eight 300 px circular or dial plots scaling to fit the 286 px mobile pane. Labeled Sankey diagrams retain their reference width in a scrollable pane. |
| Area overlays and readouts | 84 reference samples match across forecast, target band, highlighted range, and trend. Geometry of the overlays, paths, and grids matches within 0.005 px at both tested sizes. |
| Sankey geometry and inspection | Across nine variants at three matched sizes, 86 node bounds and 166 weighted link paths align within 0.0051 px. All 238 captured keyboard readouts match. |
| Radar geometry and inspection | All 96 series scores match across nine variants. Rings, spokes, labels, dots and profiles align within 0.0051 px at measured desktop and narrow sizes. |
| Heatmap geometry and inspection | All 11 variants were measured at three plot widths. Marks, axes and rules align within 0.005 px, with every captured level matching. Keyboard, touch and the fixed weekday rail were checked. |
| Live-line layout and controls | All nine variants were checked in both themes at desktop and mobile widths for plot dimensions, clock labels, keyboard and touch inspection, and reduced motion. The demo feed is simulated. Pause freezes the visible window and Resume catches up. |
| Full behavior and visual comparison | Open |

## Remaining verification

The gallery’s **Parity review** lists coverage by family and searches checked behavior and remaining gaps. The **Compare** tab shows the live reference and current notes for each variant. All 331 entries have targeted checks and an explicit remaining comparison. The render checks establish that a preview mounted and showed chart output. Full parity still requires comparing chart geometry, styling, animation, and pointer and keyboard interactions across the supported profiles.

The previews use local fixtures and inherit chart theme tokens. Compare can apply the reference palette and font to the library pane. Remaining comparisons include forecast marker motion, exact motion timing, individual treemap leaf positions, and chart-specific loading and hover effects. [Polar, flow, and hierarchy notes](src/charts/polarflow/PARITY.md)

## Repeat the render audit

The audit uses Python Playwright with Chromium. Pass `CHROMIUM_PATH` if using a separately installed Chromium or Chrome binary.

```sh
python scripts/audit-renders.py --reference
python scripts/audit-renders.py --local http://127.0.0.1:4173/
```
