# Changelog

## Unreleased

- Added `TimeSeriesConfig.bands[]` for value bands and envelope bands rendered
  through the core TimeSeries command-frame path.
- Added `TimeSeriesConfig.derivedSeries[]` for visual-only moving average,
  delta, rate-of-change, and scale/offset overlays through the existing
  TimeSeries LOD, tooltip, export, and append paths.

## 1.0.0 - 2026-05-19

- Initial v1 React bindings for PITANT chart workflows.
- `TimeSeries`, `DigitalChannel`, `ChartSyncGroup`, `ChartDataZoom`,
  `ChartRegionZoomLayer`, legends, tooltips, quality/gap/provenance payloads,
  PNG export, and SVG export for concrete chart hooks.
