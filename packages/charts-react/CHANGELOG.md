# Changelog

## Unreleased

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
