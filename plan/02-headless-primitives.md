# Phase 2 — Headless Primitives & shadcn Architecture

**Weeks:** 6–10  
**Epics:** 7 (E2.1 – E2.7)  
**Story Points:** 71  
**Phase Goal:** Every UI surface element needed by a line chart — container, legend, tooltip, sync group — exists as a headless, CSS-variable-themed, accessible React primitive. No chart content yet — pure composition layer that any chart type will later plug into.

**Phase KPIs:**

| KPI | Target | Measurement |
|---|---|---|
| Individual primitive bundle size | ≤ 15 KB gzip each | `bun build --minify` per entrypoint |
| CSS variable coverage | 100% of visual properties | Audit script checks zero hardcoded colors/fonts/spacing |
| Keyboard navigation paths | 100% of interactive elements | Playwright keyboard-only test suite |
| Axe-core violations | 0 | axe-core + Playwright |
| Theming switch latency (light ↔ dark) | < 16 ms (1 frame) | Performance.mark |
| Screen reader data-table fallback | Announces all visible data | VoiceOver + NVDA manual test |

**Entry Criteria:** Phase 1 exit — WebGPU + Canvas2D renderers pass benchmark gate; data engine worker builds LOD pyramid.  
**Exit Criteria:** All 7 epics pass DoD; primitives compose together in a demo page with mock data; axe-core 0 violations; Storybook/docs catalog complete.

---

## E2.1 — CSS Variable Theming System (P0, 13 SP)

### User Stories

1. **As a developer**, I want all chart colors, fonts, spacing, and radii to come from CSS custom properties so my existing shadcn theme applies automatically.
2. **As a designer**, I want to switch between light, dark, and high-contrast themes by changing a class on a parent element.
3. **As a developer**, I want to define custom color palettes for chart series using `var(--chart-1)` through `var(--chart-8)` so I can match my brand.

### Deliverables

#### D2.1.1 — CSS Variable Token Map

```css
/* @pitant/charts/styles/tokens.css */

:root {
  /* Series palette — maps to shadcn convention */
  --chart-1: hsl(220, 70%, 50%);
  --chart-2: hsl(160, 60%, 45%);
  --chart-3: hsl(30, 80%, 55%);
  --chart-4: hsl(280, 65%, 60%);
  --chart-5: hsl(340, 75%, 55%);
  --chart-6: hsl(200, 70%, 50%);
  --chart-7: hsl(100, 60%, 45%);
  --chart-8: hsl(50, 80%, 50%);

  /* Surface tokens */
  --chart-background: var(--background, hsl(0, 0%, 100%));
  --chart-foreground: var(--foreground, hsl(222, 47%, 11%));
  --chart-muted: var(--muted, hsl(210, 40%, 96%));
  --chart-muted-foreground: var(--muted-foreground, hsl(215, 16%, 47%));
  --chart-border: var(--border, hsl(214, 32%, 91%));

  /* Interaction tokens */
  --chart-crosshair: var(--chart-foreground);
  --chart-crosshair-width: 1px;
  --chart-selection-fill: hsl(220, 70%, 50%, 0.1);
  --chart-selection-stroke: var(--chart-1);
  --chart-tooltip-background: var(--popover, hsl(0, 0%, 100%));
  --chart-tooltip-foreground: var(--popover-foreground, hsl(222, 47%, 11%));
  --chart-tooltip-border: var(--chart-border);
  --chart-tooltip-radius: var(--radius, 0.5rem);
  --chart-tooltip-shadow: 0 2px 8px hsl(0, 0%, 0%, 0.08);

  /* Axis tokens */
  --chart-axis-color: var(--chart-muted-foreground);
  --chart-axis-width: 1px;
  --chart-grid-color: var(--chart-muted);
  --chart-grid-width: 1px;
  --chart-grid-dash: 4 4;

  /* Typography tokens */
  --chart-font-family: var(--font-sans, system-ui, sans-serif);
  --chart-font-size-sm: 0.75rem;
  --chart-font-size-base: 0.875rem;
  --chart-font-size-lg: 1rem;

  /* Layout tokens */
  --chart-padding: 1rem;
  --chart-gap: 0.5rem;
  --chart-legend-gap: 0.75rem;
}

.dark {
  --chart-1: hsl(220, 70%, 65%);
  --chart-2: hsl(160, 60%, 58%);
  --chart-3: hsl(30, 80%, 65%);
  --chart-4: hsl(280, 65%, 70%);
  --chart-5: hsl(340, 75%, 65%);
  --chart-6: hsl(200, 70%, 60%);
  --chart-7: hsl(100, 60%, 55%);
  --chart-8: hsl(50, 80%, 60%);

  --chart-selection-fill: hsl(220, 70%, 65%, 0.15);
  --chart-tooltip-shadow: 0 2px 8px hsl(0, 0%, 0%, 0.3);
}

.high-contrast {
  --chart-1: hsl(220, 100%, 40%);
  --chart-2: hsl(0, 100%, 45%);
  --chart-3: hsl(120, 100%, 30%);
  --chart-4: hsl(280, 100%, 50%);
  --chart-5: hsl(30, 100%, 45%);
  --chart-6: hsl(180, 100%, 30%);
  --chart-7: hsl(60, 100%, 35%);
  --chart-8: hsl(320, 100%, 45%);

  --chart-axis-width: 2px;
  --chart-crosshair-width: 2px;
  --chart-grid-width: 2px;
}
```

