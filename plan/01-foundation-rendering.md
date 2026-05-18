# Phase 1 — Foundation & Rendering Engine

**Timeline:** Weeks 1–5  
**Phase Goal:** A blank canvas draws an anti-aliased line at 60 fps via WebGPU with Canvas2D fallback, and a Web Worker builds a min-max LOD pyramid from raw Float64Array data. No chart types yet — pure engine infrastructure.  
**Depends On:** Nothing (project start)  
**Exit Gate:** WebGPU renders 1M-point polyline at ≥ 60 fps; Canvas2D renders 100K at ≥ 60 fps; benchmark harness green in CI; LOD pyramid builds in < 100 ms for 1M points.

---

## Phase KPIs

| KPI | Target | Measurement | Frequency |
|---|---|---|---|
| WebGPU line render FPS @ 1M pts | ≥ 60 fps | rAF delta, Playwright | Every PR |
| WebGPU line render FPS @ 10M pts | ≥ 60 fps | rAF delta, Playwright | Every PR |
| Canvas2D line render FPS @ 100K pts | ≥ 60 fps | rAF delta, Playwright | Every PR |
| LOD pyramid build time @ 1M pts | < 100 ms | `Performance.mark` in worker | Every PR |
| LOD pyramid memory overhead | ≤ 2× raw data size | `measureUserAgentSpecificMemory()` | Weekly |
| Worker init time | < 50 ms | `Performance.mark` | Every PR |
| Data ingestion rate (batch load) | ≥ 5M pts/sec | Worker benchmark | Every PR |
| Draw calls per series (WebGPU) | = 1 | GPU debug layer | Weekly |
| Canvas2D fallback activation reliability | 100% | Playwright with `--disable-gpu` | Every PR |
| Bundle size (core, tree-shaken) | ≤ 40 KB gzip | `bun build --minify` | Every PR |
| TypeScript strict violations | 0 `any` | `tsc --noEmit` | Every PR |
| Biome lint violations | 0 errors | `biome check` | Every PR |
| Test coverage (data engine) | ≥ 90% | Vitest c8 | Weekly |

---

## Epic E1.1 — Mono-Repo & Build Infrastructure

**Priority:** P0  
**Story Points:** 13  
**Duration:** Week 1  
**Owner:** TBD  

### Description

Set up the mono-repo structure, package boundaries, build pipeline, CI, and all tooling foundations. This epic ships zero rendering code — it produces a green CI pipeline and a documented developer workflow.

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| S1.1.1 | As a contributor, I can clone the repo, run `bun install`, and get a working dev environment in < 60 seconds | `bun install` completes without errors; `bun run build` produces valid ESM outputs; `bun run test` runs Vitest |
| S1.1.2 | As a contributor, I can run `bun run build` and get tree-shakeable ESM bundles for both packages | `@pitant/charts` and `@pitant/charts-react` each produce `dist/` with `.js` + `.d.ts`; no side effects at module level |
| S1.1.3 | As a reviewer, I can see CI status (lint, type-check, test, build, bundle-size) on every PR | GitHub Actions workflow runs on PR; badge in README; failure blocks merge |
| S1.1.4 | As a contributor, I can import from subpath exports like `@pitant/charts/spectral` | `package.json` `exports` map configured; TypeScript resolves types correctly |

### Deliverables

- [ ] **D1.1.1** Mono-repo root with `bun` workspaces
  - `/packages/charts/` — core engine + chart types
  - `/packages/charts-react/` — React 19 bindings
  - `/apps/storybook/` — Storybook dev app (added Phase 2)
  - `/apps/benchmark/` — Performance benchmark app
  - `/tools/` — Build scripts, code generation
  - Root `package.json` with workspace configuration
  - Root `tsconfig.json` with project references

