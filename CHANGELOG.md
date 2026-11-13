# Changelog

This changelog tracks `@pitant/charts` and `@pitant/charts-react`. The dashboard
and catalog packages share a separate version. See their [release procedure](docs/release-checklist.md#dashboard-and-catalog).

## Unreleased

### Added

- TimeSeries value-band and envelope-band support in the core render plan,
  React config, command-frame SVG export, and benchmark suite.
- TimeSeries visual-only derived series overlays for moving average, delta,
  rate-of-change, and scale/offset with a high-density benchmark gate.
- Browser render-harness `bands` profile for mounted React TimeSeries
  value/envelope band verification.

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
