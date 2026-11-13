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
| Scatter fixture and geometry checks | All 121 sampled weekly and daily readouts match across the default, rings, solid, and outline variants. Point centers and grid positions differ by at most 0.005 px at 728 × 364 and 358 × 179 in both themes. |
| Candlestick geometry and readouts | Six variants and all three range windows were measured at three matched plot sizes in both themes. Bodies, wicks, grids, and labels differ by at most 0.0051 px. All 189 distinct date and price readouts in the five interactive variants match. |
| Circular geometry and motion | Five pie and ring variants match measured idle and selected mark bounds within 0.00008 px at their reference sizes. All 24 readouts match. Rolling digits, staggered entrance, and static reduced-motion states were checked. |
| Compare plot dimensions | 38 variants were checked at desktop and narrow widths. Plots align within 0.5 px in the tested desktop light and mobile dark comparisons. The 300 px ring is capped to 286 px in the tested narrow pane to avoid overflow. |
| Area overlays and readouts | 84 reference samples match across forecast, target band, highlighted range, and trend. Geometry of the overlays, paths, and grids matches within 0.005 px at both tested sizes. |
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