- [ ] **D1.1.2** TypeScript 6 configuration
  - `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
  - Zero `any` policy enforced by lint rule
  - Path aliases for internal imports
  - Separate `tsconfig.build.json` excluding tests

- [ ] **D1.1.3** Biome 2 configuration
  - Formatter + linter unified config
  - Import sorting
  - Unused import removal
  - Consistent arrow parens, trailing commas, semicolons
  - Pre-commit hook via `lefthook` or `husky`

- [ ] **D1.1.4** Build pipeline (tsup or unbuild)
  - ESM output only (no CJS)
  - Source maps
  - `.d.ts` generation via `tsc --emitDeclarationOnly`
  - Tree-shaking verified: importing one chart type does not pull in others
  - Subpath exports in `package.json`:
    ```json
    {
      "exports": {
        ".": "./dist/index.js",
        "./spectral": "./dist/spectral/index.js",
        "./statistics": "./dist/statistics/index.js",
        "./spc": "./dist/spc/index.js",
        "./correlation": "./dist/correlation/index.js",
        "./anomaly": "./dist/anomaly/index.js",
        "./kpi": "./dist/kpi/index.js"
      }
    }
    ```

- [ ] **D1.1.5** Vitest configuration
  - Coverage with c8
  - Threshold enforcement (data engine ≥ 90%)
  - Workspace-aware test runner
  - Happy-dom for DOM-dependent tests

- [ ] **D1.1.6** CI pipeline (GitHub Actions)
  - Jobs: `lint`, `type-check`, `test`, `build`, `bundle-size`
  - `bundle-size` job uses `size-limit` or custom script to report gzip sizes per entrypoint
  - Bundle size regression blocks PR if > target
  - Matrix: Node 22, Bun latest
  - Caching: `bun install` cache, TypeScript build info

- [ ] **D1.1.7** Development documentation
  - `CONTRIBUTING.md` with setup instructions
  - `ARCHITECTURE.md` with package diagram
  - PR template with checklist
  - Issue templates (bug, feature, chart-type)

### Task Checklist

```
Setup
- [ ] Initialize mono-repo with bun workspaces
- [ ] Create package.json for @pitant/charts
- [ ] Create package.json for @pitant/charts-react
- [ ] Create root tsconfig.json with project references
- [ ] Create per-package tsconfig.json
- [ ] Create tsconfig.build.json (excludes tests)
- [ ] Configure Biome 2 (.biome.json)
- [ ] Configure lefthook for pre-commit

Build
- [ ] Configure tsup for @pitant/charts with ESM output
- [ ] Configure tsup for @pitant/charts-react with ESM output
- [ ] Define subpath exports in package.json
- [ ] Verify tree-shaking: import single chart type → check bundle only includes that code
- [ ] Generate .d.ts files, verify subpath type resolution

Testing
- [ ] Configure Vitest with workspace support
- [ ] Add happy-dom for DOM tests
- [ ] Configure coverage thresholds
- [ ] Write smoke test: import { TimeSeriesChart } from "@pitant/charts" compiles

CI
- [ ] Create .github/workflows/ci.yml
- [ ] Add lint job
- [ ] Add type-check job
- [ ] Add test job with coverage
- [ ] Add build job
- [ ] Add bundle-size tracking job
- [ ] Configure branch protection rules
- [ ] Add CI badge to README

Documentation
- [ ] Write CONTRIBUTING.md
- [ ] Write ARCHITECTURE.md with package diagram
- [ ] Create PR template
- [ ] Create issue templates
```

### Definition of Done

- `bun install && bun run build && bun run test && bun run lint` all pass on a fresh clone
- CI pipeline green on main branch
- Subpath import `@pitant/charts/spectral` resolves types in VS Code
- Bundle sizes reported in CI output
- `CONTRIBUTING.md` walkthrough tested by someone other than author

---

## Epic E1.2 — WebGPU Line Renderer

**Priority:** P0  
**Story Points:** 21  
**Duration:** Weeks 1–3  
**Owner:** TBD

### Description

Build the WebGPU rendering backend: instanced anti-aliased line rendering with a single draw call per series. This is the foundational GPU pipeline that all chart types will build upon.

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| S1.2.1 | As a developer, I can create a `WebGPURenderContext` from a `<canvas>` element and get a valid GPU device | Context creation succeeds on Chrome 113+; errors gracefully with descriptive message on unsupported browsers |
| S1.2.2 | As a developer, I can render a polyline of 1M points at ≥ 30 fps with smooth pan/zoom | Benchmark measures ≥ 30 fps sustained over 5-second pan sweep |
| S1.2.3 | As a developer, the rendered line has anti-aliased edges without MSAA | Visual: no jagged edges at 2× DPI; no staircase artifacts at 1× DPI |
| S1.2.4 | As a developer, I can render 8 polylines simultaneously with independent colors | 8-series render completes in single frame; each line has distinct color; draw call count = 8 |
| S1.2.5 | As a developer, I can render filled regions (area between two polylines) for alarm bands and confidence fill | Area fill renders correctly with configurable opacity; no z-fighting with line overlay |

### Deliverables

- [ ] **D1.2.1** `WebGPURenderContext` class
  - Creates `GPUDevice`, `GPUCanvasContext`
  - Handles device loss and recovery
  - Manages render pass encoder lifecycle
  - Supports dynamic canvas resize with proper swap chain update
  - DPI-aware: reads `devicePixelRatio`, renders at native resolution
  - Provides `requestAnimationFrame` render loop with frame budget tracking

- [ ] **D1.2.2** Line render pipeline (`LineShader`)
  - WGSL vertex + fragment shaders for polyline rendering
  - Instanced rendering: one draw call per series
  - Input: vertex buffer of `[x, y]` pairs as `Float32Array`
  - Uniform buffer: `[viewportWidth, viewportHeight, lineWidth, color(rgba), transform(4x4)]`
  - Analytical anti-aliasing via coverage calculation in fragment shader (no MSAA)
  - Line join handling: miter/round selectable via uniform
  - Line cap handling: butt/round selectable via uniform

- [ ] **D1.2.3** Fill render pipeline (`FillShader`)
  - WGSL shaders for triangle-strip fill between two polylines
  - Used for: area charts, confidence bands, alarm zone fills
  - Input: two vertex buffers (upper + lower boundaries)
  - Configurable fill color with alpha
  - Renders behind lines (z-order managed by render pass order)

- [ ] **D1.2.4** Transform system
  - `ViewTransform` class: manages pan (translate) + zoom (scale) in data space
  - Converts data coordinates ↔ pixel coordinates ↔ clip coordinates  
  - Uploads transform as 4×4 matrix to GPU uniform buffer
  - Efficient: only updates uniform buffer on transform change, not every frame

- [ ] **D1.2.5** Render command buffer
  - `RenderCommandList` collects draw commands from chart types
  - Sorts by z-order: fills → lines → overlays → text
  - Batches same-shader draws where possible
  - Submits as single `GPUCommandEncoder` per frame

- [ ] **D1.2.6** WebGPU capability detection
  - `detectGPUCapabilities()` → `{ supported: boolean, adapter: GPUAdapterInfo, limits: GPULimits }`
  - Fallback signal: emits `'renderer:fallback'` event when WebGPU unavailable
  - Feature detection: checks `maxBufferSize`, `maxStorageBufferBindingSize` for large dataset support

### Task Checklist

```
GPU Context
- [ ] Create WebGPURenderContext class with GPUDevice acquisition
- [ ] Handle GPUDevice lost event with recovery strategy
- [ ] Implement canvas resize with swap chain recreation
- [ ] Implement DPI-aware rendering (devicePixelRatio)
- [ ] Create render loop with frame budget tracking (16ms target)

