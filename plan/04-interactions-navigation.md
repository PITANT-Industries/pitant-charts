# Phase 4 — Interactions & Navigation

**Weeks:** 17–20  
**Epics:** 5 (E4.1 – E4.5)  
**Story Points:** 42  
**Phase Goal:** Equip the TimeSeries and DigitalChannel charts with professional-grade interactions: region zoom, pan/scroll, hover crosshair with snap tooltip, DataZoom slider with minimap, and linked cursor/zoom sync across charts. After this phase, the line chart *feels* production-ready.

**Phase KPIs:**

| KPI | Target | Measurement |
|---|---|---|
| Zoom interaction latency (pointer → re-render) | < 16 ms (1 frame @ 60 fps) | Performance.mark in Playwright |
| Pan smoothness at 1M points | ≥ 30 fps sustained | rAF delta |
| DataZoom slider ↔ main chart sync latency | < 1 frame | Performance.mark |
| Cursor sync propagation across 4 charts | < 1 frame | Performance.mark |
| Keyboard zoom/pan responsiveness | < 16 ms per key repeat | Performance.mark |
| Interaction FPS during streaming (10 Hz, 8 pens) | ≥ 30 fps | rAF delta |
| TouchEvent support (mobile zoom/pan) | Works on iOS Safari / Android Chrome | Manual + Playwright |
| Zero interaction-related memory leaks after 1000 zoom/pan cycles | ≤ 0% growth | `measureUserAgentSpecificMemory()` |

**Entry Criteria:** Phase 3 exit — 8-pen TimeSeries renders ≥ 30 fps at 1M pts/pen; streaming ≥ 60 fps at 10 Hz; DigitalChannel 16 channels working; tooltip + legend wire-up complete.  
**Exit Criteria:** All 5 interaction modes work on TimeSeries with 1M points. DataZoom slider syncs with main chart bidirectionally. Cursor syncs across 4 charts in a SyncGroup. All interactions work during live streaming. Touch support on mobile.

---

## E4.1 — Region Zoom & Axis-Constrained Zoom (P0, 8 SP)

### User Stories

1. **As a user**, I want to click-and-drag on the chart to select a rectangular region and zoom into it.
2. **As a user**, I want to hold Shift while dragging to constrain the zoom to X-axis only (time zoom) or Y-axis only (value zoom).
3. **As a user**, I want to double-click to reset the zoom to the full data range.
4. **As a developer**, I want programmatic zoom control via `chart.zoomTo(range)` and `chart.resetZoom()`.

### Deliverables

#### D4.1.1 — Zoom Gesture Recognizer

```typescript
export interface ZoomGestureConfig {
  /** Minimum drag distance in pixels before zoom activates */
  minDragPx?: number; // default: 5
  /** Key modifiers for axis constraint */
  xOnlyModifier?: "Shift" | "Alt" | "Meta"; // default: Shift
  yOnlyModifier?: "Shift" | "Alt" | "Meta"; // default: Alt
  /** Enable scroll wheel zoom */
  wheelZoom?: boolean; // default: true
  /** Scroll wheel zoom sensitivity (0.01 – 0.5) */
  wheelSensitivity?: number; // default: 0.1
  /** Enable pinch-to-zoom on touch devices */
  pinchZoom?: boolean; // default: true
  /** Enable double-click to reset */
  doubleClickReset?: boolean; // default: true
}

/**
 * Internal gesture state machine:
 *
 *   IDLE ──mousedown──► DRAG_PENDING ──(minDragPx exceeded)──► DRAGGING
 *   DRAGGING ──mouseup──► ZOOM_COMMIT ──(apply zoom)──► IDLE
 *   DRAG_PENDING ──mouseup──► IDLE (no action, was just a click)
 *
 * During DRAGGING:
 *   - Render selection rectangle overlay (rubber-band)
 *   - Read modifier keys to determine constraint axis
 *   - Snap rectangle edges to data coordinates
 */
```

#### D4.1.2 — Zoom Selection Overlay

```typescript
/** Rubber-band selection rectangle rendered via DOM overlay */
interface ZoomSelectionOverlay {
  /** Current selection in CSS pixels */
  rect: { x: number; y: number; width: number; height: number } | null;
  /** Constraint mode */
  mode: "free" | "x-only" | "y-only";
  /** Style: semi-transparent fill + dashed border */
  className?: string;
}

// Default styles (CSS variables):
// --chart-zoom-fill: hsl(var(--primary) / 0.1)
// --chart-zoom-border: hsl(var(--primary) / 0.4)
// --chart-zoom-border-style: dashed
```

