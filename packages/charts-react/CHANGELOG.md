# Changelog

## 1.1.0 - 2026-11-28

- Fixed timestamp precision in the TimeSeries viewport and added regressions
  for dated and fractional-millisecond input.
- Canceled renderer initialization on unmount so rapid remounts keep their
  live WebGPU device.
- Added named Y axes and mixed marks for TimeSeries, rotated plots, and a
  numeric Heatmap component.
- Added XY selection, custom hover sampling, cursor and range synchronization,
  per-plot pixel ratio, and live plugin mount and cleanup.

- Added `TimeSeriesConfig.bands[]` for value bands and envelope bands rendered
  through the core TimeSeries command-frame path.
- Added `TimeSeriesConfig.derivedSeries[]` for visual-only moving average,
  delta, rate-of-change, and scale/offset overlays through the existing
  TimeSeries LOD, tooltip, export, and append paths.
- Added `TimeSeriesConfig.annotations[]` for persistent x-line, y-line,
  x-range, y-range, and ruler overlays through the core TimeSeries
  command-frame path.
- Added `TimeSeriesConfig.eventMarkers[]` for sparse start, stop, alarm,
  comment, batch, hold, investigation, correction, and maintenance event ticks
  through the core TimeSeries command-frame path.

## 1.0.0 - 2026-05-19

- Initial v1 React bindings for PITANT chart workflows.
- `TimeSeries`, `DigitalChannel`, `ChartSyncGroup`, `ChartDataZoom`,
  `ChartRegionZoomLayer`, legends, tooltips, quality/gap/provenance payloads,
  PNG export, and SVG export for concrete chart hooks.