Line Shader
- [ ] Write WGSL vertex shader for polyline instances
- [ ] Write WGSL fragment shader with analytical AA
- [ ] Create GPURenderPipeline for lines
- [ ] Implement vertex buffer upload from Float32Array
- [ ] Implement uniform buffer for color/width/transform
- [ ] Test: single line, 100 points → renders correctly
- [ ] Test: single line, 1M points → ≥ 30 fps
- [ ] Test: 8 lines, 100K points each → ≥ 30 fps
- [ ] Implement line join variants (miter, round)
- [ ] Implement line cap variants (butt, round)

Fill Shader
- [ ] Write WGSL vertex shader for triangle-strip fill
- [ ] Write WGSL fragment shader with alpha compositing
- [ ] Create GPURenderPipeline for fills
- [ ] Implement dual vertex buffer upload (upper + lower bounds)
- [ ] Test: fill between two lines → renders correctly
- [ ] Test: fill with 50% opacity → alpha compositing correct

Transform
- [ ] Create ViewTransform class with pan/zoom state
- [ ] Implement data → pixel → clip coordinate conversion
- [ ] Implement uniform buffer update on transform change
- [ ] Test: pan moves viewport correctly
- [ ] Test: zoom scales around cursor position
- [ ] Test: combined pan+zoom composition is correct

Render Pipeline
- [ ] Create RenderCommandList for draw command collection
- [ ] Implement z-order sorting (fills → lines → overlays → text)
- [ ] Implement command encoder submission
- [ ] Test: fill renders behind line (z-order correct)

Capability Detection
- [ ] Implement detectGPUCapabilities()
- [ ] Test on Chrome with WebGPU → returns capabilities
- [ ] Test on browser without WebGPU → returns supported:false gracefully
- [ ] Emit fallback event when WebGPU unavailable
```

### Technical Design Notes

**Instanced Line Rendering Approach:**
```
Per-vertex attributes:
  position_a: vec2<f32>   // current point
  position_b: vec2<f32>   // next point (for segment direction)
  side: f32               // +1 or -1 (which side of the line)

Per-instance attributes:
  (none — instances ARE vertices, expansion happens in vertex shader)

The vertex shader expands each line segment into a screen-space quad:
1. Compute segment direction in screen space
2. Compute perpendicular (normal)
3. Offset vertex by ±lineWidth/2 along normal
4. Apply miter join correction at segment junctions