#### D2.1.2 — `useChartTokens()` Hook

```typescript
// Core hook for reading resolved CSS variable values at runtime (for canvas rendering)
export function useChartTokens(containerRef: RefObject<HTMLElement | null>) {
  const [tokens, setTokens] = useState<ChartTokens>(DEFAULT_TOKENS);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      setTokens(resolveTokens(el));
    });

    // Observe class changes on ancestors (theme switches)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    setTokens(resolveTokens(el));
    return () => observer.disconnect();
  }, [containerRef]);

  return tokens;
}

function resolveTokens(el: HTMLElement): ChartTokens {
  const style = getComputedStyle(el);
  return {
    seriesColors: Array.from({ length: 8 }, (_, i) =>
      style.getPropertyValue(`--chart-${i + 1}`).trim()
    ),
    background: style.getPropertyValue("--chart-background").trim(),
    foreground: style.getPropertyValue("--chart-foreground").trim(),
    crosshairColor: style.getPropertyValue("--chart-crosshair").trim(),
    crosshairWidth: parseFloat(style.getPropertyValue("--chart-crosshair-width")) || 1,
    axisColor: style.getPropertyValue("--chart-axis-color").trim(),
    gridColor: style.getPropertyValue("--chart-grid-color").trim(),
    fontFamily: style.getPropertyValue("--chart-font-family").trim(),
    fontSize: parseFloat(style.getPropertyValue("--chart-font-size-base")) || 14,
    // ... remaining tokens
  };
}
```

### Task Checklist

- [ ] Define complete CSS variable token map (`tokens.css`)
- [ ] Create `ChartTokens` TypeScript interface
- [ ] Implement `resolveTokens()` function (getComputedStyle-based)
- [ ] Implement `useChartTokens()` hook with MutationObserver for theme switch
- [ ] Create `tokens.css` with `:root`, `.dark`, `.high-contrast` presets
- [ ] Create audit script to detect hardcoded colors in source (CI check)
- [ ] Write tests: token resolution, theme switching, observer cleanup
- [ ] Verify tokens cascade correctly inside shadcn `Card`, `Dialog`, etc.
- [ ] Document token map with visual swatches

### Technical Design Notes

- **Why CSS variables instead of JS theme?** — shadcn's theming is CSS-variable-first. JS theme objects require runtime overhead and don't cascade through CSS layers naturally. With CSS variables, a parent `.dark` class automatically re-themes all nested charts.
- **Canvas rendering bridge** — Canvas2D and WebGPU cannot read CSS variables directly. `useChartTokens()` bridges this by resolving computed values and passing them to the renderer as a typed object. The MutationObserver ensures live theme switches propagate to canvas.
- **Namespace strategy** — All tokens prefixed `--chart-*` to avoid collision. They fallback to shadcn's existing tokens (`--background`, `--foreground`, etc.) where possible, so charts inherit the app's theme with zero config.

### Definition of Done

- [ ] All visual properties read from CSS variables — zero hardcoded values
- [ ] Theme switch (light ↔ dark ↔ high-contrast) completes in < 16 ms
- [ ] `useChartTokens()` re-resolves on ancestor class change
- [ ] CI audit script fails build if any hardcoded color found in `packages/`
- [ ] Token documentation page with live swatches

---

## E2.2 — ChartContainer Primitive (P0, 8 SP)

### User Stories

1. **As a developer**, I want a `<ChartContainer>` that manages canvas lifecycle, ResizeObserver, and DPR scaling so I don't handle that boilerplate.
2. **As a developer**, I want to pass `className` and `style` to `ChartContainer` so it composes with Tailwind and shadcn layout.
3. **As a developer**, I want an imperative ref on `ChartContainer` to access the canvas and call methods like `toDataURL()`.

### Deliverables

#### D2.2.1 — `ChartContainer` Component

