# Architecture

## Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        User Code                             │
│  import { createRenderContext, DataEngine } from '@pitant/charts'  │
├──────────────────────────────────────────────────────────────┤
│                     React Bindings                           │
│  <ChartCanvas renderer="auto" onContextReady={fn} />        │
├──────────────┬───────────────────────┬───────────────────────┤
│ Data Engine  │   Layout Engine       │   Render Backend      │
│ (Web Worker) │   (axes, grid, etc.)  │   (WebGPU / Canvas2D) │
│              │                       │                       │
│ • Ingest     │   • Axis scales       │   • drawLines()       │
│ • LOD pyramid│   • Grid layout       │   • drawFill()        │
│ • Query      │   • Label placement   │   • drawRect()        │
│ • Stats      │                       │   • drawText()        │
└──────────────┴───────────────────────┴───────────────────────┘
```

## Data Flow

1. **Ingest**: Raw time-series data → Worker → min-max LOD pyramid
2. **Query**: Visible range + pixel width → appropriate LOD level → Float32Array
3. **Layout**: Query result → axis ticks, grid lines, label positions
4. **Render**: Layout → GPU draw calls (WebGPU) or Canvas2D path operations

## Key Design Decisions

- **WebGPU primary**: GPU-accelerated rendering for million-point performance
- **Canvas2D fallback**: Automatic detection; same API surface
- **Lazy imports**: Renderer backends loaded via dynamic `import()` for tree-shaking
- **Transferable ArrayBuffers**: Zero-copy data transfer between Worker and main thread
- **Min-max LOD**: O(1) level selection, no re-computation on zoom

## Package Structure

```
packages/
  charts/            @pitant/charts — core library
    src/
      renderer/      RenderContext interface + implementations
      data-engine/   Web Worker data pipeline
  charts-react/      @pitant/charts-react — React bindings
apps/
  benchmark/         Performance benchmark harness
```