The fragment shader computes:
1. Distance from pixel center to ideal line center
2. Coverage = smoothstep(lineWidth/2, lineWidth/2 - 1px, distance)
3. Output color with coverage as alpha (analytical AA)
```

**Memory Layout:**
```
Vertex Buffer (per series):
  Float32Array, length = numPoints × 2 (x, y interleaved)
  Uploaded once on data load
  Updated incrementally on streaming append (ring buffer region update)

Uniform Buffer (per series):
  [viewMatrix: mat4x4, color: vec4, lineWidth: f32, padding: f32×3]
  = 80 bytes per series

Shared Uniform Buffer (per frame):
  [projectionMatrix: mat4x4, viewportSize: vec2, time: f32, padding: f32]
  = 76 bytes, shared across all series
```

### Definition of Done

- 1M-point polyline renders at ≥ 30 fps on M1 MacBook Air, Chrome
- Anti-aliased edges confirmed visually at 1× and 2× DPI
- 8 simultaneous series render correctly with independent colors
- Fill region renders with correct alpha behind line
- Device loss triggers recovery, not crash
- All tests green; code coverage ≥ 80% for renderer module

---

## Epic E1.3 — Canvas2D Fallback Renderer

**Priority:** P0  
**Story Points:** 13  
**Duration:** Weeks 2–3  
**Owner:** TBD

### Description

Build the Canvas2D rendering backend as a fallback when WebGPU is unavailable. Must implement the same render interface as WebGPU so chart types are renderer-agnostic. Performance target: ≥ 30 fps at 100K points.

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| S1.3.1 | As a user on Firefox/Safari without WebGPU, the chart renders correctly using Canvas2D | Chart appears identical (within rasterization differences) to WebGPU version |
| S1.3.2 | As a user, I see a performance warning when Canvas2D is used with > 200K points | Warning appears in console and optionally in chart UI |
| S1.3.3 | As a developer, I use the same `RenderContext` interface for both WebGPU and Canvas2D | No `if (webgpu)` checks in chart type code |

### Deliverables

- [ ] **D1.3.1** `Canvas2DRenderContext` class implementing `RenderContext` interface
  - Same public API as `WebGPURenderContext`
  - Uses `CanvasRenderingContext2D` (or `OffscreenCanvas` where available)
  - `Path2D` batching for line rendering
  - Handles resize, DPI, device pixel ratio
  - Frame budget tracking

- [ ] **D1.3.2** Canvas2D line rendering
  - `Path2D` polyline with `stroke()`
  - Anti-aliasing via browser's native line smoothing
  - configurable `lineWidth`, `strokeStyle`, `lineCap`, `lineJoin`
  - Point decimation for Canvas2D: if points > 200K, apply viewport-resolution decimation before draw

- [ ] **D1.3.3** Canvas2D fill rendering
  - `Path2D` polygon fill for areas between two polylines
  - `fill()` with `globalAlpha` for opacity
  - Correct compositing order (fills before lines)

- [ ] **D1.3.4** Canvas2D transform system
  - Uses `ctx.setTransform()` + custom matrix math (not `ctx.translate/scale` which compound)
  - Same `ViewTransform` class as WebGPU
  - Data-to-pixel conversion identical to WebGPU path

- [ ] **D1.3.5** Performance warning system
  - Detects when dataset exceeds Canvas2D comfort zone (> 200K visible points)
  - Emits `'renderer:performance-warning'` event
  - Optional in-chart badge: subtle indicator that GPU rendering would be faster
  - Does NOT block rendering — just informs

### Task Checklist

```
Renderer
- [ ] Define RenderContext interface (shared between WebGPU and Canvas2D)
- [ ] Implement Canvas2DRenderContext class
- [ ] Implement Path2D line rendering with batching
- [ ] Implement anti-aliased line styling (lineCap, lineJoin, lineWidth)
- [ ] Implement fill rendering with alpha compositing
- [ ] Implement OffscreenCanvas path (where available)

Transform
- [ ] Reuse ViewTransform class from WebGPU path
- [ ] Implement setTransform() matrix application
- [ ] Test: pan/zoom behavior matches WebGPU path pixel-for-pixel

Performance
- [ ] Implement point count monitoring per frame
- [ ] Implement performance warning emission at > 200K pts
- [ ] Implement viewport-resolution decimation for Canvas2D
- [ ] Benchmark: 100K points → ≥ 30 fps
- [ ] Benchmark: 200K points → measure and document actual FPS

