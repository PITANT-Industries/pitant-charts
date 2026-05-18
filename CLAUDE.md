# Repository Guide

This repository is the Pitant Systems SciChart replacement: a WebGPU-first
industrial charting library for historian, anomaly, and scientific time-series
workflows.

## Start Here

1. Read `docs/ROADMAP.md` for current phase and next executable tasks.
2. Read `SESSION.md` for the current handoff state.
3. Use `plan/*.md` as detailed reference material, not as the primary tracker.

## Project Shape

- `packages/charts`: zero-runtime-dependency core library.
- `packages/charts-react`: React 19 primitives and hooks.
- `apps/benchmark`: benchmark harness.
- `scripts`: repo maintenance scripts.
- `docs/ROADMAP.md`: canonical delivery roadmap.

## Development Commands

```bash
bun install
bun run typecheck
bun run lint
bun run test
bun run build
bun run bench
```

## Engineering Rules

- Keep the core package free of runtime dependencies unless the roadmap is
  explicitly updated.
- Prefer typed arrays, transferables, and structured renderer/data contracts
  over ad hoc object-heavy hot paths.
- Preserve the WebGPU-first plus Canvas2D fallback architecture.
- Maintain CSS-variable theming and headless composition in React bindings.
- Do not broaden v1 beyond performant TimeSeries and DigitalChannel charts.
- Update `SESSION.md` and checked roadmap tasks when phase work changes.

## Current Focus

Phase 3 is the active implementation phase. The next major work is wiring
actual TimeSeries rendering through the existing data engine and render
contexts.