#### D4.1.3 — Programmatic Zoom API

```typescript
// Added to UseChartReturn
interface ZoomAPI {
  /** Zoom to a specific data range */
  zoomTo(range: { x?: [number, number]; y?: [number, number] }): void;
  /** Reset to full data range */
  resetZoom(): void;
  /** Get current zoom range */
  getZoomRange(): { x: [number, number]; y: [number, number] };
  /** Whether chart is currently zoomed (not at full range) */
  isZoomed: boolean;
}
```

### Task Checklist

- [ ] **Gesture:** Implement mouse-based drag gesture recognizer with state machine (IDLE → DRAG_PENDING → DRAGGING → COMMIT)
- [ ] **Gesture:** Implement minimum drag threshold (5 px) to distinguish click from drag
- [ ] **Gesture:** Read modifier keys during drag for axis constraint (Shift = X-only, Alt = Y-only)
- [ ] **Gesture:** Implement scroll wheel zoom (centered on cursor position)
- [ ] **Gesture:** Implement pinch-to-zoom for touch devices (iOS Safari + Android Chrome)
- [ ] **Gesture:** Implement double-click to reset zoom
- [ ] **Overlay:** Render rubber-band selection rectangle via DOM overlay (not canvas)
- [ ] **Overlay:** Style overlay with CSS variables (`--chart-zoom-fill`, `--chart-zoom-border`)
- [ ] **Overlay:** Constrained mode: X-only = full height, Y-only = full width
- [ ] **Conversion:** Convert pixel rectangle → data range (screen-to-data coordinate mapping)
- [ ] **Application:** On zoom commit: update `visibleRange`, trigger LOD re-query
- [ ] **Application:** Animate zoom transition (ease-out, ~150 ms) for visual smoothness
- [ ] **API:** Implement `zoomTo()`, `resetZoom()`, `getZoomRange()`, `isZoomed`
- [ ] **Performance:** Zoom latency < 16 ms (pixel → data conversion → LOD query → render)
- [ ] **Edge Cases:** Prevent zoom to zero-width or zero-height range
- [ ] **Edge Cases:** Clamp zoom range to data bounds
- [ ] **Tests:** Unit test coordinate conversion (screen ↔ data)
- [ ] **Tests:** Integration test zoom gesture with Playwright (drag → verify range)
- [ ] **Tests:** Touch gesture test on mobile viewport (Playwright emulation)

### Technical Design Notes

- **Screen-to-data mapping** — A linear transform converts between pixel coordinates and data coordinates. For time axis: `t = t_start + (px - x_start) / (x_end - x_start) * (t_end - t_start)`. For log Y-axis: `v = 10^(log10(v_start) + (py - y_start) / (y_end - y_start) * (log10(v_end) - log10(v_start)))`.

- **Zoom animation** — On commit, interpolate `visibleRange` from old to new over ~150 ms using `requestAnimationFrame`. This prevents jarring jumps and gives the LOD system a frame to catch up. The animation uses `ease-out` timing.

- **Wheel zoom centering** — Scroll zoom expands/contracts the visible range centered on the cursor position. If cursor is at 70% of the viewport, the range shrinks with 70% of the change on the left side and 30% on the right. This feels natural.

### Definition of Done

- [ ] Click-drag creates a selection rectangle and zooms to it
- [ ] Shift+drag constrains to X-axis, Alt+drag constrains to Y-axis
- [ ] Scroll wheel zooms centered on cursor
- [ ] Pinch-to-zoom works on touch devices
- [ ] Double-click resets zoom
- [ ] Zoom latency < 16 ms
- [ ] `zoomTo()` and `resetZoom()` programmatic API works
- [ ] Zoom animation plays smoothly (ease-out, ~150 ms)
- [ ] Works correctly with 1M points (LOD re-query on zoom)

---

## E4.2 — Pan, Scroll & Keyboard Navigation (P0, 5 SP)

### User Stories