Testing
- [ ] Visual comparison: WebGPU vs Canvas2D for same dataset (screenshot diff)
- [ ] Test on Firefox (no WebGPU) → Canvas2D activates
- [ ] Test on Chrome with --disable-gpu → Canvas2D activates
- [ ] Test performance warning appears at > 200K points
```

### Definition of Done

- Canvas2D renders identical chart output (within rasterization tolerance) to WebGPU
- 100K points at ≥ 30 fps on M1 MacBook Air, Firefox
- Performance warning emits at > 200K visible points
- `RenderContext` interface is the same for both backends
- All tests green

---

## Epic E1.4 — Auto-Renderer Selection & Abstraction

**Priority:** P0  
**Story Points:** 8  
**Duration:** Week 3  
**Owner:** TBD

### Description

Unify WebGPU and Canvas2D behind a common abstraction. Chart types code against `RenderContext` and never know which backend is active. Auto-selection picks the best available renderer.

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| S1.4.1 | As a developer, I specify `renderer: "auto"` and the best backend is selected | WebGPU used when available; Canvas2D otherwise; no user action needed |
| S1.4.2 | As a developer, I can force `renderer: "webgpu"` or `renderer: "canvas2d"` | Forced selection works; error if forced renderer unavailable |
| S1.4.3 | As a developer, chart type code has zero renderer-specific branches | Chart types import and use only `RenderContext` interface |

### Deliverables

- [ ] **D1.4.1** `RenderContext` interface definition
  ```ts
  interface RenderContext {
    readonly type: 'webgpu' | 'canvas2d'
    readonly canvas: HTMLCanvasElement
    readonly width: number
    readonly height: number
    readonly dpr: number
    
    resize(width: number, height: number): void
    beginFrame(): void
    endFrame(): void
    
    drawLines(buffer: Float32Array, options: LineOptions): void
    drawFill(upper: Float32Array, lower: Float32Array, options: FillOptions): void
    drawRect(x: number, y: number, w: number, h: number, options: RectOptions): void
    drawText(text: string, x: number, y: number, options: TextOptions): void
    
    setTransform(transform: ViewTransform): void
    
    dispose(): void
  }
  ```

- [ ] **D1.4.2** `createRenderContext()` factory function
  - Async: `await createRenderContext(canvas, { renderer: 'auto' | 'webgpu' | 'canvas2d' })`
  - `'auto'`: tries WebGPU first → falls back to Canvas2D
  - `'webgpu'`: WebGPU only → throws if unavailable
  - `'canvas2d'`: Canvas2D only → always succeeds
  - Emits `'renderer:selected'` event with chosen backend

- [ ] **D1.4.3** Renderer capability query
  ```ts
  interface RendererCapabilities {
    type: 'webgpu' | 'canvas2d'
    maxPoints: number           // recommended max before perf degrades
    supportsInstancing: boolean
    supportsOffscreen: boolean
    gpuInfo?: GPUAdapterInfo
  }
  ```

### Task Checklist

```
Interface
- [ ] Define RenderContext interface in types.ts
- [ ] Define LineOptions, FillOptions, RectOptions, TextOptions types
- [ ] Ensure WebGPURenderContext implements RenderContext
- [ ] Ensure Canvas2DRenderContext implements RenderContext

Factory
- [ ] Implement createRenderContext() with auto-detection
- [ ] Implement forced renderer selection with error on unavailable
- [ ] Emit renderer:selected event
- [ ] Test: auto selects WebGPU when available
- [ ] Test: auto falls back to Canvas2D when WebGPU unavailable
- [ ] Test: forced webgpu throws when unavailable

