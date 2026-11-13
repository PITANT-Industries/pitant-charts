# Catalog parity

The [shadcn.io React reference](https://www.shadcn.io/charts) enumerates 44 chart families with 320 examples, plus 11 tooltip examples. The library preserves the reference order within each family and exposes each example under its reference slug.

| Check | Status |
| --- | --- |
| Reference entries accounted for | 331 of 331 unique example IDs and reference URLs |
| Renderer routing | All 44 chart families and Tooltips |
| Reference Chromium render sweep | 331 live reference previews in desktop light, desktop dark, mobile light, and mobile dark |
| Local Chromium render sweep | 331 production-build previews in desktop light, desktop dark, mobile light, and mobile dark |
| Gallery | Desktop and mobile layout, family filters, search, saved examples across reloads, list view, deep links, theme and usage snippets checked |
| Live side-by-side comparison | Compare uses the selected variant and theme. The UI SDK toggle applies measured reference colors to the library pane, remembers the preference, and works with keyboard input in both themes. The panes stack at narrow widths. |
| Variant parity notes | 331 variants have targeted behavior findings and specific remaining checks. |
| Donut interaction | Eight donut previews checked for keyboard selection, accessible value and share, and Escape clearing selection. |
| Representative chart behaviors | Time range, range selection, synchronized sparklines, data table, PNG and SVG export, live pause, gauge controls, tooltip pinning, hierarchy drill-down, loading states, large scatter, heatmap scrolling, map zoom, and globe drag checked |
| Tooltip sample readouts | All 270 captured date and value readouts match across 11 variants. Guide styles, pinning, and reduced motion were checked separately. |
| Matched hierarchy geometry | At desktop widths, mean node position differences are 0.005 px for the radial tree and 0.033 px for the network. The default treemap's five group boxes average 1.19 px difference at desktop width and 0.64 px at narrow width. |
| Default Cartesian geometry | All 30 dates match for each of the default area and line examples. The default bar matches all six monthly values, 83.61 px bar width at a 728 px plot, and idle-bar dimming. |
| Matched stacked bars and latency threshold | Stacked marks differ by at most 0.008 px across three matched sizes. The p95 and median line paths differ by under 0.001 px, and all 60 readout values match. |
| Full behavior and visual comparison | Open |

## Remaining verification

The gallery’s **Parity review** lists coverage by family and searches checked behavior and remaining gaps. The **Compare** tab shows the live reference and current notes for each variant. All 331 entries have targeted checks and an explicit remaining comparison. The render checks establish that a preview mounted and showed chart output. Full parity still requires comparing chart geometry, styling, animation, and pointer and keyboard interactions across the supported profiles.

The previews use local fixtures and inherit chart theme tokens. Compare can apply the reference palette to the library pane. Remaining comparisons include forecast band styling, exact motion timing, individual treemap leaf positions, and chart-specific loading and hover effects. [Polar, flow, and hierarchy notes](src/charts/polarflow/PARITY.md)

## Repeat the render audit

The audit uses Python Playwright with Chromium. Pass `CHROMIUM_PATH` if using a separately installed Chromium or Chrome binary.

```sh
python scripts/audit-renders.py --reference
python scripts/audit-renders.py --local http://127.0.0.1:4173/
```
