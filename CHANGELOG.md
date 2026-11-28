# Changelog

This changelog tracks `@pitant/charts` and `@pitant/charts-react`. The dashboard
and catalog packages share a separate version. See their [release procedure](docs/release-checklist.md#dashboard-and-catalog).

## 1.1.0 - 2026-11-28

### Added

- Named Y axes for channels and overlays, with independent ranges, labels,
  grids and tick formats. The multi-axis registry block plots three units
  on one canvas.
- Rotated Cartesian plots, calendar-aware ticks, nonlinear and ordinal
  scales, dependent unit conversions, and automatic arcsinh thresholds.
- Mixed marks, stacking, independent timestamps, sample-level styling,
  dashed strokes, and dense or sparse numeric heatmaps.
- XY selection, configurable hover and synchronization, plugin lifecycle
  hooks, and batched imperative updates and redraws.
- TimeSeries value-band and envelope-band support in the core render plan,
  React config, command-frame SVG export, and benchmark suite.
- TimeSeries visual-only derived series overlays for moving average, delta,
  rate-of-change, and scale/offset with a high-density benchmark gate.
- Browser render-harness `bands` profile for mounted React TimeSeries
  value/envelope band verification.

### Fixed

- Preserved epoch and fractional-millisecond timestamp precision through
  raw and downsampled viewport queries on the main thread and in workers.
- Aligned WebGPU positions with Canvas2D and verified both renderers in Chrome.
- Prevented canceled WebGPU initialization from replacing the device on a
  chart that mounted while the earlier request was still in flight.

## 1.0.0 - 2026-05-19

### Added

- shadcn registry metadata and eight installable PITANT chart blocks.
- Live docs app under `apps/docs-site` and first-run quick start under
  `docs/quick-start.md`.
- TimeSeries and DigitalChannel PNG export with explicit width, height,
  background, and pixel-ratio options.
- TimeSeries and DigitalChannel SVG export from vector command frames.
- Source-resolved Vitest alias for `@pitant/charts` so package tests do not use
  stale built declarations.
- Release gates for package dry-run, bundle size, docs, registry, tests,
  benchmarks, and npm provenance publishing.
- Playwright cross-browser smoke gate for Chromium, Firefox, WebKit/Safari
  runtime, and Microsoft Edge.

### Changed

- Root `typecheck` rebuilds `@pitant/charts` declarations before checking
  `@pitant/charts-react`.

### Verification

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run bench`
- `bun run registry:validate`
- `bun run registry:typecheck`
- `bun run registry:smoke`
- `bun run docs:build`
- `bunx size-limit`
- `bun run pack:dry-run`