1. **As a user**, I want to middle-click drag (or two-finger drag on trackpad) to pan the chart viewport.
2. **As a user**, I want to navigate the chart entirely with keyboard: arrow keys to move, +/- to zoom, Home/End for data range.
3. **As a developer**, I want to constrain pan to data bounds so users can't scroll into empty space.

### Deliverables

#### D4.2.1 — Pan Gesture Recognizer

```typescript
export interface PanGestureConfig {
  /** Enable middle-click drag pan */
  middleClickPan?: boolean; // default: true
  /** Enable two-finger trackpad pan */
  trackpadPan?: boolean; // default: true
  /** Enable touch drag pan (one finger on mobile) */
  touchPan?: boolean; // default: true
  /** Constrain to data bounds (no panning beyond data range) */
  clampToData?: boolean; // default: true
  /** Momentum / inertia after release (pixels/frame deceleration) */
  inertia?: boolean; // default: true
  /** Inertia friction coefficient (0 = none, 1 = instant stop) */
  friction?: number; // default: 0.92
}
```

#### D4.2.2 — Keyboard Navigation

```typescript
/**
 * Keyboard shortcuts (active when chart has focus):
 *
 * Arrow Left / Right → pan X by 10% of viewport width
 * Arrow Up / Down → pan Y by 10% of viewport height
 * Shift + Arrow → pan by 50% of viewport (fast pan)
 * +/= → zoom in 20%
 * -/_ → zoom out 20%
 * Home → jump to start of data
 * End → jump to end of data
 * Ctrl+0 / Cmd+0 → reset zoom to full range
 * Escape → cancel current gesture (zoom drag, etc.)
 *
 * Focus management:
 * - Chart receives focus on click
 * - Tab moves between chart regions (legend, chart area, DataZoom)
 * - aria-label announces current view range on focus
 */
```

### Task Checklist