Capabilities
- [ ] Implement RendererCapabilities query
- [ ] Return maxPoints estimate based on renderer type
- [ ] Test: capabilities reflect actual renderer
```

### Definition of Done

- Chart types code exclusively against `RenderContext` interface
- `renderer: 'auto'` correctly selects WebGPU or Canvas2D
- All chart rendering tests pass on both backends
- Type system prevents direct access to backend-specific APIs from chart code

---

## Epic E1.5 — Data Engine (Web Worker + LOD Pyramid)

**Priority:** P0  
**Story Points:** 21  
**Duration:** Weeks 2–4  
**Owner:** TBD

### Description

Build the off-main-thread data engine that ingests raw time-series data, constructs a min-max LOD (Level of Detail) pyramid, and transfers viewport-resolution data to the main thread for rendering. This is the core innovation that enables 1M+ point rendering at 60 fps.

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| S1.5.1 | As a developer, I can send 1M-point Float64Array to the data engine and get a LOD pyramid back in < 300 ms | Pyramid build completes; pyramid levels correct; memory overhead ≤ 2× raw |
| S1.5.2 | As a developer, I can query the pyramid for a viewport range and get at most `2 × canvasWidth` points | Query returns correct min-max pairs for viewport; spike preservation verified |
| S1.5.3 | As a developer, I can append new points to an existing series without rebuilding the pyramid | Incremental append updates pyramid in < 1 ms per 100 points |
| S1.5.4 | As a developer, the data engine runs in a Web Worker and does not block the main thread | Main thread FPS remains ≥ 60 during 1M-point pyramid build in worker |
| S1.5.5 | As a developer, data transfers between worker and main thread are zero-copy via Transferable | No data copying overhead; ArrayBuffer ownership transferred |

### Deliverables

- [ ] **D1.5.1** Web Worker scaffolding
  - Worker entry point: `data-engine.worker.ts`
  - Message protocol definition:
    ```ts
    // Main → Worker
    type WorkerCommand = 
      | { type: 'ingest', seriesId: string, timestamps: BigInt64Array, values: Float64Array, quality?: Uint8Array }
      | { type: 'append', seriesId: string, timestamps: BigInt64Array, values: Float64Array }
      | { type: 'query', seriesId: string, startTime: bigint, endTime: bigint, viewportWidth: number }
      | { type: 'dispose', seriesId: string }
    
    // Worker → Main
    type WorkerResponse =
      | { type: 'ingested', seriesId: string, stats: SeriesStats }
      | { type: 'appended', seriesId: string, newLength: number }
      | { type: 'queryResult', seriesId: string, data: Float32Array, level: number, pointCount: number }
      | { type: 'error', seriesId: string, message: string }
    ```
  - Transferable ArrayBuffer for all data payloads
  - Promise-based wrapper on main thread: `DataEngine` class

- [ ] **D1.5.2** Min-Max LOD Pyramid
  - **Build algorithm:**
    ```
    Given raw data: timestamps[N], values[N]
    
    Level 0:  raw [t, v] pairs              → N points
    Level 1:  2-bucket min/max              → N/2 × [t_min, v_min, t_max, v_max]
    Level 2:  4-bucket min/max              → N/4 × [t_min, v_min, t_max, v_max]
    ...
    Level k:  2^k-bucket min/max            → N/2^k × [t_min, v_min, t_max, v_max]
    
    Build stops when level has < 256 points.
    ```
  - **Storage format:** Each level is a contiguous `Float64Array` of `[tMin, vMin, tMax, vMax]` quads
  - **Build time complexity:** O(N) — single pass per level
  - **Memory complexity:** O(N) total (geometric series: N + N/2 + N/4 + ... ≤ 2N)

- [ ] **D1.5.3** Viewport query engine
  - **Query:** Given `[startTime, endTime, viewportWidth]`, return the appropriate LOD level data
  - **Level selection:** Choose level where `pointsInRange ≤ 2 × viewportWidth`
  - **Range extraction:** Binary search for start/end indices within selected level
  - **Output:** `Float32Array` of `[x, y]` pairs (downcast from Float64 for GPU) suitable for direct vertex buffer upload
  - **Spike preservation:** Min-max pairs at every level guarantee visual spikes are never lost

- [ ] **D1.5.4** Incremental append
  - **Append algorithm:**
    ```
    1. Append to Level 0 (raw)
    2. If last bucket at Level 1 is incomplete, extend it
    3. If last bucket at Level 1 is complete, propagate upward
    4. Repeat for each level
    ```
  - **Amortized cost:** O(1) per append (each level touched ≤ once)
  - **Ring buffer mode:** When `maxPoints` is set, oldest data discarded from all levels simultaneously

- [ ] **D1.5.5** Series statistics tracking
  ```ts
  interface SeriesStats {
    count: number
    min: number
    max: number
    mean: number
    stdDev: number
    firstTimestamp: bigint
    lastTimestamp: bigint
    gapCount: number        // number of detected gaps
    badQualityCount: number // count of quality !== 2
  }
  ```
  - Updated incrementally on ingest and append
  - Available via `engine.getStats(seriesId)`

- [ ] **D1.5.6** Gap detection
  - Configurable `maxGapDuration` per series
  - If `timestamp[i+1] - timestamp[i] > maxGapDuration`, mark as gap
  - Gaps stored as `[startIndex, endIndex]` pairs
  - Query result includes gap markers so renderer can break the line

- [ ] **D1.5.7** Main-thread-only fast path
  - For datasets < 10K points, skip Worker entirely
  - Build pyramid synchronously on main thread
  - Same `DataEngine` API — caller doesn't know the difference
  - Avoids Worker init overhead for small datasets

### Task Checklist

```
Worker Scaffold
- [ ] Create data-engine.worker.ts entry point
- [ ] Define WorkerCommand and WorkerResponse message types
- [ ] Implement promise-based DataEngine class on main thread
- [ ] Implement Transferable ArrayBuffer passing for all data payloads
- [ ] Test: message round-trip works; data arrives intact