```tsx
import { forwardRef, useRef, useImperativeHandle, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useChartTokens } from "./use-chart-tokens";

export interface ChartContainerProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** Aspect ratio constraint (e.g. 16/9). Omit for parent-sized. */
  aspectRatio?: number;
  /** Called when container dimensions change */
  onResize?: (width: number, height: number) => void;
}

export interface ChartContainerRef {
  /** The underlying <canvas> element */
  canvas: HTMLCanvasElement | null;
  /** Current pixel dimensions (DPR-scaled) */
  dimensions: { width: number; height: number; dpr: number };
  /** Export canvas to data URL */
  toDataURL: (type?: string, quality?: number) => string;
  /** Force re-render */
  invalidate: () => void;
}

export const ChartContainer = forwardRef<ChartContainerRef, ChartContainerProps>(
  function ChartContainer({ className, style, children, aspectRatio, onResize }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tokens = useChartTokens(containerRef);

    // ResizeObserver for responsive sizing
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        onResize?.(width, height);
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [onResize]);

    useImperativeHandle(ref, () => ({
      canvas: canvasRef.current,
      dimensions: {
        width: canvasRef.current?.width ?? 0,
        height: canvasRef.current?.height ?? 0,
        dpr: window.devicePixelRatio || 1,
      },
      toDataURL: (type?: string, quality?: number) =>
        canvasRef.current?.toDataURL(type, quality) ?? "",
      invalidate: () => {
        /* trigger re-render via state or event */
      },
    }));

    return (
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden", className)}
        style={{
          aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
          ...style,
        }}
        role="img"
        aria-label="Chart"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          aria-hidden="true"
        />
        {/* Overlay layer for DOM-based UI (tooltip, legend, etc.) */}
        <div className="pointer-events-none absolute inset-0">
          {children}
        </div>
      </div>
    );
  }
);
```

### Task Checklist

- [ ] Implement `ChartContainer` with ResizeObserver and DPR scaling
- [ ] Implement `useImperativeHandle` for `ChartContainerRef`
- [ ] Handle `aspectRatio` prop (CSS `aspect-ratio` property)
- [ ] Wire up `onResize` callback with debounce option
- [ ] Create overlay `<div>` layer for DOM-based children (tooltip, legend)
- [ ] Ensure `className` and `style` pass through correctly
- [ ] Write tests: resize behavior, DPR scaling, ref methods, unmount cleanup
- [ ] Verify composition inside shadcn `Card`, `Dialog`, `Sheet`
- [ ] Accessibility: `role="img"`, `aria-label`, configurable `aria-describedby`

### Technical Design Notes

- **Layer architecture** — The container creates a canvas layer (for rendering) and a DOM overlay layer (for tooltips, legends, and other HTML elements). The overlay is `pointer-events-none` by default; child components opt-in to pointer events as needed.
- **DPR handling** — Canvas dimensions are multiplied by `devicePixelRatio` for sharp rendering on high-DPI displays. The CSS dimensions match the layout size. The renderer receives DPR from the container and adjusts coordinates accordingly.
- **ResizeObserver vs window.resize** — ResizeObserver tracks the container element itself, not the window. This handles cases where the chart is inside a resizable panel, collapsible sidebar, or dialog.

### Definition of Done

- [ ] Container renders inside shadcn `Card` with correct sizing
- [ ] DPR scaling produces sharp lines on 2× and 3× displays
- [ ] ResizeObserver fires on container resize (not just window resize)
- [ ] `ref.toDataURL()` returns valid PNG data URL
- [ ] Bundle size ≤ 5 KB gzip (container is minimal)
- [ ] axe-core 0 violations

---

## E2.3 — ChartLegend Primitive (P0, 8 SP)

### User Stories

1. **As a user**, I want to see a legend showing all chart series with their colors and names so I can identify which line is which.
2. **As a user**, I want to click a legend item to toggle that series' visibility.
3. **As a developer**, I want to compose `<ChartLegend>` anywhere — above, below, beside, or inside the chart container.

### Deliverables

#### D2.3.1 — `ChartLegend` Component

```tsx
export interface ChartLegendItem {
  /** Unique series key */
  key: string;
  /** Display label */
  label: string;
  /** CSS color (resolved from --chart-N) */
  color: string;
  /** Whether the series is currently visible */
  visible: boolean;
}

export interface ChartLegendProps {
  items: ChartLegendItem[];
  /** Called when user toggles a series */
  onToggle?: (key: string, visible: boolean) => void;
  /** Layout direction */
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function ChartLegend({
  items,
  onToggle,
  orientation = "horizontal",
  className,
}: ChartLegendProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      style={{ gap: "var(--chart-legend-gap)" }}
      role="list"
      aria-label="Chart legend"
    >
      {items.map((item) => (
        <button
          key={item.key}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm transition-opacity",
            !item.visible && "opacity-40"
          )}
          style={{
            color: "var(--chart-foreground)",
            fontFamily: "var(--chart-font-family)",
            fontSize: "var(--chart-font-size-sm)",
          }}
          onClick={() => onToggle?.(item.key, !item.visible)}
          role="listitem"
          aria-pressed={item.visible}
          aria-label={`${item.label}: ${item.visible ? "visible" : "hidden"}`}
        >
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.visible ? item.color : "transparent", border: `2px solid ${item.color}` }}
            aria-hidden="true"
          />
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

### Task Checklist

- [ ] Implement `ChartLegend` with horizontal/vertical orientation
- [ ] Implement toggle behavior (click → `onToggle` callback)
- [ ] Style with CSS variables only (gap, font, colors)
- [ ] Keyboard navigation: Tab between items, Enter/Space to toggle
- [ ] `aria-pressed` for toggle state, `role="list"` / `role="listitem"`
- [ ] Dimmed visual state for hidden series (opacity + hollow swatch)
- [ ] Write tests: render, toggle, keyboard nav, screen reader output
- [ ] Verify composition: legend above chart, below chart, inside card header

### Technical Design Notes

- **V1 legend is simple.** No search, no sort, no sparklines, no outlier mode, no grouping. These are all v1.1 features (E6.13). V1 legend does one thing well: show series, let user toggle visibility.
- **Button vs div** — Each legend item is a `<button>` for built-in keyboard focus and click handling. Using divs with `onClick` would require manual `tabIndex` and `onKeyDown` handling.
- **Color swatch** — Filled circle when visible, hollow outline when hidden. Uses the series color from CSS variables (`--chart-N`), resolved by the parent chart.

### Definition of Done

- [ ] Legend renders with correct series names and colors
- [ ] Click toggles visibility; `onToggle` fires with correct key/state
- [ ] Keyboard-only navigation works (Tab, Enter, Space)
- [ ] VoiceOver/NVDA announces "Series Name: visible/hidden" on toggle
- [ ] Visual state clearly distinguishes visible vs hidden series
- [ ] Bundle size ≤ 3 KB gzip
- [ ] axe-core 0 violations

---

## E2.4 — ChartTooltip Primitive (P0, 8 SP)

### User Stories

1. **As a user**, I want to see a tooltip near my cursor showing the timestamp and values of all visible series at that point.
2. **As a developer**, I want to customize tooltip content by passing a render function or children.
3. **As a developer**, I want the tooltip to position itself intelligently — never clipped by chart bounds.

### Deliverables

#### D2.4.1 — `ChartTooltip` Component

```tsx
export interface ChartTooltipPayload {
  /** Timestamp of the data point (for X axis label) */
  timestamp: number;
  /** Formatted X-axis label */
  label: string;
  /** Series values at this timestamp */
  series: Array<{
    key: string;
    label: string;
    color: string;
    value: number | null;
    formatted: string;
  }>;
}

