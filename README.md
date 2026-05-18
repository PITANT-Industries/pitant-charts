# @pitant/charts

SciChart replacement for Pitant Systems: a WebGPU-first TypeScript charting
library for scientific and industrial time-series visualization.

**Layer:** Layer 6 - UX  
**Status:** active build  
**Role:** Chart primitives for historian trends, industrial telemetry, anomaly
overlays, SPC workflows, and future scientific chart packs.

Part of the PITANT Plant-Physics OS polyrepo. See
[pitant-contracts](https://github.com/PITANT-Industries/pitant-contracts) for
the cross-repo binding surface.

## Features

- **WebGPU primary renderer** with Canvas2D fallback
- **Zero runtime dependencies** - tree-shakeable ESM
- **Web Worker data engine** with min-max LOD pyramid for million-point datasets
- **React 19 bindings** via `@pitant/charts-react`

## Packages

| Package | Description |
|---|---|
| `@pitant/charts` | Core library - renderers, data engine, view transform |
| `@pitant/charts-react` | React 19 bindings |
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
- [Canonical roadmap](docs/ROADMAP.md)
- [Detailed phase plans](plan/00-master-plan.md)
- [Current session state](SESSION.md)

## License

MIT