LOD Pyramid
- [ ] Implement Level 0 storage (raw data)
- [ ] Implement pyramid build: level-by-level min-max bucketing
- [ ] Verify: N=1M → pyramid builds in < 300 ms
- [ ] Verify: memory overhead ≤ 2× raw data
- [ ] Verify: spike at position X in raw data is preserved at all levels
- [ ] Test with various data shapes: flat, noisy, spike-heavy, gap-heavy

Viewport Query
- [ ] Implement level selection based on viewportWidth
- [ ] Implement binary search for time-range extraction
- [ ] Implement Float64 → Float32 downcast for GPU vertex buffer
- [ ] Test: query at various zoom levels returns correct level
- [ ] Test: returned point count ≤ 2 × viewportWidth
- [ ] Test: query at full zoom (raw level) returns exact raw data
- [ ] Benchmark: query latency < 1 ms for 1M-point series

Incremental Append
- [ ] Implement append to Level 0
- [ ] Implement pyramid propagation on append
- [ ] Test: append 1000 points → pyramid consistent with full rebuild
- [ ] Benchmark: append 100 points → < 1 ms
- [ ] Implement ring buffer mode with configurable maxPoints
- [ ] Test: ring buffer wraps correctly; oldest data evicted from all levels

Statistics & Gaps
- [ ] Implement SeriesStats incremental tracking
- [ ] Implement gap detection with configurable threshold
- [ ] Test: stats match numpy reference for test datasets
- [ ] Test: gaps detected correctly at configurable thresholds

Fast Path
- [ ] Implement main-thread pyramid build for < 10K points
- [ ] Use same DataEngine API
- [ ] Test: fast path produces same results as worker path
- [ ] Benchmark: fast path for 5K points is faster than worker round-trip
```

### Technical Design Notes

**Why Min-Max Pyramid (not LTTB)?**
- LTTB selects representative points but can miss spikes between selected points
- Min-Max guarantees that the visual maximum and minimum in every pixel-width bucket are preserved
- This is critical for industrial data: a 2ms spike to 500°C **must** be visible even when viewing a 24-hour window
- The rendering cost is bounded: at most `2 × viewportWidth` points per series at any zoom level

**Memory Budget:**
```
Raw data (1M Float64 pairs): 16 MB
Pyramid (≤ 2× raw):         ≤ 32 MB
Total per series:            ≤ 48 MB
8 series:                    ≤ 384 MB (within 512 MB historian/cloud budget)
```

**Transfer Protocol:**
```
Main thread → Worker:
  postMessage({ type: 'ingest', seriesId, timestamps, values }, [timestamps.buffer, values.buffer])
  // Ownership of ArrayBuffers transferred — zero copy

Worker → Main thread:
  postMessage({ type: 'queryResult', seriesId, data }, [data.buffer])
  // Float32Array transferred back — zero copy
