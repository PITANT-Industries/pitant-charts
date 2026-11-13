# Catalog parity

The [shadcn.io React reference](https://www.shadcn.io/charts) enumerates 44 chart families with 320 examples, plus 11 tooltip examples. The library preserves the reference order within each family and exposes each example under its reference slug.

| Check | Status |
| --- | --- |
| Reference entries accounted for | 331 of 331 unique example IDs and reference URLs |
| Renderer routing | All 44 chart families and Tooltips |
| Chromium render sweep | 331 examples rendered across the Cartesian, polar and flow, and statistical and geographic groups |
| Gallery | Desktop and mobile layout, family filters, search, saved examples across reloads, list view, deep links, theme and usage snippets checked |
| Representative chart behaviors | Time range, range selection, synchronized sparklines, data table, PNG and SVG export, live pause, gauge controls, tooltip pinning, hierarchy drill-down, loading states, large scatter, heatmap scrolling, map zoom, and globe drag checked |
| Full behavior and visual comparison | Open |

## Remaining verification

Compare each demo with its linked reference in both themes and at narrow and wide widths. Verify the named feature against the original, including pointer and keyboard interaction where applicable. Representative tests confirm behavior for selected variants. The complete render sweep confirms the catalog opens across every family.

The previews use local fixture data and our palette. Animation timing and some rendering details differ across the two implementations. Important comparisons include linked brush timing, forecast band styling, gauge transitions, hierarchy layout and map camera motion. See the variant’s Reference preview for the expected presentation and interactions.
