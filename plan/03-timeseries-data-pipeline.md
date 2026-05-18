# Phase 3 — TimeSeries Line Chart & Data Pipeline

**Weeks:** 11–16  
**Epics:** 4 (E3.1 – E3.4)  
**Story Points:** 89  
**Phase Goal:** `TimeSeries` (multi-pen line chart) and `DigitalChannel` (binary/staircase) render real data through the LOD pyramid, compose with Phase 2 primitives, and support live streaming. This is the **entire V1 product** — a line chart that beats every competitor on speed, quality, and composability.

**Phase KPIs:**

| KPI | Target | Measurement |
|---|---|---|
| 8-pen TimeSeries @ 1M pts/pen initial render | < 2 s | Playwright benchmark |
| 8-pen TimeSeries @ 1M pts/pen sustained FPS | ≥ 30 fps | rAF delta |
| Single-pen @ 100K pts sustained FPS | ≥ 60 fps | rAF delta |
| Streaming append overhead per sample | < 10 µs | Performance.mark |
| Live append at 10 Hz (100 samples/s/pen), 8 pens | ≥ 60 fps | rAF delta |
| DigitalChannel 16 channels sustained FPS | ≥ 30 fps | rAF delta |
| Gap detection accuracy | 100% on test suite | Vitest |
| Memory @ 8-pen × 1M pts | ≤ 200 MB | `measureUserAgentSpecificMemory()` |
| LOD level selection correctness | No visible aliasing or missing peaks | Visual regression |
| Ring buffer overflow handling | Zero data loss, configurable discard policy | Vitest |

**Entry Criteria:** Phase 2 exit — all 4 primitives render with `var(--chart-*)` tokens; axe-core 0 violations; `useChart()` hook lifecycle stable.  
**Exit Criteria:** 8-pen TimeSeries renders at ≥ 30 fps with 1M pts/pen; streaming at 10 Hz sustains 60 fps; DigitalChannel renders 16 channels; all primitives compose correctly (legend toggles pens, tooltip shows values, sync group works).

---

## E3.1 — TimeSeries Line Chart (Multi-Pen, LOD-Aware) (P0, 34 SP)

### User Stories

1. **As a developer**, I want to render a multi-pen time-series chart with `<TimeSeries config={...} data={...} />` and have it compose with `ChartContainer`, `ChartLegend`, and `ChartTooltip`.
2. **As a developer**, I want the chart to automatically select the right LOD level based on the viewport pixel width so I get smooth performance at any zoom level.
3. **As a user**, I want to see all 8 pens with distinct colors, smooth anti-aliased lines, and no visual artifacts even at 1M points per pen.
4. **As a developer**, I want to configure line style (solid, dashed, dotted), line width, and per-series color for each pen.
5. **As a developer**, I want gap detection — when data has time gaps larger than a threshold, the line should break rather than draw a misleading connection.

### Deliverables

#### D3.1.1 — `useTimeSeries()` Hook

```typescript
export interface TimeSeriesConfig {
  /** Series definitions */
  series: TimeSeriesDef[];
  /** X-axis configuration */
  xAxis: {
    /** Data field for time values (default: timestamp) */
    field?: string;
    /** Time format for axis labels */
    format?: string | ((ts: number) => string);
    /** Minimum gap before line break (ms). 0 = never break. */
    gapThreshold?: number;
  };
  /** Y-axis configuration */
  yAxis: {
    /** Auto-scale to data range (default: true) */
    auto?: boolean;
    /** Fixed range [min, max] */
    range?: [number, number];
    /** Format for axis labels */
    format?: string | ((val: number) => string);
    /** Label text */
    label?: string;
    /** Linear or logarithmic scale */
    scale?: "linear" | "log";
  };
  /** Secondary Y-axis (for dual-axis charts) */
  yAxisRight?: {
    auto?: boolean;
    range?: [number, number];
    format?: string | ((val: number) => string);
    label?: string;
    scale?: "linear" | "log";
    /** Which series keys use the right axis */
    seriesKeys: string[];
  };
  /** LOD configuration */
  lod?: {
    /** Enable LOD (default: true) */
    enabled?: boolean;
    /** Minimum pixels per data point before LOD kicks in (default: 0.5) */
    pixelThreshold?: number;
  };
}

export interface TimeSeriesDef {
  /** Unique key */
  key: string;
  /** Display name */
  label: string;
  /** Data field for Y values */
  field: string;
  /** Line color (CSS color or var(--chart-N) reference) */
  color?: string;
  /** Line style */
  lineStyle?: "solid" | "dashed" | "dotted";
  /** Line width in pixels */
  lineWidth?: number;
  /** Whether to show this series initially */
  visible?: boolean;
  /** Assign to right Y-axis */
  yAxisId?: "left" | "right";
}

export function useTimeSeries(
  options: UseChartOptions<TimeSeriesConfig>
): UseChartReturn<TimeSeriesConfig> & {
  /** Current LOD level per series */
  lodLevels: Map<string, number>;
  /** Visible data range [startTs, endTs] */
  dataRange: [number, number];
  /** Total data range [firstTs, lastTs] including non-visible data */
  fullRange: [number, number];
  /** Number of points actually rendered (after LOD decimation) */
  renderedPointCount: number;
}
```

#### D3.1.2 — `<TimeSeries>` Component (Composition Usage)