```

### Definition of Done

- 1M-point pyramid builds in < 300 ms in worker
- Pyramid memory ≤ 2× raw data size
- Viewport query returns ≤ `2 × viewportWidth` points with spike preservation
- Append 100 points takes < 1 ms amortized
- Main thread FPS stays ≥ 60 during 1M-point ingest in worker
- Gap detection works for configurable thresholds
- Fast path (< 10K points, main thread) matches worker path output
- All tests green; data engine coverage ≥ 90%

---

## Epic E1.6 — Benchmark Harness & Performance CI

**Priority:** P0  
**Story Points:** 8  
**Duration:** Weeks 4–5  
**Owner:** TBD

### Description

Build an automated performance benchmark suite that runs in CI and tracks FPS, memory, latency, and bundle size across commits. Performance regressions block PR merge.

### User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| S1.6.1 | As a developer, I can run `bun run bench` and see FPS, memory, and timing for standard scenarios | Benchmark outputs table with metrics; matches format in §7 of project.md |
| S1.6.2 | As a reviewer, I can see performance numbers in PR comments | CI bot posts benchmark comparison: before/after for all metrics |
| S1.6.3 | As a maintainer, PRs that regress performance below targets are blocked from merging | CI job fails if any KPI below threshold; reviewer override available |

### Deliverables

- [ ] **D1.6.1** Benchmark app (`/apps/benchmark/`)
  - Standalone HTML page that runs benchmark scenarios
  - Uses Playwright to automate and collect metrics
  - Scenarios:
    ```
    SCENARIO_001: render 100K points, single pen → measure FPS
    SCENARIO_002: render 1M points, single pen → measure FPS
    SCENARIO_003: render 1M points, 8 pens → measure FPS
    SCENARIO_004: initial render 1M points → measure time-to-first-frame
    SCENARIO_005: LOD pyramid build 1M points → measure time
    SCENARIO_006: LOD pyramid build 5M points → measure time
    SCENARIO_007: streaming append 100 pts/frame, 1M base → measure overhead
    SCENARIO_008: memory footprint 1M pts single chart → measure bytes
    SCENARIO_009: memory footprint 8-pen 1M pts each → measure bytes
    SCENARIO_010: worker initialization → measure time
    ```

- [ ] **D1.6.2** Performance metric collection
  - FPS: measured via `requestAnimationFrame` delta over 5-second window, report p50/p95/min
  - Memory: `performance.measureUserAgentSpecificMemory()` where available, else `performance.memory`
  - Timing: `Performance.mark`/`Performance.measure` for specific operations
  - Bundle size: `bun build --minify` output, measured in bytes and gzip bytes

- [ ] **D1.6.3** CI integration
  - GitHub Actions job: `benchmark`
  - Runs after `build` job on every PR
  - Compares against baseline stored in `benchmark/baseline.json`
  - Posts PR comment with comparison table:
    ```
    | Scenario | Baseline | Current | Delta | Status |
    |---|---|---|---|---|
    | 1M pts FPS | 35 fps | 32 fps | -8.6% | ⚠️ WARNING |
    | 100K pts FPS | 62 fps | 61 fps | -1.6% | ✅ PASS |
    ```
  - **Failure thresholds:**
    - FPS: < target from §7 → FAIL
    - Memory: > target from §7 → FAIL
    - Bundle size: > target from §7 → FAIL
    - Any metric regresses > 10% from baseline → WARNING (reviewer decides)
  - Baseline update: maintainer manually runs `bun run bench:update-baseline`

- [ ] **D1.6.4** Local development benchmark
  - `bun run bench` — runs all scenarios, outputs to console
  - `bun run bench:scenario 002` — runs single scenario
  - `bun run bench:watch` — continuous benchmark during development
  - Human-readable output with color-coded pass/fail

### Task Checklist

```
Benchmark App
- [ ] Create /apps/benchmark/ with standalone HTML + minimal JS
- [ ] Implement each of the 10 benchmark scenarios
- [ ] Implement FPS measurement via rAF delta (p50, p95, min over 5s)
- [ ] Implement memory measurement
- [ ] Implement timing measurement for specific operations
- [ ] Test: benchmarks run independently and reproducibly

CI Integration
- [ ] Create Playwright test file that drives benchmark app
- [ ] Implement baseline.json format and comparison logic
- [ ] Implement PR comment posting via GitHub API
- [ ] Implement failure thresholds with configurable targets
- [ ] Implement baseline update command
- [ ] Test: CI job runs on PR and posts results

Local Dev
- [ ] Implement bun run bench CLI command
- [ ] Implement single-scenario and watch modes
- [ ] Color-coded console output
```

### Definition of Done

- `bun run bench` runs all 10 scenarios and outputs metrics table
- CI benchmark job runs on every PR
- PR comment shows before/after comparison
- FPS below §7 targets blocks merge
- Baseline update process documented in CONTRIBUTING.md

---

## Phase 1 — Consolidated Deliverable Summary

| Week | Focus | Key Outputs |
|---|---|---|
| **Week 1** | Mono-repo setup + WebGPU bootstrapping | Green CI; `bun install && build && test && lint` works; GPUDevice acquisition works |
| **Week 2** | WebGPU line rendering + Worker scaffolding | 1M-point polyline at 30 fps; worker message protocol functional |
| **Week 3** | Canvas2D fallback + Auto-selection + LOD pyramid build | Canvas2D renders same output; `renderer: 'auto'` works; pyramid builds in < 300 ms |
| **Week 4** | LOD query + incremental append + gap detection | Viewport query returns ≤ 2×width points; append is O(1); gaps detected |
| **Week 5** | Benchmark harness + CI integration + phase gate | All 10 benchmark scenarios green; CI posts metrics on PR; all Phase 1 KPIs pass |

### Phase 1 Exit Checklist

- [ ] WebGPU draws 1M-point line at ≥ 30 fps
- [ ] Canvas2D draws 100K-point line at ≥ 30 fps
- [ ] Auto-renderer selection works (WebGPU preferred, Canvas2D fallback)
- [ ] LOD pyramid builds 1M points in < 300 ms
- [ ] LOD query returns ≤ 2 × viewportWidth points with spike preservation
- [ ] Streaming append is O(1) amortized
- [ ] Gap detection works with configurable threshold
- [ ] Fast path (< 10K points, no worker) works
- [ ] Benchmark harness in CI, green on all KPI targets
- [ ] Bundle size (core) ≤ 40 KB gzip
- [ ] TypeScript strict, 0 `any`, Biome clean
- [ ] Data engine test coverage ≥ 90%
- [ ] CONTRIBUTING.md and ARCHITECTURE.md reviewed