export interface ChartTooltipProps {
  /** Tooltip payload — null when not hovering */
  payload: ChartTooltipPayload | null;
  /** Screen-space position where tooltip should appear */
  position: { x: number; y: number } | null;
  /** Custom content renderer */
  children?: (payload: ChartTooltipPayload) => React.ReactNode;
  className?: string;
}

export function ChartTooltip({
  payload,
  position,
  children,
  className,
}: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  // Prevent tooltip from overflowing container bounds
  useEffect(() => {
    if (!position || !tooltipRef.current) {
      setAdjustedPos(null);
      return;
    }
    const rect = tooltipRef.current.getBoundingClientRect();
    const parent = tooltipRef.current.parentElement?.getBoundingClientRect();
    if (!parent) return;

    let x = position.x + 12; // offset from cursor
    let y = position.y - 12;

    if (x + rect.width > parent.right) x = position.x - rect.width - 12;
    if (y + rect.height > parent.bottom) y = parent.bottom - rect.height - 4;
    if (y < parent.top) y = parent.top + 4;

    setAdjustedPos({ x, y });
  }, [position, payload]);

  if (!payload || !adjustedPos) return null;

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "pointer-events-none absolute z-50 min-w-[8rem] rounded-md border px-3 py-2 text-sm shadow-md",
        className
      )}
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        background: "var(--chart-tooltip-background)",
        color: "var(--chart-tooltip-foreground)",
        borderColor: "var(--chart-tooltip-border)",
        borderRadius: "var(--chart-tooltip-radius)",
        boxShadow: "var(--chart-tooltip-shadow)",
        fontFamily: "var(--chart-font-family)",
        fontSize: "var(--chart-font-size-sm)",
      }}
      role="tooltip"
    >
      {children ? (
        children(payload)
      ) : (
        <DefaultTooltipContent payload={payload} />
      )}
    </div>
  );
}