```tsx
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartSyncGroup
} from "@pitant/charts-react";

function ProcessTrendChart({ data }: { data: Float64Array }) {
  const containerRef = useRef<ChartContainerRef>(null);

  const chart = useTimeSeries({
    containerRef,
    config: {
      series: [
        { key: "temp", label: "Temperature (°C)", field: "temperature", color: "var(--chart-1)" },
        { key: "pressure", label: "Pressure (bar)", field: "pressure", color: "var(--chart-2)" },
        { key: "flow", label: "Flow Rate (L/s)", field: "flow", color: "var(--chart-3)", lineStyle: "dashed" },
        { key: "vibration", label: "Vibration (g)", field: "vibration", color: "var(--chart-4)", yAxisId: "right" },
      ],
      xAxis: {
        gapThreshold: 5000, // break line if gap > 5 seconds
        format: "HH:mm:ss.SSS",
      },
      yAxis: {
        auto: true,
        label: "Process Values",
      },
      yAxisRight: {
        auto: true,
        label: "Vibration (g)",
        seriesKeys: ["vibration"],
      },
    },
    data,
  });

  return (
    <div className="flex flex-col gap-2">
      <ChartLegend
        items={chart.legendItems}
        onToggle={(key, visible) => chart.toggleSeries(key)}
      />
      <ChartContainer ref={containerRef} className="h-[400px] w-full">
        <ChartTooltip
          payload={chart.tooltipPayload}
          position={chart.tooltipPosition}
        />
      </ChartContainer>
    </div>
  );
}
```

#### D3.1.3 — Renderer Integration (WebGPU + Canvas2D)

```typescript
// Internal: how useTimeSeries() drives the renderer

interface TimeSeriesRendererInput {
  /** Pre-decimated line segments per series (from LOD query) */
  segments: Map<string, LineSegmentBatch>;
  /** Axis layout (tick positions, label strings, pixel bounds) */
  axes: AxisLayout;
  /** Grid layout */
  grid: GridLayout;
  /** Crosshair position (null when not hovering) */
  crosshair: CrosshairState | null;
  /** Resolved CSS variable tokens */
  tokens: ChartTokens;
  /** Canvas dimensions (DPR-scaled) */
  viewport: { width: number; height: number; dpr: number };
}

interface LineSegmentBatch {
  /** Pre-projected screen-space vertices (x, y pairs) */
  vertices: Float32Array;
  /** Gap breaks — indices where the line should restart */
  breaks: Uint32Array;
  /** Color (resolved RGBA) */
  color: [number, number, number, number];
  /** Line width in pixels */
  width: number;
  /** Dash pattern (null for solid) */
  dash: [number, number] | null;
}
```

### Task Checklist

- [ ] **Data Model:** Define `TimeSeriesDataBuffer` — columnar typed arrays for timestamp + N value columns
- [ ] **Data Model:** Implement column accessor by field name (maps series `field` → array column)
- [ ] **LOD Integration:** Wire `useTimeSeries()` to data engine worker LOD queries
- [ ] **LOD Integration:** Implement adaptive LOD level selection: `level = ceil(log2(dataPointCount / viewportPixelWidth))`
- [ ] **LOD Integration:** Validate no visible aliasing — min-max decimation preserves all spikes/valleys
- [ ] **Renderer:** Implement multi-pen batched rendering (single draw call per line style group)
- [ ] **Renderer:** Implement gap-aware line segments — insert break indices where `dt > gapThreshold`
- [ ] **Renderer:** Implement line styles: solid (default), dashed, dotted via shader or Canvas2D `setLineDash`
- [ ] **Renderer:** Implement line width scaling (per-pen, DPR-aware)
- [ ] **Axis System:** Implement time axis with auto-tick selection (ms, s, min, h, day granularity)
- [ ] **Axis System:** Implement time axis label formatting (configurable via `format` string or function)
- [ ] **Axis System:** Implement linear Y-axis with auto-range (nice ticks: round to 1, 2, 5 × 10^n)
- [ ] **Axis System:** Implement log Y-axis (base-10 with decade ticks)
- [ ] **Axis System:** Implement dual Y-axis (left + right) with per-series assignment
- [ ] **Grid System:** Implement horizontal and vertical grid lines with CSS-variable styling
- [ ] **Tooltip Wire-up:** Implement nearest-point lookup (binary search on time, scan visible pens)
- [ ] **Tooltip Wire-up:** Emit `tooltipPayload` + `tooltipPosition` from renderer to hook
- [ ] **Legend Wire-up:** Derive `legendItems` from config + visibility state
- [ ] **Legend Wire-up:** Implement `toggleSeries()` — hide/show pen + trigger re-render
- [ ] **Hook API:** Implement `setVisibleRange()` — clamp to data range, trigger LOD re-query
- [ ] **Hook API:** Implement `visibleRange` state tracking
- [ ] **Hook API:** Implement `stats` (fps, renderTime, renderedPointCount)
- [ ] **Performance:** Verify 8-pen × 1M pts/pen ≥ 30 fps on benchmark
- [ ] **Performance:** Verify single-pen × 100K pts ≥ 60 fps
- [ ] **Performance:** Profile and optimize hot path: viewport query → project → draw
- [ ] **Tests:** Unit tests for LOD level selection, gap detection, axis tick generation
- [ ] **Tests:** Visual regression tests for line rendering (solid, dashed, dotted, gaps, multi-pen)
- [ ] **Tests:** Benchmark test in CI with performance regression gate

### Technical Design Notes

- **Columnar data model** — Data is stored as parallel typed arrays (`Float64Array` for timestamps, `Float64Array` per value column) rather than an array of point objects. This eliminates GC pressure for large datasets, enables zero-copy transfer to the worker, and allows SIMD-friendly iteration for LOD computation.
  