- [ ] **Pan:** Implement middle-click drag pan (track `button === 1`)
- [ ] **Pan:** Implement trackpad two-finger scroll pan (detect `WheelEvent` without Ctrl/Meta)
- [ ] **Pan:** Implement touch drag pan (one finger, with touchstart/touchmove/touchend)
- [ ] **Pan:** Implement inertia (momentum after release, decelerate via friction)
- [ ] **Pan:** Clamp pan to data bounds (don't scroll past first/last data point)
- [ ] **Pan:** Update `visibleRange` during pan → trigger LOD re-query
- [ ] **Keyboard:** Arrow keys pan by 10% of viewport (Shift = 50%)
- [ ] **Keyboard:** +/- zoom in/out by 20% centered on viewport center
- [ ] **Keyboard:** Home/End jump to data start/end
- [ ] **Keyboard:** Ctrl+0 / Cmd+0 reset zoom
- [ ] **Keyboard:** Escape cancels active gesture
- [ ] **Focus:** Chart area receives `tabIndex={0}`, gains focus on click
- [ ] **Focus:** `aria-label` announces current time range on focus
- [ ] **Focus:** Visual focus ring (CSS outline) follows `var(--ring)` token
- [ ] **Performance:** Pan at ≥ 30 fps with 1M points during inertia
- [ ] **Tests:** Playwright test: middle-click drag pan
- [ ] **Tests:** Keyboard navigation test (Tab into chart, arrow keys, +/-, Home/End)
- [ ] **Tests:** Touch pan test (Playwright mobile emulation)

### Technical Design Notes

- **Gesture disambiguation** — With zoom (click-drag), pan (middle-drag or two-finger), and tooltip (hover) all active, the gesture recognizer uses a priority system:
  - Left-click drag → zoom selection
  - Middle-click drag → pan
  - Two-finger drag / trackpad scroll → pan
  - Hover (no button) → tooltip
  - Touch: one finger starts in "pending" mode; if starts moving → pan; if holds still → tooltip

- **Inertia** — On pointer release, record velocity (px/frame). Each subsequent frame: `velocity *= friction; position += velocity`. Stop when `|velocity| < 0.5 px`. This provides a natural "throw" feel.

- **Pan during streaming** — When in live edge mode, panning in the negative direction (toward history) automatically pauses live edge. Panning back to the latest data resumes live edge.

### Definition of Done

- [ ] Middle-click drag pans the chart
- [ ] Two-finger trackpad scroll pans the chart
- [ ] Inertia provides smooth deceleration after pan release
- [ ] Pan stays within data bounds
- [ ] All keyboard shortcuts work when chart has focus
- [ ] Focus ring is visible and styled via CSS token
- [ ] Pan at ≥ 30 fps with 1M points
- [ ] Pan during streaming pauses/resumes live edge correctly

---

## E4.3 — Hover Crosshair & Snap Tooltip (P0, 8 SP)

### User Stories

1. **As a user**, I want a vertical crosshair line that follows my cursor across the chart.
2. **As a user**, I want the crosshair to snap to the nearest actual data point on each visible pen.
3. **As a user**, I want to see a tooltip showing the timestamp and values for all visible pens at the crosshair position.
4. **As a user**, I want indicator dots on each pen where the crosshair intersects the data.

### Deliverables

#### D4.3.1 — Crosshair Rendering

```typescript
export interface CrosshairConfig {
  /** Show vertical crosshair line */
  vertical?: boolean; // default: true
  /** Show horizontal crosshair line */
  horizontal?: boolean; // default: false
  /** Snap to nearest data point */
  snap?: boolean; // default: true
  /** Crosshair line style */
  lineStyle?: "solid" | "dashed" | "dotted"; // default: dashed
  /** Show indicator dots on series at crosshair position */
  showDots?: boolean; // default: true
  /** Dot radius in pixels */
  dotRadius?: number; // default: 4
}

// CSS variables:
// --chart-crosshair-color: hsl(var(--foreground) / 0.5)
// --chart-crosshair-width: 1px
// --chart-crosshair-dot-border: 2px solid hsl(var(--background))
```

#### D4.3.2 — Snap-to-Nearest Algorithm

```typescript
/**
 * Find the nearest data point to the cursor for each visible series.
 *
 * Algorithm:
 * 1. Convert cursor X pixel → timestamp via linear mapping
 * 2. For each visible series:
 *    a. Binary search on timestamps to find bracket: timestamps[i] ≤ t < timestamps[i+1]
 *    b. Compare |timestamps[i] - t| vs |timestamps[i+1] - t|
 *    c. Winner is the snap target for this series
 * 3. Return snap results: { seriesKey, index, timestamp, value, screenX, screenY }[]
 *
 * Complexity: O(K × log N) where K = visible series, N = points at current LOD level.
 * At LOD, N ≤ 2 × viewportPixels ≈ 4000, so binary search is < 12 comparisons.
 */
interface SnapResult {
  seriesKey: string;
  index: number;
  timestamp: number;
  value: number;
  screenX: number;
  screenY: number;
}

function snapToNearest(
  cursorX: number,
  viewport: ViewportLayout,
  data: Map<string, DecimatedSeriesData>,
  visibleKeys: string[]
): SnapResult[];
```

#### D4.3.3 — Tooltip Payload Construction

```typescript
/** Payload emitted from the crosshair to ChartTooltip */
interface CrosshairTooltipPayload {
  /** Timestamp at crosshair position */
  timestamp: number;
  /** Formatted timestamp string */
  formattedTime: string;
  /** Per-series values at snap position */
  series: Array<{
    key: string;
    label: string;
    value: number;
    /** Formatted value string */
    formatted: string;
    /** Series color */
    color: string;
    /** Whether this series is visible */
    visible: boolean;
  }>;
}
```

### Task Checklist

- [ ] **Crosshair:** Render vertical crosshair line (canvas-rendered, DPR-aware, 1px crisp)
- [ ] **Crosshair:** Optional horizontal crosshair line (follows primary series Y position)
- [ ] **Crosshair:** Style via CSS variables (`--chart-crosshair-color`, `--chart-crosshair-width`)
- [ ] **Snap:** Implement binary search on LOD-decimated timestamp array
- [ ] **Snap:** Return snap results for all visible series
- [ ] **Snap:** Render indicator dots at snap positions (filled circle with border)
- [ ] **Snap:** Dots match series color with `--chart-crosshair-dot-border` ring
- [ ] **Tooltip:** Construct `CrosshairTooltipPayload` from snap results
- [ ] **Tooltip:** Wire payload to `ChartTooltip` primitive (from Phase 2)
- [ ] **Tooltip:** Position tooltip to avoid container edge overflow
- [ ] **Tooltip:** Hide tooltip on mouse leave
- [ ] **Performance:** Snap calculation < 1 ms per frame (binary search on LOD data)
- [ ] **Performance:** Crosshair rendering adds < 0.5 ms to frame time
- [ ] **Throttle:** Throttle mousemove handler to once per rAF (no redundant renders)
- [ ] **DigitalChannel:** Crosshair shows state name instead of numeric value
- [ ] **Tests:** Unit tests for snap-to-nearest (edge cases: extremes, gaps, single point)
- [ ] **Tests:** Visual regression test for crosshair + dots
- [ ] **Tests:** Interaction test: hover → verify tooltip content

### Technical Design Notes

- **Rendering layer** — The crosshair line and dots render in the canvas layer (GPU-drawn), not a DOM overlay. This prevents DOM thrashing on mousemove (which fires at >60 Hz on modern browsers). The tooltip itself renders in the DOM overlay because it contains text that needs to be selectable and accessible.

- **Throttle to rAF** — `mousemove` is high-frequency. The handler stores `lastCursorX` and a `needsUpdate` flag. On the next rAF callback (part of the render loop), if `needsUpdate` is true, run the snap calculation and update the crosshair/tooltip. This prevents redundant work.

- **Gap handling** — If the cursor is over a gap in a series (where `gapThreshold` triggered a line break), that series reports no snap result. The tooltip shows "—" or omits the series.

### Definition of Done

- [ ] Vertical crosshair follows cursor smoothly with no jank
- [ ] Crosshair snaps to nearest data point per series
- [ ] Indicator dots render at snap positions with correct colors
- [ ] Tooltip shows timestamp + all visible series values
- [ ] Tooltip avoids container edge overflow
- [ ] Crosshair hides on mouse leave
- [ ] Works with 1M points (< 1 ms snap calculation)
- [ ] Works on DigitalChannel (shows state names)
- [ ] CSS variable styling works for all crosshair elements

---

## E4.4 — DataZoom (Slider + Minimap) (P0, 13 SP)

### User Stories

1. **As a user**, I want a slider below the chart showing the full data range as a minimap, with draggable handles to set the viewport window.
2. **As a user**, I want to drag the viewport window itself to pan.
3. **As a user**, I want the DataZoom to stay in sync with the main chart zoom/pan.
4. **As a developer**, I want to show/hide the DataZoom slider and configure its height.

### Deliverables

#### D4.4.1 — `<DataZoom>` Component

```tsx
export interface DataZoomProps {
  /** Reference to the chart this DataZoom controls */
  chart: UseChartReturn<any>;
  /** Height in pixels (default: 40) */
  height?: number;
  /** Whether to show the minimap (line preview) */
  showMinimap?: boolean; // default: true
  /** Which series to show in minimap (default: first series) */
  minimapSeries?: string;
  /** Additional className */
  className?: string;
}

function DataZoom({ chart, height = 40, showMinimap = true, minimapSeries, className }: DataZoomProps) {
  // Renders:
  // 1. Background: full data range minimap (lowest LOD level)
  // 2. Viewport window: highlighted region showing current view
  // 3. Left/right handles: draggable to resize viewport
  // 4. Click on background outside viewport: jump to that position
}

// Usage:
<div className="flex flex-col">
  <ChartContainer ref={containerRef} className="h-[400px]">
    <ChartTooltip ... />
  </ChartContainer>
  <DataZoom chart={chart} height={40} className="mt-1" />
</div>
```

#### D4.4.2 — Minimap Rendering

```typescript
/**
 * The minimap renders the first (or configured) series at the lowest LOD level.
 * This is a cheap pre-computed overview — no LOD query needed.
 *
 * Visual structure:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  ░░░░║████████████████████████████║░░░░░░░░░░░░░░░░░░░│
 *   │  ░░░░║██ viewport window (main) ██║░░░░░░░░░░░░░░░░░░░│
 *   │  ░░░░║████████████████████████████║░░░░░░░░░░░░░░░░░░░│
 *   └────────────────────────────────────────────────────────┘
 *         ▲ left handle                  ▲ right handle
 *
 * ░ = dimmed area (outside viewport)
 * █ = active viewport window
 * ║ = draggable handles
 *
 * The minimap line draws behind the viewport indicator.
 * Dimmed areas use --chart-zoom-fill with reduced opacity.
 */
```

#### D4.4.3 — Bidirectional Sync

```typescript
/**
 * DataZoom ↔ Main Chart sync:
 *
 * DataZoom → Main:
 *   - Handle drag: update chart.visibleRange
 *   - Window drag: update chart.visibleRange (pan)
 *   - Handle positions: [startPx, endPx] → data range → chart.setVisibleRange()
 *
 * Main → DataZoom:
 *   - chart.visibleRange changes (from zoom gesture, programmatic API, sync group)
 *   - DataZoom reads chart.visibleRange → updates handle positions
 *
 * Must avoid infinite loops: DataZoom sets range → chart re-renders →
 * DataZoom observes range → sets range again.
 * Solution: guard with timestamp check — only update if the source differs.
 */
```

### Task Checklist

- [ ] **Component:** Implement `<DataZoom>` as a React component below the chart
- [ ] **Minimap:** Render overview line at lowest LOD level (pre-computed, no query)
- [ ] **Minimap:** Apply CSS variable theming (`--chart-1` for line color, surface token for bg)
- [ ] **Viewport Window:** Render highlighted viewport region with handles
- [ ] **Viewport Window:** Style with CSS variables (`--chart-zoom-fill`, handle color)
- [ ] **Handles:** Left and right draggable handles to resize viewport
- [ ] **Handles:** Minimum viewport width constraint (prevent zero-width viewport)
- [ ] **Handles:** Cursor changes on hover (ew-resize for handles, grab/grabbing for window)
- [ ] **Window Drag:** Drag the viewport window to pan (clamp to data range)
- [ ] **Background Click:** Click outside viewport → center viewport at click position
- [ ] **Sync → Chart:** Handle/window changes call `chart.setVisibleRange()`
- [ ] **Sync ← Chart:** Observe `chart.visibleRange` and update handle positions
- [ ] **Sync Guard:** Prevent infinite update loops (source check or frame guard)
- [ ] **Touch:** Handle drag works on touch devices (touchstart/touchmove/touchend)
- [ ] **Keyboard:** Arrow keys move handles when DataZoom has focus
- [ ] **Performance:** Minimap renders at lowest LOD — no per-frame LOD query
- [ ] **Tests:** Unit test: handle drag → verify range change
- [ ] **Tests:** Integration test: zoom chart → verify DataZoom updates
- [ ] **Tests:** Visual regression test for minimap appearance

### Technical Design Notes

- **Minimap rendering cost** — The minimap uses the lowest (most decimated) LOD level, which has ≤2000 points regardless of original data size. This renders in < 1 ms and doesn't need to re-query on zoom/pan. The minimap only re-renders when the underlying data changes (append or reset).

- **Handle hit testing** — Each handle is a 12 px wide hit target (wider than the visual 2 px handle line). This makes dragging easy on both desktop and touch. The cursor CSS changes to `ew-resize` on handle hover.

- **Viewport minimum width** — Prevent zooming to an infinitely small range. Minimum viewport width = max(10 pixels, 2 × tick interval at best resolution). This ensures at least 2 visible ticks.

### Definition of Done

- [ ] Minimap shows full data range at lowest LOD level
- [ ] Handle drag resizes viewport window
- [ ] Window drag pans viewport
- [ ] Background click centers viewport at click position
- [ ] Bidirectional sync between DataZoom and main chart (no infinite loops)
- [ ] All styling via CSS variables
- [ ] Touch drag works on mobile
- [ ] DataZoom adds < 2 ms to frame time
- [ ] Visual regression tests pass

---

## E4.5 — Linked Axes & Cursor Sync (P0, 8 SP)

### User Stories

1. **As a developer**, I want to group multiple charts in a `<ChartSyncGroup>` and have cursor position, zoom range, and pan operations sync across all charts.
2. **As a developer**, I want to configure what syncs: cursor only, X-range only, or both.
3. **As a user**, I want to see a crosshair at the same timestamp across all synced charts when I hover on one.

### Deliverables

#### D4.5.1 — Sync Protocol Implementation

```typescript
/** Sync message types */
type SyncMessage =
  | { type: "cursor"; timestamp: number; source: string }
  | { type: "xRange"; start: number; end: number; source: string }
  | { type: "zoom"; start: number; end: number; source: string }
  | { type: "reset"; source: string };

/** Sync channel (shared between charts in a group) */
interface SyncChannel {
  /** Broadcast a sync message to all other charts */
  broadcast(msg: SyncMessage): void;
  /** Subscribe to sync messages from other charts */
  subscribe(chartKey: string, handler: (msg: SyncMessage) => void): () => void;
}

/**
 * Implementation: React context provides a SyncChannel.
 * Each chart calls broadcast() on user interaction.
 * Each chart subscribes() and applies received messages.
 *
 * Echo suppression: messages from `source === myChartKey` are ignored.
 * This prevents feedback loops.
 *
 * Message coalescing: if multiple messages arrive before the next rAF,
 * only the latest is applied (no stale intermediate states).
 */
```

#### D4.5.2 — Sync Modes

```tsx
<ChartSyncGroup
  sync={["cursor", "xRange"]} // configurable subset
  id="process-overview"       // optional group ID for nesting
>
  <ChartContainer ref={ref1} chartKey="temperature">
    {/* Temperature chart */}
  </ChartContainer>
  <ChartContainer ref={ref2} chartKey="pressure">
    {/* Pressure chart with independent Y-axis */}
  </ChartContainer>
  <ChartContainer ref={ref3} chartKey="digital">
    {/* Digital channels */}
  </ChartContainer>
</ChartSyncGroup>
```

**Sync modes:**

| Mode | What Syncs | Use Case |
|---|---|---|
| `cursor` | Crosshair timestamp (hover position) | Compare values at same time across charts |
| `xRange` | Visible time range (pan/zoom X-axis) | All charts show the same time window |
| `zoom` | Full zoom rectangle (X + Y) | Rare — usually only X syncs |

### Task Checklist

- [ ] **Channel:** Implement `SyncChannel` as React context value
- [ ] **Channel:** Implement `broadcast()` — push message to all subscribers
- [ ] **Channel:** Implement `subscribe()` — return unsubscribe function
- [ ] **Echo Suppression:** Ignore messages from own `chartKey`
- [ ] **Message Coalescing:** Buffer messages and apply only latest per type per rAF
- [ ] **Cursor Sync:** On hover in chart A → broadcast cursor timestamp → chart B/C/D show crosshair at same timestamp
- [ ] **Cursor Sync:** Each chart independently snaps to its own data at the synced timestamp
- [ ] **xRange Sync:** On zoom/pan in chart A → broadcast new range → chart B/C/D update their visible range
- [ ] **xRange Sync:** Each chart triggers its own LOD re-query at the new range
- [ ] **Reset Sync:** On resetZoom in any chart → broadcast reset → all charts reset
- [ ] **Sync + DataZoom:** DataZoom follows xRange sync messages
- [ ] **Sync + Streaming:** Live edge sync: if one chart pauses, others can stay live (opt-in)
- [ ] **Performance:** Sync propagation < 1 frame (message → apply → render)
- [ ] **Performance:** Test with 4 charts synced, each at 1M points
- [ ] **Cleanup:** Unsubscribe on chart unmount (prevent memory leaks)
- [ ] **Tests:** 2-chart cursor sync: hover chart A → verify crosshair at same timestamp on chart B
- [ ] **Tests:** 3-chart xRange sync: zoom chart A → verify charts B and C zoom to same range
- [ ] **Tests:** Verify no infinite loops with 4 charts bidirectionally synced

### Technical Design Notes

- **Data-space coordinates** — All sync messages operate in data coordinates (timestamps, values), not pixel coordinates. This allows synced charts to have different sizes, aspect ratios, or DPR settings.

- **Independent Y-axes** — When `xRange` syncs, each chart maintains its own Y-axis auto-range. Only the time window is shared. This is essential for syncing temperature (°C) charts with pressure (bar) charts — they share time but have independent value ranges.

- **Nested sync groups** — If needed, sync groups can nest. Inner group syncs cursor, outer group syncs xRange. This supports complex dashboard layouts where some charts are tightly coupled while others are loosely coupled.

- **Message coalescing** — During a rapid pan gesture, 60+ xRange messages per second could arrive. The subscriber buffers and applies only the latest per rAF tick, preventing redundant LOD queries and renders.

### Definition of Done

- [ ] Cursor sync works across 4 charts (crosshair at same timestamp)
- [ ] xRange sync works across 4 charts (zoom/pan propagates)
- [ ] Echo suppression prevents infinite loops
- [ ] Message coalescing prevents redundant renders
- [ ] Each chart snaps to its own data (independent Y-axes)
- [ ] DataZoom stays in sync with synced range
- [ ] Sync propagation < 1 frame (< 16 ms)
- [ ] No memory leaks on chart mount/unmount
- [ ] Works during streaming mode

---

## Consolidated Weekly Summary

### Week 17: Region Zoom + Pan Foundation

| Day | Tasks |
|---|---|
| Mon | E4.1: Screen ↔ data coordinate mapping, zoom gesture state machine |
| Tue | E4.1: Rubber-band selection overlay (DOM), axis-constrained zoom (Shift/Alt modifiers) |
| Wed | E4.1: Scroll wheel zoom (centered on cursor), pinch-to-zoom (touch), double-click reset |
| Thu | E4.1: Zoom animation (ease-out, 150 ms), programmatic API (`zoomTo`, `resetZoom`) |
| Fri | E4.2: Middle-click drag pan, trackpad two-finger pan, clamp-to-data |

### Week 18: Pan Completion + Crosshair

| Day | Tasks |
|---|---|
| Mon | E4.2: Pan inertia (momentum after release, friction deceleration) |
| Tue | E4.2: Touch drag pan, keyboard navigation (arrows, +/-, Home/End) |
| Wed | E4.2: Focus management (tabIndex, focus ring, aria-label) |
| Thu | E4.3: Crosshair vertical line rendering, snap-to-nearest binary search |
| Fri | E4.3: Indicator dots at snap positions, tooltip payload construction |

### Week 19: Tooltip Wiring + DataZoom

| Day | Tasks |
|---|---|
| Mon | E4.3: Wire crosshair to ChartTooltip, smart positioning, throttle to rAF |
| Tue | E4.3: DigitalChannel crosshair support, gap handling, tests |
| Wed | E4.4: DataZoom minimap rendering (lowest LOD level), viewport window |
| Thu | E4.4: Handle drag (left/right resize), window drag (pan), background click |
| Fri | E4.4: Bidirectional sync (DataZoom ↔ chart), loop prevention, touch support |

### Week 20: Linked Sync + Integration + Hardening

| Day | Tasks |
|---|---|
| Mon | E4.5: SyncChannel implementation, echo suppression, message coalescing |
| Tue | E4.5: Cursor sync across 4 charts, xRange sync, reset sync |
| Wed | E4.5: DataZoom + sync integration, streaming mode + sync, stress test 4 charts × 1M pts |
| Thu | Integration: all interactions work together — zoom + pan + crosshair + DataZoom + sync on TimeSeries + DigitalChannel |
| Fri | Performance profiling, edge case hardening, visual regression tests, phase exit checklist |

---

## Phase 4 Exit Checklist

- [ ] **E4.1** Zoom: Click-drag region zoom with axis constraint. Scroll/pinch zoom. Double-click reset. Zoom animation. Programmatic API. < 16 ms latency.
- [ ] **E4.2** Pan: Middle-click/trackpad/touch drag pan with inertia. Keyboard navigation (all shortcuts). Clamped to data bounds. Focus management with aria-label. ≥ 30 fps at 1M pts.
- [ ] **E4.3** Crosshair: Vertical line follows cursor. Snaps to nearest data point. Indicator dots. Tooltip shows timestamp + all pen values. < 1 ms snap calculation. Gap handling. DigitalChannel support.
- [ ] **E4.4** DataZoom: Minimap at lowest LOD. Handle drag resizes viewport. Window drag pans. Background click jumps. Bidirectional sync. Touch support. < 2 ms overhead.
- [ ] **E4.5** Sync: Cursor + xRange sync across 4 charts. Echo suppression. Message coalescing. Independent Y-axes. DataZoom follows sync. < 1 frame propagation.
- [ ] **Cross-cutting**: All interactions work during streaming. Touch support (iOS + Android). No memory leaks after 1000 interaction cycles. axe-core 0 violations. Biome 0 errors. tsc 0 errors. Visual regression CI green. Performance regression CI green.
- [ ] **Demo page**: Full interactive demo — 4 synced charts (3× TimeSeries + 1× DigitalChannel) with DataZoom, zoom/pan/crosshair, streaming mode, keyboard navigation.
