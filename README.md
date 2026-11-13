# PITANT Charts

SciChart replacement for Pitant Systems: a WebGPU-first TypeScript charting
library for scientific and industrial time-series visualization.

**Layer:** Layer 6 - UX  
**Status:** active build  
**Role:** Chart primitives for historian trends, industrial telemetry, anomaly
overlays, SPC workflows, and future scientific chart packs.

Part of the PITANT Plant-Physics OS polyrepo. See
[pitant-contracts](https://github.com/PITANT-Industries/pitant-contracts) for
the cross-repo binding surface.

## Dashboard charts

The [`pitant-charts` package](packages/charts-ui/README.md) provides typed React line, bar, donut, and sunburst components for application dashboards. It includes an optional Warpdrive Day and Night theme and shares the same CSS series tokens as the industrial engine.

The [chart catalog](apps/chart-catalog/README.md) contains 331 browsable examples and tracks their parity with the shadcn.io React reference. Run `bun run catalog:dev` after installing the workspace dependencies.

## Industrial charts

- **WebGPU primary renderer** with Canvas2D fallback
- **Zero runtime dependencies** - tree-shakeable ESM
- **Web Worker data engine** with min-max LOD pyramid for million-point datasets
- **React 19 bindings** via `@pitant/charts-react`

## Packages

| Package | Description |
|---|---|
| `@pitant/charts` | Core library - renderers, data engine, view transform |
| `@pitant/charts-react` | React 19 bindings for the industrial engine |
| `pitant-charts` | React dashboard charts with Recharts and shared theme tokens |
| `@pitant/chart-catalog` | Private React chart library, gallery, and parity tracker |
| `apps/benchmark` | Performance benchmark harness |

## Quick Start

```bash
bun install
bun run build
bun run test
```

## Development

```bash
bun run dev          # Watch mode
bun run typecheck    # TypeScript check
bun run lint         # Biome lint + format check
bun run lint:fix     # Auto-fix lint issues
bun run test:watch   # Vitest watch mode
bun run test:coverage # Coverage report
```

## Architecture

```
Data Engine (Worker) -> Layout Engine -> Render Backend -> <canvas>
  LOD pyramid             axes/grid        WebGPU / Canvas2D
```

## Planning Docs

- [Project definition](project.md)
- [Architecture](ARCHITECTURE.md)
- [Architecture planning catalog](docs/architecture/README.md)
- [Canonical roadmap](docs/ROADMAP.md)
- [Detailed phase plans](plan/00-master-plan.md)
- [Current session state](SESSION.md)

## License

MIT