function DefaultTooltipContent({ payload }: { payload: ChartTooltipPayload }) {
  return (
    <>
      <div className="mb-1 font-medium" style={{ fontSize: "var(--chart-font-size-sm)" }}>
        {payload.label}
      </div>
      {payload.series.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span style={{ color: "var(--chart-muted-foreground)" }}>{s.label}</span>
          </span>
          <span className="font-mono font-medium tabular-nums">
            {s.value !== null ? s.formatted : "—"}
          </span>
        </div>
      ))}
    </>
  );
}
```

### Task Checklist

- [ ] Implement `ChartTooltip` with payload-driven rendering
- [ ] Implement intelligent positioning (avoid edge clipping)
- [ ] Implement default content layout (timestamp header + series rows)
- [ ] Support custom content via `children` render function
- [ ] Style with CSS variables only (background, border, shadow, radius, font)
- [ ] `role="tooltip"` for accessibility
- [ ] Handle null payload → hide tooltip
- [ ] Write tests: positioning, edge cases, custom content, payload updates
- [ ] Verify inside `ChartContainer` overlay layer

### Technical Design Notes

- **V1 tooltip is hover-only.** No persistent pins (v1.1, E6.1). The tooltip appears on hover and disappears when the cursor leaves the chart. This keeps the interaction model simple and the component lightweight.
- **Screen-space positioning** — The chart renderer calculates the cursor's data-space position and maps it to screen coordinates. The tooltip receives these as `position.x` and `position.y` (relative to container). The tooltip then adjusts to avoid clipping.
- **Snap-to-nearest** — The parent chart component handles nearest-point lookup. The tooltip receives the snapped data, not the raw cursor position. This separation keeps the tooltip component data-agnostic.
- **Custom content** — Passing `children` as a render function allows full control over tooltip layout. The default content is a sensible starting point that matches shadcn's existing chart tooltip pattern.

### Definition of Done

- [ ] Tooltip renders with correct timestamp and series values
- [ ] Tooltip repositions to avoid container overflow
- [ ] Custom content render function works
- [ ] CSS variables control all visual properties
- [ ] `role="tooltip"` present
- [ ] Bundle size ≤ 4 KB gzip
- [ ] axe-core 0 violations

---

## E2.5 — ChartSyncGroup Primitive (P0, 8 SP)

### User Stories

1. **As a developer**, I want to wrap multiple charts in a `<ChartSyncGroup>` so their cursors, zoom ranges, and pan positions stay synchronized.
2. **As a developer**, I want to choose which behaviors sync: cursor only, zoom only, or both.
3. **As a developer**, I want sync to work across charts that have different Y scales but share a time axis.

### Deliverables

#### D2.5.1 — `ChartSyncGroup` Component & Hook

```tsx
export interface SyncState {
  /** Cursor position in data-space (timestamp) */
  cursorTimestamp: number | null;
  /** Visible X-axis range [start, end] in data-space */
  xRange: [number, number] | null;
  /** Source chart key (to avoid echo) */
  source: string | null;
}

export interface ChartSyncGroupProps {
  /** What to synchronize */
  sync?: ("cursor" | "xRange" | "zoom")[];
  children: React.ReactNode;
  className?: string;
}

const SyncContext = createContext<{
  state: SyncState;
  dispatch: (update: Partial<SyncState>) => void;
} | null>(null);

export function ChartSyncGroup({
  sync = ["cursor", "xRange"],
  children,
  className,
}: ChartSyncGroupProps) {
  const [state, setState] = useState<SyncState>({
    cursorTimestamp: null,
    xRange: null,
    source: null,
  });

  const dispatch = useCallback(
    (update: Partial<SyncState>) => {
      setState((prev) => {
        const next = { ...prev, ...update };
        // Only update the fields that are in the sync list
        if (!sync.includes("cursor")) next.cursorTimestamp = prev.cursorTimestamp;
        if (!sync.includes("xRange") && !sync.includes("zoom")) next.xRange = prev.xRange;
        return next;
      });
    },
    [sync]
  );

  return (
    <SyncContext.Provider value={{ state, dispatch }}>
      <div className={className}>{children}</div>
    </SyncContext.Provider>
  );
}

/**
 * Hook for chart components to participate in sync.
 * @param chartKey Unique identifier for this chart (to avoid self-echo)
 */
export function useChartSync(chartKey: string) {
  const ctx = useContext(SyncContext);

  const updateCursor = useCallback(
    (timestamp: number | null) => {
      ctx?.dispatch({ cursorTimestamp: timestamp, source: chartKey });
    },
    [ctx, chartKey]
  );

  const updateXRange = useCallback(
    (range: [number, number] | null) => {
      ctx?.dispatch({ xRange: range, source: chartKey });
    },
    [ctx, chartKey]
  );

  return {
    /** Current sync state (skip if source === chartKey to avoid echo) */
    syncState: ctx?.state ?? { cursorTimestamp: null, xRange: null, source: null },
    /** Report cursor position to sync group */
    updateCursor,
    /** Report X range change to sync group */
    updateXRange,
    /** Whether this chart is inside a sync group */
    isSynced: ctx !== null,
  };
}
```

### Task Checklist

- [ ] Implement `ChartSyncGroup` context provider with configurable sync modes
- [ ] Implement `useChartSync()` hook for chart components
- [ ] Echo suppression: source chart ignores its own updates
- [ ] Support `cursor`, `xRange`, and `zoom` sync modes independently
- [ ] Handle add/remove of charts dynamically (useEffect cleanup)
- [ ] Write tests: cursor sync, range sync, echo suppression, dynamic charts
- [ ] Performance: sync propagation < 1 frame (measured in benchmark)

### Technical Design Notes

- **Context-based, opt-in** — `ChartSyncGroup` is a React context provider. Charts not inside a sync group work standalone. This follows shadcn's "no forced wrapper" principle.
- **Echo suppression** — Each chart identifies itself with a `chartKey`. When processing incoming sync state, a chart skips updates where `source === chartKey`. This prevents infinite re-render loops.
- **State shape** — Sync state contains data-space values (timestamps, ranges), not pixel coordinates. Each chart independently maps these to its own coordinate system. This allows sync across charts with different Y scales, different sizes, or different renderers.
- **Performance** — Context updates are batched by React 18+. The sync state is a flat object, so shallow comparison prevents unnecessary re-renders.

### Definition of Done

- [ ] Two `TimeSeries` charts inside `ChartSyncGroup` show synced cursors
- [ ] Zoom in one chart pans the other to the same X range
- [ ] Echo suppression prevents infinite loops
- [ ] Cursor sync propagation < 1 frame
- [ ] Charts outside sync group work independently
- [ ] Bundle size ≤ 3 KB gzip
- [ ] No axe-core violations

---

## E2.6 — Accessibility Layer (P0, 13 SP)

### User Stories

1. **As a screen reader user**, I want an accessible data table fallback that represents the chart data so I can understand the content.
2. **As a keyboard-only user**, I want to navigate between data points using arrow keys and read values via screen reader.
3. **As a user with motion sensitivity**, I want animations and transitions to respect `prefers-reduced-motion`.
4. **As a developer**, I want accessibility to work automatically without additional configuration.

### Deliverables

#### D2.6.1 — `AccessibleDataTable` Component

```tsx
export interface AccessibleDataTableProps {
  /** Label for the chart (used as table caption) */
  label: string;
  /** Series data for the table */
  series: Array<{
    key: string;
    label: string;
    data: Array<{ timestamp: number; value: number | null }>;
  }>;
  /** Format timestamp for display */
  formatTimestamp?: (ts: number) => string;
  /** Format value for display */
  formatValue?: (val: number | null, seriesKey: string) => string;
  /** Maximum rows to render (for performance with large datasets) */
  maxRows?: number;
  className?: string;
}

