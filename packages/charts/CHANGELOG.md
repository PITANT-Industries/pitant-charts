# Changelog

## 1.1.0 - 2026-11-28

- Preserved exact timestamp positions in raw and downsampled viewport queries.
- Added abortable renderer creation to prevent outdated WebGPU requests from
  configuring a reused canvas.
- Added independent Y axes, calendar and nonlinear scales, and rotated
  Cartesian layouts.
- Added mixed and styled marks, stacking, dashed lines, independent sample
  timestamps, gap policies and numeric heatmaps.
- Added chart plugin lifecycle hooks, batched updates and cached redraw.

- Added TimeSeries value-band and envelope-band render-plan support with
  command-frame/SVG output and a high-density benchmark gate.
- Added `addTimeSeriesDerivedColumns()` for visual-only scale/offset, delta,
  rate-of-change, and moving-average overlays with benchmark coverage.
- Added TimeSeries persistent annotation/ruler render-plan support for x-lines,
  y-lines, x-ranges, y-ranges, and rulers with command-frame/SVG output and a
  high-density benchmark gate.
- Added TimeSeries sparse event marker render-plan support for start, stop,
  alarm, comment, batch, hold, investigation, correction, and maintenance ticks
  with command-frame/SVG output and a high-density benchmark gate.

## 1.0.0 - 2026-05-19

- Initial v1 PITANT chart core package.
- Typed-array data engine, LOD pyramid, Canvas2D/WebGPU renderer selection,
  command-list rendering, time-series plans, digital-channel plans, PNG export
  support, and SVG command-frame export.
- Public token stylesheet at `@pitant/charts/styles/tokens.css`.