- **LOD level selection algorithm:**
  ```
  dataPointsInView = totalPoints × (viewportTimeRange / totalTimeRange)
  viewportPixels = containerWidthPx
  pointsPerPixel = dataPointsInView / viewportPixels
  
  if pointsPerPixel <= pixelThreshold:
    level = 0 (raw data)
  else:
    level = ceil(log2(pointsPerPixel / pixelThreshold))
    level = clamp(level, 0, maxLODLevel)
  ```
  At each LOD level, data is pre-decimated to min-max pairs per pixel-aligned time bucket. This guarantees that spikes and valleys are never lost.

- **Gap detection** — A gap is detected when `timestamp[i+1] - timestamp[i] > gapThreshold`. The line is broken at these points by inserting a `NaN` marker in the vertex batch (WebGPU vertex shader skips NaN vertices) or by starting a new `moveTo()` in Canvas2D.

- **Time axis tick selection:**
  ```
  viewportDuration → select granularity:
    < 1 s     → ms ticks (1, 2, 5, 10, 20, 50, 100, 200, 500 ms)
    < 1 min   → second ticks (1, 2, 5, 10, 15, 30 s)
    < 1 hr    → minute ticks (1, 2, 5, 10, 15, 30 min)
    < 1 day   → hour ticks (1, 2, 3, 4, 6, 12 hr)
    < 1 week  → day ticks
    else      → week/month ticks
  ```
  Target: 5–12 ticks on screen at any zoom level.

- **Dual Y-axis** — Two independent Y scales are maintained. Series assigned to `yAxisId: "right"` use the right scale. Auto-range is computed per axis. Ticks and labels render on their respective sides. Grid lines come from the primary (left) axis only to avoid visual clutter.

- **Render pipeline (per frame):**
  1. `useTimeSeries()` computes visible time range from `visibleRange`
  2. Posts LOD query to worker: `{ start, end, viewportPixels }`
  3. Worker returns decimated `Float32Array` per series (screen-space projection done on worker for cache locality)
  4. Main thread: axis layout → grid layout → sort pens by z-order → batch segments by line style
  5. Renderer: clear → grid → lines → axes + labels → crosshair
  6. DOM overlay: tooltip, legend (already in DOM)

### Definition of Done

- [ ] 8-pen chart renders at ≥ 30 fps with 1M pts/pen
- [ ] Single-pen renders at ≥ 60 fps with 100K pts
- [ ] LOD transitions are invisible — no popping, no missing peaks
- [ ] Gap detection breaks the line at configurable thresholds
- [ ] Line styles (solid, dashed, dotted) render correctly on WebGPU and Canvas2D
- [ ] Time axis auto-scales from milliseconds to weeks
- [ ] Dual Y-axis works with independent auto-ranging
- [ ] Legend toggle shows/hides individual pens
- [ ] Tooltip shows timestamp + values for all visible pens at cursor position
- [ ] Visual regression tests pass on CI
- [ ] Performance regression gate in CI

---

## E3.2 — Multi-Resolution Data Model API (P0, 21 SP)

### User Stories

1. **As a developer**, I want a typed API to load data from different sources (JSON arrays, typed arrays, streamed chunks) into the chart's data engine.
2. **As a developer**, I want to query a specific time range at the appropriate resolution and get back pre-decimated data without knowing LOD internals.
3. **As a developer**, I want to handle datasets larger than available memory by providing a data source function that fetches on demand.

### Deliverables

#### D3.2.1 — Data Source Interface

```typescript
/** Columnar data format — zero-copy from typed array sources */
export interface ColumnarData {
  /** Timestamps in ascending order (epoch milliseconds or microseconds) */
  timestamps: Float64Array;
  /** Named value columns */
  columns: Record<string, Float64Array>;
  /** Time unit: 'ms' | 'us' | 'ns'. Default: 'ms' */
  timeUnit?: "ms" | "us" | "ns";
}

/** Convert common formats to columnar */
export function toColumnar(input: DataInput): ColumnarData;

/** Supported input formats */
export type DataInput =
  | ColumnarData
  | { timestamp: number; [key: string]: number }[]  // row-oriented JSON
  | ArrayBuffer                                       // raw binary (with schema)
  | Float64Array;                                     // single-column shorthand

/** Schema for raw binary input */
export interface BinarySchema {
  /** Column names in order */
  columns: string[];
  /** Byte type per column (default: float64) */
  types?: ("float32" | "float64" | "int32" | "uint32")[];
  /** Byte order (default: little-endian) */
  littleEndian?: boolean;
}
```

#### D3.2.2 — Viewport Query API

```typescript
/** Query the data engine for a specific time range at appropriate resolution */
export interface ViewportQuery {
  /** Start timestamp (inclusive) */
  start: number;
  /** End timestamp (inclusive) */
  end: number;
  /** Target pixel width of the output (for LOD level selection) */
  targetPixels: number;
  /** Which column keys to include (default: all) */
  columns?: string[];
}

export interface ViewportResult {
  /** Decimated timestamps (min-max pairs for each time bucket) */
  timestamps: Float64Array;
  /** Decimated values per column */
  columns: Record<string, Float64Array>;
  /** LOD level used (0 = raw, higher = more decimated) */
  lodLevel: number;
  /** Total point count in this range at LOD 0 (raw) */
  rawPointCount: number;
  /** Actual point count returned (after decimation) */
  returnedPointCount: number;
  /** Whether this is a partial result (data still loading) */
  partial: boolean;
}

/** Data engine API (runs in Web Worker, exposed via proxy) */
export interface DataEngineAPI {
  /** Load initial data */
  load(data: ColumnarData): Promise<void>;
  /** Append streaming data */
  append(data: ColumnarData): Promise<void>;
  /** Query viewport-appropriate decimated data */
  query(q: ViewportQuery): Promise<ViewportResult>;
  /** Get full data range */
  getRange(): Promise<{ start: number; end: number; pointCount: number }>;
  /** Clear all data */
  clear(): Promise<void>;
  /** Configure streaming mode */
  configureStreaming(config: StreamingConfig): Promise<void>;
}
```