export function AccessibleDataTable({
  label,
  series,
  formatTimestamp = (ts) => new Date(ts).toISOString(),
  formatValue = (val) => val?.toFixed(2) ?? "—",
  maxRows = 100,
  className,
}: AccessibleDataTableProps) {
  // Sample data points if exceeding maxRows
  const timestamps = useMemo(() => {
    const allTs = series[0]?.data.map((d) => d.timestamp) ?? [];
    if (allTs.length <= maxRows) return allTs;
    const step = Math.ceil(allTs.length / maxRows);
    return allTs.filter((_, i) => i % step === 0);
  }, [series, maxRows]);

  return (
    <div className={cn("sr-only", className)} role="region" aria-label={`${label} data table`}>
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {series.map((s) => (
              <th key={s.key} scope="col">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timestamps.map((ts) => (
            <tr key={ts}>
              <td>{formatTimestamp(ts)}</td>
              {series.map((s) => {
                const point = s.data.find((d) => d.timestamp === ts);
                return <td key={s.key}>{formatValue(point?.value ?? null, s.key)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### D2.6.2 — `useKeyboardNavigation()` Hook

```typescript
export interface KeyboardNavConfig {
  /** Current focused data point index */
  focusedIndex: number;
  /** Total number of data points */
  totalPoints: number;
  /** Called when focus moves to a new index */
  onFocusChange: (index: number) => void;
  /** Called when user activates a data point (Enter/Space) */
  onActivate?: (index: number) => void;
}

export function useKeyboardNavigation({
  focusedIndex,
  totalPoints,
  onFocusChange,
  onActivate,
}: KeyboardNavConfig) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          onFocusChange(Math.min(focusedIndex + 1, totalPoints - 1));
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          onFocusChange(Math.max(focusedIndex - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          onFocusChange(0);
          break;
        case "End":
          e.preventDefault();
          onFocusChange(totalPoints - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onActivate?.(focusedIndex);
          break;
        case "PageDown":
          e.preventDefault();
          onFocusChange(Math.min(focusedIndex + 10, totalPoints - 1));
          break;
        case "PageUp":
          e.preventDefault();
          onFocusChange(Math.max(focusedIndex - 10, 0));
          break;
      }
    },
    [focusedIndex, totalPoints, onFocusChange, onActivate]
  );

  return { handleKeyDown };
}
```

#### D2.6.3 — `useReducedMotion()` Hook

```typescript
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}
```

### Task Checklist

- [ ] Implement `AccessibleDataTable` (screen-reader-only, sampled for large datasets)
- [ ] Implement `useKeyboardNavigation()` hook with arrow/Home/End/PageUp/PageDown
- [ ] Implement `useReducedMotion()` hook for animation gating
- [ ] Create focus indicator styles (visible ring on keyboard focus, hidden on mouse)
- [ ] Implement `aria-live` region for announcing value changes during keyboard nav
- [ ] Configure chart container: `tabIndex={0}`, `role="application"`, `aria-roledescription="interactive chart"`
- [ ] Write tests: keyboard navigation path, screen reader announcements, reduced motion
- [ ] Manual test with VoiceOver (macOS) and NVDA (Windows)
- [ ] Document accessibility features and keyboard shortcuts

### Technical Design Notes

- **Screen reader data table** — Canvas-rendered charts are opaque to screen readers. The `AccessibleDataTable` provides a visually-hidden `<table>` with sampled data points. For large datasets (1M+), only ~100 representative points are included to avoid DOM bloat.
- **Keyboard navigation** — Arrow keys move between data points. The focused point shows a visible indicator (via the renderer). The screen reader announces the timestamp and value at the focused point via `aria-live`.
- **Reduced motion** — When `prefers-reduced-motion: reduce` is active, all transitions (zoom animation, pan smoothing, tooltip fade) are disabled. Changes happen instantly.
- **Focus management** — Using `:focus-visible` ensures focus indicators appear only during keyboard navigation, not mouse clicks. Follows the shadcn pattern of visible-but-unobtrusive focus rings.

### Definition of Done

- [ ] Screen reader announces chart label, series names, and data values
- [ ] Arrow keys navigate between data points with audible announcements
- [ ] Focus indicator visible during keyboard nav, hidden during mouse use
- [ ] `prefers-reduced-motion` disables all animations
- [ ] AccessibleDataTable renders ≤ 100 rows for datasets of any size
- [ ] Manual test pass with VoiceOver and NVDA
- [ ] bundle size ≤ 5 KB gzip
- [ ] axe-core 0 violations

---

## E2.7 — React 19 Composition Bindings (P0, 13 SP)

### User Stories

1. **As a developer**, I want React hooks (`useTimeSeries`, `useDigitalChannel`) that create chart instances and manage their lifecycle.
2. **As a developer**, I want the chart components to work with React 19's ref improvements and RSC boundaries.
3. **As a developer**, I want TypeScript generics so I get autocompletion for series config and data types.

### Deliverables

#### D2.7.1 — Core Chart Hook Interface

```typescript
export interface UseChartOptions<TConfig extends ChartConfig> {
  /** Chart configuration (series definitions, axis config, etc.) */
  config: TConfig;
  /** Initial data (optional — can append later) */
  data?: Float64Array | ArrayBuffer;
  /** Container ref — the hook attaches the renderer to this element's canvas */
  containerRef: RefObject<ChartContainerRef | null>;
  /** Streaming mode config */
  streaming?: {
    enabled: boolean;
    windowSize?: number;
    liveEdge?: boolean;
  };
}

export interface UseChartReturn<TConfig extends ChartConfig> {
  /** Append new data points */
  append: (data: Float64Array | ArrayBuffer) => void;
  /** Replace all data */
  setData: (data: Float64Array | ArrayBuffer) => void;
  /** Current visible range */
  visibleRange: [number, number];
  /** Set visible range (for zoom/pan) */
  setVisibleRange: (range: [number, number]) => void;
  /** Legend items (derived from config + current state) */
  legendItems: ChartLegendItem[];
  /** Toggle series visibility */
  toggleSeries: (key: string) => void;
  /** Current tooltip payload (null when not hovering) */
  tooltipPayload: ChartTooltipPayload | null;
  /** Tooltip screen position */
  tooltipPosition: { x: number; y: number } | null;
  /** Export chart as image */
  exportImage: (format: "png" | "svg", options?: ExportOptions) => Promise<Blob>;
  /** Current performance stats */
  stats: { fps: number; renderTime: number; pointCount: number };
}
```

#### D2.7.2 — Package Structure

```
packages/
  charts/                     # Core library (vanilla TS)
    src/
      renderer/               # WebGPU + Canvas2D backends
      data-engine/            # Worker, LOD, streaming
      layout/                 # Axis, grid, label placement
      tokens/                 # CSS variable resolution
      types.ts                # Core type definitions
    package.json              # "@pitant/charts"

  charts-react/               # React 19 bindings
    src/
      components/
        ChartContainer.tsx
        ChartLegend.tsx
        ChartTooltip.tsx
        ChartSyncGroup.tsx
        AccessibleDataTable.tsx
      hooks/
        use-chart-tokens.ts
        use-chart-sync.ts
        use-keyboard-navigation.ts
        use-reduced-motion.ts
        use-time-series.ts    # Phase 3
        use-digital-channel.ts # Phase 3
      index.ts
    package.json              # "@pitant/charts-react"
```

#### D2.7.3 — RSC Boundary & `"use client"` Strategy

```typescript
// All chart components are client-only (they need canvas, DOM, etc.)
// Each component file starts with:
"use client";

// The data fetching and config can happen in server components:
// app/dashboard/page.tsx (RSC)
import { getHistorianData } from "@/lib/data";
import { TrendChart } from "./trend-chart"; // client component

export default async function DashboardPage() {
  const data = await getHistorianData({ last: "24h" });
  return <TrendChart data={data} />;
}
```

### Task Checklist

- [ ] Define `UseChartOptions` and `UseChartReturn` TypeScript interfaces
- [ ] Implement `useChart()` base hook (lifecycle: init renderer → attach to canvas → cleanup)
- [ ] Implement `append()` — sends data to worker, triggers re-render
- [ ] Implement `setData()` — replaces data, rebuilds LOD pyramid
- [ ] Implement `toggleSeries()` — updates visibility, re-renders
- [ ] Implement `exportImage()` — captures canvas to Blob
- [ ] Wire up legend items derivation from config + visibility state
- [ ] Wire up tooltip payload from renderer hit-test
- [ ] Add `"use client"` directive to all component files
- [ ] Verify RSC/SSR: no `window`/`document` references at module level
- [ ] Create `packages/charts-react/` package with proper `peerDependencies`
- [ ] Write tests: hook lifecycle, append, setData, toggle, export, SSR guard
- [ ] TypeScript: generic `TConfig` for per-chart-type autocompletion

### Technical Design Notes

- **Separation: core vs React** — `@pitant/charts` is the vanilla TypeScript engine (renderer, data engine, layout). `@pitant/charts-react` is the React binding layer (hooks, components, context). This allows future Vue/Svelte bindings (post-v1) without duplicating the engine.
- **RSC compatibility** — All chart components must be client components (`"use client"`). The hook doesn't access `window` or `document` during import — only inside `useEffect`. This ensures SSR builds don't crash.
- **React 19 ref changes** — React 19 supports `ref` as a regular prop (no `forwardRef` needed for function components). We use `forwardRef` for backward compatibility with React 18, but the API works with React 19's ref prop.
- **Hook-driven vs component-driven** — The hook `useTimeSeries()` (Phase 3) will wrap `useChart()` with TimeSeries-specific config. Developers can compose: `useTimeSeries()` + `ChartContainer` + `ChartLegend` + `ChartTooltip` = a complete line chart. Or they can use the hook alone with imperative canvas access.

### Definition of Done

- [ ] `useChart()` hook initializes renderer, attaches to canvas, cleans up on unmount
- [ ] `append()` and `setData()` trigger re-render with new data
- [ ] `legendItems` derives from config + visibility state
- [ ] `tooltipPayload` updates on cursor move
- [ ] `exportImage()` returns valid PNG/SVG Blob
- [ ] SSR build passes (no `window`/`document` at module level)
- [ ] React 18 and React 19 both work
- [ ] TypeScript generics provide config-specific autocompletion
- [ ] Bundle size for `@pitant/charts-react` (all components + hooks) ≤ 25 KB gzip
- [ ] axe-core 0 violations

---

## Consolidated Weekly Summary

### Week 6: CSS Theming + ChartContainer

| Day | Tasks |
|---|---|
| Mon–Tue | E2.1: Define token map, implement `resolveTokens()`, create `tokens.css` |
| Wed | E2.1: `useChartTokens()` hook + MutationObserver + tests |
| Thu–Fri | E2.2: `ChartContainer` with ResizeObserver, DPR, imperative ref |

### Week 7: Legend + Tooltip

| Day | Tasks |
|---|---|
| Mon | E2.2: Tests, composition verification inside shadcn Card/Dialog |
| Tue–Wed | E2.3: `ChartLegend` with toggle, keyboard nav, accessibility |
| Thu–Fri | E2.4: `ChartTooltip` with positioning, default content, custom renderer |

### Week 8: SyncGroup + Accessibility Foundation

| Day | Tasks |
|---|---|
| Mon | E2.4: Tooltip edge-case tests, container overflow handling |
| Tue–Wed | E2.5: `ChartSyncGroup` context, `useChartSync()` hook, echo suppression |
| Thu–Fri | E2.6: `AccessibleDataTable`, `useKeyboardNavigation()` |

### Week 9: Accessibility + React Bindings

| Day | Tasks |
|---|---|
| Mon | E2.6: `useReducedMotion()`, focus indicators, `aria-live` announcements |
| Tue | E2.6: Manual VoiceOver + NVDA testing |
| Wed–Fri | E2.7: `useChart()` hook, package structure, RSC boundary |

### Week 10: Integration + Polish

| Day | Tasks |
|---|---|
| Mon–Tue | E2.7: `append()`, `setData()`, `toggleSeries()`, `exportImage()` |
| Wed | E2.7: TypeScript generics, tests, SSR guard verification |
| Thu | Integration: compose all primitives in a demo page with mock line data |
| Fri | CSS variable audit, bundle size check, final axe-core run |

---

## Phase 2 Exit Checklist

- [ ] **E2.1** CSS Variable Theming: All visual properties read from `var(--chart-*)`. Theme switch < 16 ms. CI audit passes.
- [ ] **E2.2** ChartContainer: Renders in shadcn Card. DPR-correct. ResizeObserver works. Ref methods work. ≤ 5 KB gzip.
- [ ] **E2.3** ChartLegend: Toggle works. Keyboard nav works. VoiceOver announces state. ≤ 3 KB gzip.
- [ ] **E2.4** ChartTooltip: Positions correctly. Custom content works. CSS variables control styling. ≤ 4 KB gzip.
- [ ] **E2.5** ChartSyncGroup: Cursor sync works across 4 charts. Echo suppression verified. ≤ 3 KB gzip.
- [ ] **E2.6** Accessibility: Data table fallback for screen readers. Keyboard nav. Reduced motion. Manual SR test passed.
- [ ] **E2.7** React Bindings: Hook lifecycle correct. SSR-safe. TypeScript generics. React 18 + 19 compatible. ≤ 25 KB gzip.
- [ ] **Cross-cutting**: axe-core 0 violations. Biome lint 0 errors. `tsc --noEmit` 0 errors. All primitives compose in demo page.
- [ ] **Performance**: Total primitives bundle ≤ 40 KB gzip. No primitive > 15 KB gzip.
