# Repository Guide

This repository contains PITANT’s industrial charting engine, React dashboard
components, and chart catalog.

## Start Here

1. Read `README.md` and `docs/getting-started.md` for the package map and setup.
2. Read `docs/ci-cd.md` for workflow checks, delivery, and release procedures.
3. Use `docs/ROADMAP.md` and `docs/architecture/README.md` for the industrial plans.
4. Use `apps/chart-catalog/PARITY.md` for chart catalog coverage and open checks.

## Project Shape

- `packages/charts`: zero-runtime-dependency core library.
- `packages/charts-react`: React 19 primitives and hooks.
- `packages/charts-ui`: React dashboard charts.
- `apps/chart-catalog`: React chart variants, gallery, and parity review.
- `apps/benchmark`: benchmark harness.
- `scripts`: repo maintenance scripts.
- `docs/ROADMAP.md`: canonical delivery roadmap.
- `docs/architecture/`: 00-10 planning catalog and phase evidence.

## Development Commands

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run build
bun run bench
bun run catalog:build
```

## Engineering Rules

- Keep the core package free of runtime dependencies unless the roadmap is
  explicitly updated.
- Prefer typed arrays, transferables, and structured renderer/data contracts
  over ad hoc object-heavy hot paths.
- Preserve the WebGPU-first plus Canvas2D fallback architecture.
- Maintain CSS-variable theming and headless composition in React bindings.
- Update `SESSION.md` and checked roadmap tasks when phase work changes.