#### D3.2.3 — LOD Pyramid Build Pipeline

```typescript
/** LOD pyramid structure (built in worker, queried per frame) */
interface LODPyramid {
  /** LOD level 0 = raw data */
  levels: LODLevel[];
  /** Build time in ms */
  buildTime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
}

interface LODLevel {
  /** Reduction factor (level 0 = 1, level 1 = 2, level 2 = 4, etc.) */
  factor: number;
  /** Decimated timestamps (bucket boundaries) */
  timestamps: Float64Array;
  /** Per-column min values per bucket */
  mins: Record<string, Float64Array>;
  /** Per-column max values per bucket */
  maxs: Record<string, Float64Array>;
  /** Point count at this level */
  pointCount: number;
}

/**
 * Build LOD pyramid via bottom-up min-max decimation.
 * Each level halves the point count.
 *
 * Level 0: raw data (N points)
 * Level 1: N/2 buckets, each with min + max
 * Level 2: N/4 buckets
 * ...
 * Level K: ceil(log2(N / targetWidth)) where targetWidth ~ 2000 px
 *
 * Total memory: ~2× raw data (geometric series: N + N/2 + N/4 + ... ≈ 2N)
 */
function buildLODPyramid(data: ColumnarData, config: LODConfig): LODPyramid;
```

### Task Checklist

- [ ] **Formats:** Implement `toColumnar()` for row-oriented JSON → columnar conversion
- [ ] **Formats:** Implement `toColumnar()` for raw `ArrayBuffer` with schema → columnar
- [ ] **Formats:** Implement `toColumnar()` for single `Float64Array` shorthand
- [ ] **Formats:** Validate input: check timestamps are ascending, detect duplicates, check NaN
- [ ] **Worker API:** Implement `DataEngineAPI` as a Comlink-style worker proxy
- [ ] **Worker API:** Implement `load()` — transfer data to worker, build LOD pyramid
- [ ] **Worker API:** Implement `query()` — select LOD level, scan time range, return decimated data
- [ ] **Worker API:** Implement `getRange()` — return [firstTs, lastTs, count]
- [ ] **Worker API:** Implement `clear()` — release all data, free memory
- [ ] **LOD Pyramid:** Implement bottom-up min-max decimation
- [ ] **LOD Pyramid:** Validate memory ≤ 2× raw data
- [ ] **LOD Pyramid:** Implement incremental pyramid update for append (don't rebuild from scratch)
- [ ] **LOD Pyramid:** Benchmark pyramid build time: target < 300 ms for 1M points
- [ ] **Transfer:** Use `Transferable` ArrayBuffers for worker ↔ main thread communication
- [ ] **Transfer:** Implement `SharedArrayBuffer` opt-in for zero-copy viewport queries
- [ ] **Tests:** Unit tests for `toColumnar()` (all input formats)
- [ ] **Tests:** Unit tests for LOD pyramid (level counts, min-max correctness, boundary cases)
- [ ] **Tests:** Unit tests for viewport query (edge cases: empty range, single point, full range, LOD boundary)
- [ ] **Tests:** Benchmark test for LOD build + query times at 100K, 1M, 10M points

### Technical Design Notes

- **Why columnar?** — Column-oriented storage enables cache-friendly sequential access. When the renderer only needs timestamps + one value column for LOD, it reads two contiguous arrays instead of striding through an AoS (Array of Structures). This matters at 1M+ points.

- **Transferable vs SharedArrayBuffer:**
  - `Transferable`: default mode. Worker builds result, transfers ownership to main thread. Zero-copy but the worker can't re-use the buffer.
  - `SharedArrayBuffer`: opt-in (requires `Cross-Origin-Isolation` headers). Worker writes to shared buffer, main thread reads without transfer. Better for streaming where the same buffer is updated repeatedly.
  - The API abstracts this: `DataEngineAPI.query()` returns the same `ViewportResult` regardless of transfer mode.

- **Incremental LOD update on append:**
  - When new data is appended (streaming), only the affected LOD level buckets need updating.
  - Level 0 just appends raw data.
  - Level K: if the append fills the current bucket, emit min/max for that bucket and start a new one. If not, update running min/max.
  - This makes append O(log K) per sample instead of O(N) re-build.

- **Large dataset support (future-proofing):**
  - For V1, all data lives in worker memory. The `DataEngineAPI` interface supports a future `fetch-on-demand` pattern where `load()` accepts a `DataSource` function instead of raw data.
  - This would enable lazy fetching from REST APIs, WebSocket streams, or IndexedDB.
  - Not implemented in V1, but the API shape accommodates it without breaking changes.

### Definition of Done

- [ ] `toColumnar()` converts JSON, ArrayBuffer, Float64Array correctly
- [ ] LOD pyramid builds in < 300 ms for 1M points
- [ ] LOD pyramid memory ≤ 2× raw data
- [ ] Viewport query returns correct min-max decimated data at all zoom levels
- [ ] Incremental pyramid update works for streaming append
- [ ] Transferable ArrayBuffer mode works (default)
- [ ] SharedArrayBuffer mode works (opt-in)
- [ ] Edge cases handled: empty data, single point, identical timestamps, NaN values
- [ ] All tests pass with ≥ 95% coverage on data engine code

---

## E3.3 — Streaming Engine (Ring Buffer, Live Edge) (P0, 21 SP)

### User Stories

1. **As a developer**, I want to call `chart.append(newData)` and have the chart update in real time without re-loading all data.
2. **As a developer**, I want a "live edge" mode where the chart automatically scrolls to show the latest data.
3. **As a developer**, I want to configure a maximum buffer size so memory doesn't grow unbounded during long sessions.
4. **As a developer**, I want to pause live scrolling (to inspect historical data) and resume without losing data.

### Deliverables

#### D3.3.1 — Ring Buffer Implementation

```typescript
export interface RingBufferConfig {
  /** Maximum number of points per column */
  capacity: number;
  /** Number of value columns */
  columnCount: number;
  /** Column names */
  columnNames: string[];
  /** What to do when buffer is full: 'overwrite' | 'drop-oldest' | 'grow' */
  overflowPolicy: "overwrite" | "drop-oldest" | "grow";
  /** Maximum capacity when policy is 'grow' */
  maxCapacity?: number;
}

/**
 * Lock-free ring buffer for streaming time-series data.
 * Stores columnar typed arrays in a circular fashion.
 *
 * Memory layout per column:
 *   [slot_0, slot_1, ..., slot_{capacity-1}]
 *   head → oldest valid slot (read pointer)
 *   tail → next write slot (write pointer)
 *
 * When tail wraps around and hits head, oldest data is overwritten
 * and head advances.
 */
export class TimeSeriesRingBuffer {
  readonly timestamps: Float64Array;
  readonly columns: Map<string, Float64Array>;
  
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(config: RingBufferConfig);

  /** Append new samples. Returns number of samples that were overwritten (evicted). */
  append(timestamps: Float64Array, values: Record<string, Float64Array>): number;

  /** Read a contiguous slice [startIndex, endIndex) as new typed arrays */
  slice(start: number, end: number): ColumnarData;

  /** Current valid data range */
  getRange(): { start: number; end: number; count: number };

  /** Clear buffer */
  clear(): void;
  
  /** Current fill level (0.0 – 1.0) */
  get fillLevel(): number;

  /** Memory usage in bytes */
  get memoryUsage(): number;
}
```

#### D3.3.2 — Streaming Controller

```typescript
export interface StreamingConfig {
  /** Ring buffer capacity (points per column) */
  bufferSize: number;
  /** Overflow policy */
  overflowPolicy: "overwrite" | "grow";
  /** Enable live edge (auto-scroll to latest data) */
  liveEdge: boolean;
  /** Viewport window size in data-space units (ms) */
  windowSize: number;
  /** Backpressure: max pending appends before throttling */
  maxPendingAppends?: number;
  /** Append batch size (accumulate samples before sending to worker) */
  batchSize?: number;
  /** Batch flush interval in ms */
  batchInterval?: number;
}

export interface StreamingController {
  /** Append new data */
  append(data: ColumnarData): void;
  /** Pause live edge (keep collecting data, stop auto-scrolling) */
  pause(): void;
  /** Resume live edge */
  resume(): void;
  /** Whether live edge is active */
  readonly isLive: boolean;
  /** Whether data is being dropped due to backpressure */
  readonly isBackpressured: boolean;
  /** Current buffer fill level (0.0 – 1.0) */
  readonly fillLevel: number;
  /** Total samples received since start */
  readonly totalReceived: number;
  /** Total samples dropped since start */
  readonly totalDropped: number;
  /** Destroy and release resources */
  dispose(): void;
}
```

#### D3.3.3 — Live Edge UX

```tsx
// Usage in a component
function LiveProcessMonitor({ wsUrl }: { wsUrl: string }) {
  const containerRef = useRef<ChartContainerRef>(null);

  const chart = useTimeSeries({
    containerRef,
    config: {
      series: [
        { key: "temp", label: "Temperature", field: "temperature", color: "var(--chart-1)" },
        { key: "pressure", label: "Pressure", field: "pressure", color: "var(--chart-2)" },
      ],
      xAxis: { format: "HH:mm:ss.SSS" },
      yAxis: { auto: true },
    },
    streaming: {
      enabled: true,
      windowSize: 30_000, // 30 second window
      liveEdge: true,
      bufferSize: 100_000, // keep last 100K points per series
    },
  });

  // Connect WebSocket and feed data
  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onmessage = (e) => {
      const data = decodeBinaryMessage(e.data);
      chart.append(data);
    };
    return () => ws.close();
  }, [wsUrl, chart.append]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <ChartLegend items={chart.legendItems} onToggle={(k, v) => chart.toggleSeries(k)} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {chart.streaming?.isLive ? (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live
            </span>
          ) : (
            <button onClick={() => chart.streaming?.resume()} className="text-primary underline">
              Resume Live
            </button>
          )}
        </div>
      </div>
      <ChartContainer ref={containerRef} className="h-[300px] w-full">
        <ChartTooltip payload={chart.tooltipPayload} position={chart.tooltipPosition} />
      </ChartContainer>
    </div>
  );
}
```

### Task Checklist

- [ ] **Ring Buffer:** Implement `TimeSeriesRingBuffer` with circular write/read
- [ ] **Ring Buffer:** Implement `overwrite` policy (head advances when tail wraps)
- [ ] **Ring Buffer:** Implement `grow` policy (double capacity up to maxCapacity)
- [ ] **Ring Buffer:** Implement `slice()` for contiguous reads across wrap boundary
- [ ] **Ring Buffer:** Pre-allocate all memory at construction (no allocation in append hot path)
- [ ] **Streaming Controller:** Implement append batching (accumulate → flush on interval or batch size)
- [ ] **Streaming Controller:** Implement backpressure detection and warning
- [ ] **Streaming Controller:** Implement pause/resume live edge
- [ ] **Streaming Controller:** On pause: new data still appended to buffer, viewport stays put
- [ ] **Streaming Controller:** On resume: viewport jumps to live edge, resumes auto-scroll
- [ ] **LOD Integration:** Incremental LOD pyramid update on each batch flush
- [ ] **LOD Integration:** Ring buffer eviction cascades to LOD pyramid (trim oldest buckets)
- [ ] **Renderer Integration:** Live edge auto-scroll: `visibleRange = [now - windowSize, now]`
- [ ] **Renderer Integration:** Only re-render dirty region (viewport-local redraw optimization)
- [ ] **Performance:** Append overhead < 10 µs per sample at hot path
- [ ] **Performance:** Zero allocation in append hot path (verify with DevTools profiler)
- [ ] **Performance:** 10 Hz append (100 samples/s/pen) × 8 pens sustains ≥ 60 fps
- [ ] **Tests:** Ring buffer: basic append/read, overflow, wrap-around, grow, slice across boundary
- [ ] **Tests:** Streaming controller: pause/resume, backpressure, batch flush timing
- [ ] **Tests:** Integration: WebSocket feed → append → render → verify latest data visible
- [ ] **Tests:** Load test: 10 kHz × 8 pens for 60 seconds — no crash, memory stable

### Technical Design Notes

- **Ring buffer design** — Pre-allocated `Float64Array` per column with circular index. `head` and `tail` track the valid data window. No object allocation on append — just `TypedArray[index] = value`. This is critical for 10 kHz streaming without GC pauses.

- **Append batching** — Raw samples from WebSocket/MQTT arrive individually but triggering a worker message per sample is wasteful. The streaming controller accumulates samples in a staging buffer and flushes when:
  - Batch reaches `batchSize` (e.g., 100 samples), OR
  - `batchInterval` ms elapsed since last flush (e.g., 16 ms = 1 frame)
  - Whichever comes first. This amortizes worker message cost.

- **Live edge auto-scroll** — When `liveEdge === true`, each frame sets `visibleRange = [latestTimestamp - windowSize, latestTimestamp]`. When user pans/zooms, `liveEdge` automatically pauses. A "Resume Live" button re-enables.

- **Viewport-local redraw** — When appending in live mode, only the right edge of the chart has new data. The renderer can skip re-rendering the entire chart. With WebGPU, this means updating only the last few vertices in the line geometry buffer. With Canvas2D, we can clip the draw to the dirty region.

- **Backpressure** — If the rate of `append()` calls exceeds the render rate, samples back up. The controller tracks pending appends and emits `isBackpressured: true` when the queue exceeds `maxPendingAppends`. The chart can display a warning icon. Actual data is never dropped — the ring buffer's overflow policy handles capacity limits.

### Definition of Done

- [ ] Ring buffer append works at 10 kHz × 8 columns for 60 seconds without crash or memory growth
- [ ] Append overhead < 10 µs per sample (no GC pauses)
- [ ] Live edge auto-scrolls smoothly at ≥ 60 fps
- [ ] Pause/resume live edge preserves all buffered data
- [ ] Ring buffer overflow correctly evicts oldest data
- [ ] LOD pyramid stays consistent after streaming appends and evictions
- [ ] Backpressure detection works and doesn't drop data
- [ ] Memory stays bounded at configured buffer capacity
- [ ] Integration test with WebSocket feed passes

---

## E3.4 — DigitalChannel Line Chart (P0, 13 SP)

### User Stories

1. **As a developer**, I want to render a digital/binary channel chart that shows discrete state transitions (high/low, on/off, open/closed) as a staircase waveform.
2. **As a developer**, I want to render up to 16 digital channels stacked vertically in a single chart area.
3. **As a developer**, I want each channel to show a label and its current state, with customizable state names and colors.

### Deliverables

#### D3.4.1 — `useDigitalChannel()` Hook

```typescript
export interface DigitalChannelConfig {
  /** Channel definitions */
  channels: DigitalChannelDef[];
  /** X-axis configuration (shared with TimeSeries) */
  xAxis: {
    format?: string | ((ts: number) => string);
    gapThreshold?: number;
  };
  /** Layout: how channels are arranged vertically */
  layout?: {
    /** Height per channel in pixels (default: 24) */
    channelHeight?: number;
    /** Gap between channels in pixels (default: 2) */
    channelGap?: number;
    /** Show channel labels on left (default: true) */
    showLabels?: boolean;
    /** Label width in pixels (default: 120) */
    labelWidth?: number;
  };
}

export interface DigitalChannelDef {
  /** Unique key */
  key: string;
  /** Display label */
  label: string;
  /** Data field (value is interpreted as: 0 = low, non-zero = high) */
  field: string;
  /** Color when high/active */
  colorHigh?: string;
  /** Color when low/inactive */
  colorLow?: string;
  /** State name when high (tooltip display) */
  stateHigh?: string;
  /** State name when low (tooltip display) */
  stateLow?: string;
  /** Whether initially visible */
  visible?: boolean;
}

export function useDigitalChannel(
  options: UseChartOptions<DigitalChannelConfig>
): UseChartReturn<DigitalChannelConfig> & {
  /** Current state per channel (latest value) */
  currentStates: Map<string, boolean>;
}
```

#### D3.4.2 — Staircase Rendering

```typescript
/**
 * Digital channels use staircase (step) rendering:
 * 
 *    ┌───────┐       ┌─────┐
 *    │       │       │     │
 * ───┘       └───────┘     └───
 *
 * Each transition generates two vertices:
 *   [t_transition, old_value] → [t_transition, new_value]
 *
 * Rendering as filled rectangles for visibility:
 *   - High state: filled rectangle from baseline to channelHeight
 *   - Low state: thin line at baseline
 *
 * Color encodes state (green = active, gray = inactive, or custom).
 */
interface DigitalChannelRenderer {
  render(
    channels: DigitalChannelDef[],
    data: ColumnarData,
    viewport: { width: number; height: number; dpr: number },
    tokens: ChartTokens,
    layout: DigitalLayout
  ): void;
}

interface DigitalLayout {
  /** Y-position per channel (top of channel band) */
  channelTops: number[];
  /** Height per channel in pixels */
  channelHeight: number;
  /** X-axis pixel range */
  xRange: [number, number];
  /** Time range */
  timeRange: [number, number];
}
```

#### D3.4.3 — Composition with TimeSeries

```tsx
// DigitalChannel composed alongside TimeSeries in a SyncGroup
function ProcessOverviewChart({ analogData, digitalData }: Props) {
  const analogRef = useRef<ChartContainerRef>(null);
  const digitalRef = useRef<ChartContainerRef>(null);

  const analog = useTimeSeries({
    containerRef: analogRef,
    config: {
      series: [
        { key: "temp", label: "Temperature", field: "temp", color: "var(--chart-1)" },
        { key: "pressure", label: "Pressure", field: "pressure", color: "var(--chart-2)" },
      ],
      xAxis: { format: "HH:mm:ss" },
      yAxis: { auto: true },
    },
    data: analogData,
  });

  const digital = useDigitalChannel({
    containerRef: digitalRef,
    config: {
      channels: [
        { key: "valve1", label: "Valve 1", field: "valve1", stateHigh: "Open", stateLow: "Closed" },
        { key: "valve2", label: "Valve 2", field: "valve2", stateHigh: "Open", stateLow: "Closed" },
        { key: "pump", label: "Main Pump", field: "pump", stateHigh: "Running", stateLow: "Stopped" },
        { key: "alarm", label: "Alarm", field: "alarm", stateHigh: "Active", stateLow: "Clear",
          colorHigh: "hsl(0, 80%, 55%)" },
      ],
      xAxis: { format: "HH:mm:ss" },
    },
    data: digitalData,
  });

  return (
    <ChartSyncGroup sync={["cursor", "xRange"]}>
      <div className="flex flex-col gap-1">
        <ChartContainer ref={analogRef} className="h-[300px]">
          <ChartTooltip payload={analog.tooltipPayload} position={analog.tooltipPosition} />
        </ChartContainer>
        <ChartContainer ref={digitalRef} className="h-[120px]">
          <ChartTooltip
            payload={digital.tooltipPayload}
            position={digital.tooltipPosition}
          >
            {(p) => (
              <div className="space-y-1">
                <div className="font-medium">{p.label}</div>
                {p.series.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.label}:</span>
                    <span className="font-medium">{s.formatted}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartTooltip>
        </ChartContainer>
        <ChartLegend
          items={[...analog.legendItems, ...digital.legendItems]}
          onToggle={(key, visible) => {
            analog.toggleSeries(key);
            digital.toggleSeries(key);
          }}
        />
      </div>
    </ChartSyncGroup>
  );
}
```

### Task Checklist

- [ ] **Hook:** Implement `useDigitalChannel()` — extends `useChart()` with digital-specific config
- [ ] **Renderer:** Implement staircase waveform rendering (WebGPU + Canvas2D)
- [ ] **Renderer:** Implement filled rectangle mode for high-state visibility
- [ ] **Renderer:** Implement vertical stacking with configurable height per channel
- [ ] **Renderer:** Implement channel labels (left side, aligned to channel bands)
- [ ] **LOD:** Implement digital LOD — at zoom-out, collapse to "has-transition" buckets
- [ ] **Tooltip:** Show state name (e.g., "Open" / "Closed") instead of numeric value
- [ ] **Tooltip:** Show transition timestamp at nearest edge
- [ ] **Current State:** Derive `currentStates` map for latest value per channel
- [ ] **Streaming:** Wire to streaming engine — same append/ring buffer as TimeSeries
- [ ] **Sync:** Verify cursor sync between TimeSeries and DigitalChannel in same SyncGroup
- [ ] **Performance:** 16 channels render at ≥ 30 fps
- [ ] **Style:** CSS variables for high/low colors, channel border, label font
- [ ] **Accessibility:** Channel names and states exposed via data table fallback
- [ ] **Tests:** Staircase rendering visual regression test
- [ ] **Tests:** State transition detection at various zoom levels
- [ ] **Tests:** 16-channel performance benchmark

### Technical Design Notes

- **Staircase vs interpolated** — Digital signals are step functions. The renderer draws horizontal-then-vertical transitions (staircase) rather than interpolating between points. This correctly represents digital signals where the value is constant between transitions.

- **Digital LOD** — At extreme zoom-out, individual transitions may be sub-pixel. The digital LOD collapses to "activity" density: each time bucket records whether any transition occurred. If yes, draw a filled block. If no, draw flat high or low. This prevents aliasing and preserves the "busy" visual without needing per-transition detail.

- **Channel layout** — Channels are stacked vertically with independent Y bands. The Y-axis is binary (0/1) stretched to `channelHeight` pixels. Labels render in a fixed-width column to the left. The time axis is shared and can sync with a companion TimeSeries chart.

- **State names** — The tooltip shows human-readable state names (e.g., "Valve 1: Open") instead of raw values. This makes digital channels self-documenting in the UI.

### Definition of Done

- [ ] 16 digital channels render at ≥ 30 fps
- [ ] Staircase waveform renders correctly (no interpolation, clean transitions)
- [ ] Channel labels align to their bands
- [ ] Tooltip shows state name, not numeric value
- [ ] Cursor sync works between DigitalChannel and TimeSeries in SyncGroup
- [ ] Streaming append works (live edge mode)
- [ ] CSS variables control all visual properties
- [ ] Visual regression tests pass
- [ ] axe-core 0 violations

---

## Consolidated Weekly Summary

### Week 11: TimeSeries Core + Data Model

| Day | Tasks |
|---|---|
| Mon–Tue | E3.2: Define `ColumnarData` interface, implement `toColumnar()` for all input formats |
| Wed–Thu | E3.2: Implement viewport query API, wire to existing LOD pyramid from Phase 1 |
| Fri | E3.1: Implement `TimeSeriesDataBuffer` columnar storage, column accessors |

### Week 12: LOD Integration + Axis System

| Day | Tasks |
|---|---|
| Mon | E3.2: LOD pyramid incremental update for append, Transferable ArrayBuffer mode |
| Tue–Wed | E3.1: Time axis auto-tick selection (ms → weeks), label formatting |
| Thu | E3.1: Linear + log Y-axis, auto-range (nice ticks), dual Y-axis support |
| Fri | E3.1: Grid system (horizontal + vertical) with CSS variable styling |

### Week 13: Multi-Pen Rendering + Gap Detection

| Day | Tasks |
|---|---|
| Mon–Tue | E3.1: Multi-pen batched rendering (WebGPU: instanced geometry, Canvas2D: iterated draw) |
| Wed | E3.1: Gap detection + line break at threshold, NaN marker in vertex batch |
| Thu | E3.1: Line styles (solid, dashed, dotted), line width (DPR-aware) |
| Fri | E3.1: Tooltip nearest-point lookup, legend wire-up, `toggleSeries()` |

### Week 14: Streaming Engine

| Day | Tasks |
|---|---|
| Mon–Tue | E3.3: Ring buffer implementation (pre-allocated, circular, overflow policies) |
| Wed | E3.3: Streaming controller (append batching, backpressure) |
| Thu | E3.3: Live edge auto-scroll, pause/resume, viewport-local redraw |
| Fri | E3.3: LOD cascade on eviction, incremental pyramid update |

### Week 15: DigitalChannel + Integration

| Day | Tasks |
|---|---|
| Mon–Tue | E3.4: Staircase renderer, filled rectangle mode, channel stacking |
| Wed | E3.4: Channel labels, digital LOD, state tooltip, streaming wire-up |
| Thu | E3.4: Sync group integration (cursor + xRange sync with TimeSeries) |
| Fri | Integration: compose all Phase 2 primitives + Phase 3 charts — demo page |

### Week 16: Performance Optimization + Hardening

| Day | Tasks |
|---|---|
| Mon | Performance profiling: 8-pen × 1M pts benchmark vs KPIs |
| Tue | Optimize hot path: LOD query → project → draw (identify bottlenecks) |
| Wed | Memory profiling: verify ≤ 200 MB for 8-pen × 1M pts, zero leaks in streaming |
| Thu | Visual regression tests, bundle size verification |
| Fri | Phase exit checklist, performance regression gate in CI |

---

## Phase 3 Exit Checklist

- [ ] **E3.1** TimeSeries: 8-pen × 1M pts ≥ 30 fps. Single-pen 100K ≥ 60 fps. LOD smooth. Gaps break correctly. Line styles work. Dual Y-axis works. Tooltip + legend wire-up complete.
- [ ] **E3.2** Data Model: `toColumnar()` handles JSON, ArrayBuffer, Float64Array. LOD pyramid < 300 ms build @ 1M. Viewport query returns correct decimated data. Incremental update on append works. Memory ≤ 2× raw.
- [ ] **E3.3** Streaming: Ring buffer at 10 kHz × 8 columns for 60 s — no crash, bounded memory. Append < 10 µs. Live edge ≥ 60 fps. Pause/resume works. Backpressure detection works.
- [ ] **E3.4** DigitalChannel: 16 channels ≥ 30 fps. Staircase rendering correct. State tooltip. Cursor sync with TimeSeries. Streaming works.
- [ ] **Cross-cutting**: axe-core 0 violations. Biome lint 0 errors. `tsc --noEmit` 0 errors. Visual regression CI green. Performance regression CI green.
- [ ] **Demo page**: Full composition — TimeSeries + DigitalChannel + Legend + Tooltip + SyncGroup — with both static and streaming data.
