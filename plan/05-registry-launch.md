# Phase 5 — Registry, Documentation & Launch

This is the original release plan. See the [licensing guide](../docs/licensing.md) for current package terms.

**Weeks:** 21–24  
**Epics:** 5 (E5.1 – E5.5)  
**Story Points:** 47  
**Phase Goal:** Package the library for distribution: shadcn-compatible registry blocks, documentation site with live interactive examples, PNG/SVG export, npm publish pipeline with provenance, and cross-browser/cross-device hardening. After this phase, `@pitant/charts` ships as a public V1.

**Phase KPIs:**

| KPI | Target | Measurement |
|---|---|---|
| `npx shadcn@latest add` installs blocks successfully | 100% of 8 blocks | CI registry test |
| Docs site Lighthouse score | ≥ 90 (Performance, A11y, Best Practices) | Lighthouse CI |
| Time from `npm install` to first live chart | < 5 minutes (developer experience) | Manual test |
| npm package gzip size (`@pitant/charts` core) | ≤ 80 KB | `size-limit` CI |
| npm package gzip size (core + all primitives) | ≤ 120 KB | `size-limit` CI |
| PNG export for 1M-point chart | < 2 s | Benchmark |
| SVG export for 10K-point chart | < 1 s | Benchmark |
| Cross-browser pass rate (Chrome, Firefox, Safari, Edge) | 100% | Playwright matrix |
| Zero critical/high CVEs in dependency tree | 0 | `npm audit` CI |
| CHANGELOG, LICENSE, README present and complete | Yes | CI check |

**Entry Criteria:** Phase 4 exit — all 5 interaction modes working, DataZoom syncs, cursor syncs across 4 charts, all interactions work during streaming, touch support verified.  
**Exit Criteria:** npm packages published, shadcn registry live, docs site deployed, export working, cross-browser CI green, CHANGELOG written.

---

## E5.1 — shadcn Registry Blocks (P0, 13 SP)

### User Stories

1. **As a React developer using shadcn/ui**, I want to install chart blocks via `npx shadcn@latest add` and get ready-to-use chart components that follow shadcn conventions.
2. **As a developer**, I want each block to be a self-contained example I can copy-paste and adapt.
3. **As a developer**, I want blocks to work with my existing shadcn theme (same CSS variables, same `cn()` utility).

### Deliverables

#### D5.1.1 — Registry Configuration

```json
// registry.json (root of @pitant/charts-react)
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "@pitant/charts",
  "homepage": "https://charts.pitant.dev",
  "items": [
    {
      "name": "timeseries-chart",
      "type": "registry:block",
      "title": "TimeSeries Chart",
      "description": "Multi-pen time-series line chart with zoom, pan, and crosshair.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/timeseries-chart.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "timeseries-streaming",
      "type": "registry:block",
      "title": "Streaming TimeSeries",
      "description": "Live streaming line chart with ring buffer and auto-scroll.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/timeseries-streaming.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "timeseries-multi-axis",
      "type": "registry:block",
      "title": "Dual Y-Axis TimeSeries",
      "description": "Multi-pen chart with left and right Y-axes.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/timeseries-multi-axis.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "digital-channel",
      "type": "registry:block",
      "title": "Digital Channel Chart",
      "description": "Stacked digital/binary channel display with staircase waveform.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/digital-channel.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "synced-charts",
      "type": "registry:block",
      "title": "Synced Chart Group",
      "description": "Multiple charts with linked cursor and zoom sync.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/synced-charts.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "datazoom-chart",
      "type": "registry:block",
      "title": "Chart with DataZoom",
      "description": "TimeSeries chart with minimap slider for viewport control.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/datazoom-chart.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "chart-export",
      "type": "registry:block",
      "title": "Exportable Chart",
      "description": "TimeSeries chart with PNG and SVG export buttons.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/chart-export.tsx", "type": "registry:component" }
      ]
    },
    {
      "name": "dashboard-overview",
      "type": "registry:block",
      "title": "Dashboard Overview",
      "description": "4-chart synced dashboard with DataZoom, digital channels, and streaming.",
      "dependencies": ["@pitant/charts", "@pitant/charts-react"],
      "files": [
        { "path": "blocks/dashboard-overview.tsx", "type": "registry:component" }
      ]
    }
  ]
}
```

#### D5.1.2 — Block File Convention

```tsx
// blocks/timeseries-chart.tsx
// Each block is a self-contained file:
// - Imports from @pitant/charts and @pitant/charts-react
// - Uses cn() from the consumer's utils (shadcn convention)
// - Uses CSS variables (--chart-1, --chart-2, etc.)
// - Includes demo data generation inline
// - Fully typed, zero eslint warnings
// - Copy-paste ready

"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  useTimeSeries,
  DataZoom,
} from "@pitant/charts-react";

export function TimeSeriesChart() {
  const chart = useTimeSeries({
    series: [
      { key: "temperature", label: "Temperature", unit: "°C" },
      { key: "humidity", label: "Humidity", unit: "%", yAxisPosition: "right" },
    ],
    xAxis: { type: "time" },
    yAxis: { label: "Temperature (°C)" },
    yAxisRight: { label: "Humidity (%)" },
  });

  // Load demo data
  React.useEffect(() => {
    chart.loadData(generateDemoData());
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer ref={chart.bindRef} className="h-[400px]">
        <ChartLegend chart={chart} />
        <ChartTooltip chart={chart} />
      </ChartContainer>
      <DataZoom chart={chart} />
    </div>
  );
}
```

### Task Checklist

- [ ] **Registry:** Create `registry.json` following shadcn registry schema
- [ ] **Registry:** Validate schema with `npx shadcn@latest registry lint`
- [ ] **Blocks:** Create `timeseries-chart.tsx` — basic multi-pen line chart
- [ ] **Blocks:** Create `timeseries-streaming.tsx` — live streaming with ring buffer
- [ ] **Blocks:** Create `timeseries-multi-axis.tsx` — dual Y-axis example
- [ ] **Blocks:** Create `digital-channel.tsx` — digital/binary channel display
- [ ] **Blocks:** Create `synced-charts.tsx` — multi-chart cursor + zoom sync
- [ ] **Blocks:** Create `datazoom-chart.tsx` — chart with DataZoom slider
- [ ] **Blocks:** Create `chart-export.tsx` — chart with export buttons
- [ ] **Blocks:** Create `dashboard-overview.tsx` — composite 4-chart dashboard
- [ ] **Test:** `npx shadcn@latest add` installs each block into a fresh Next.js project
- [ ] **Test:** All blocks render without errors
- [ ] **Test:** Blocks use consumer's `cn()` and CSS variables
- [ ] **Test:** Blocks work in RSC layout (client components correctly annotated)

### Technical Design Notes

- **Peer dependency model** — Blocks declare `@pitant/charts` and `@pitant/charts-react` as dependencies, and `react`, `react-dom` as peer dependencies. This matches the shadcn convention where the registry handles dependency installation.

- **Demo data** — Each block includes a `generateDemoData()` helper that creates realistic sample data (sine waves, trends, random walk). This data is inlined so the block works standalone without backend dependencies. Users replace it with their actual data sources.

- **RSC compatibility** — Every block file has `"use client"` at the top because charts require browser APIs (canvas, WebGPU, pointer events). This is standard for interactive components in Next.js App Router.

### Definition of Done

- [ ] 8 registry blocks created and validated
- [ ] `npx shadcn@latest add pitant/timeseries-chart` works
- [ ] All blocks render correctly with default shadcn theme
- [ ] All blocks work in Next.js App Router (RSC layout + client components)
- [ ] No eslint/Biome warnings in any block file
- [ ] Each block is < 150 lines (copy-paste friendly)

---

## E5.2 — Documentation Site with Live Examples (P0, 13 SP)

### User Stories

1. **As a developer**, I want a documentation site where I can read API docs and see live interactive examples.
2. **As a developer**, I want to copy example code directly from the docs.
3. **As a developer**, I want a "Getting Started" guide that takes me from `npm install` to a working chart in < 5 minutes.

### Deliverables

#### D5.2.1 — Site Structure

```
docs/
├── app/
│   ├── page.mdx                    # Landing page with hero chart
│   ├── getting-started/
│   │   ├── installation.mdx        # npm install, registry setup
│   │   ├── quick-start.mdx         # First chart in 3 steps
│   │   └── with-shadcn.mdx         # Integration with existing shadcn project
│   ├── guides/
│   │   ├── multi-pen.mdx           # Multi-pen line chart
│   │   ├── streaming.mdx           # Live streaming data
│   │   ├── digital-channels.mdx    # Digital/binary channels
│   │   ├── zoom-pan.mdx            # Zoom, pan, keyboard nav
│   │   ├── datazoom.mdx            # DataZoom slider
│   │   ├── sync-group.mdx          # Linked charts
│   │   ├── export.mdx              # PNG/SVG export
│   │   └── theming.mdx             # CSS variables, dark mode
│   ├── api/
│   │   ├── use-timeseries.mdx      # useTimeSeries() hook
│   │   ├── use-digital-channel.mdx # useDigitalChannel() hook
│   │   ├── chart-container.mdx     # ChartContainer
│   │   ├── chart-legend.mdx        # ChartLegend
│   │   ├── chart-tooltip.mdx       # ChartTooltip
│   │   ├── chart-sync-group.mdx    # ChartSyncGroup
│   │   ├── datazoom.mdx            # DataZoom
│   │   └── export-api.mdx          # exportChart()
│   ├── examples/
│   │   ├── blocks.mdx              # All registry blocks live
│   │   └── performance.mdx         # 1M-point stress test live
│   └── changelog.mdx
├── components/
│   ├── live-example.tsx            # Embeds running chart example
│   └── code-block.tsx              # Syntax highlighted, copy button
└── next.config.ts
```

#### D5.2.2 — Live Example Component

```tsx
/**
 * <LiveExample> renders a chart example in an iframe sandbox with:
 * - Working interactive chart
 * - Syntax-highlighted source code below
 * - "Copy code" button
 * - Resizable height
 * - Tabs: "Preview" | "Code"
 */
interface LiveExampleProps {
  /** Path to the block file (e.g., "blocks/timeseries-chart") */
  block: string;
  /** Default height */
  height?: number;
}
```

### Task Checklist

- [ ] **Framework:** Set up Next.js docs site in `docs/` workspace (App Router, MDX)
- [ ] **Landing:** Hero page with animated line chart + tagline + quick install command
- [ ] **Getting Started:** Installation page (npm, pnpm, bun, shadcn CLI)
- [ ] **Getting Started:** Quick Start — 3-step guide (install → import → render first chart)
- [ ] **Getting Started:** shadcn integration guide
- [ ] **Guides:** 8 guide pages (multi-pen, streaming, digital, zoom/pan, DataZoom, sync, export, theming)
- [ ] **API:** 8 API reference pages with prop tables, return types, examples
- [ ] **Examples:** All 8 registry blocks as live interactive examples
- [ ] **Examples:** Performance stress test page (1M points, interactive)
- [ ] **Component:** `<LiveExample>` with Preview/Code tabs and copy button
- [ ] **Component:** `<CodeBlock>` with syntax highlighting (Shiki) and copy button
- [ ] **Search:** Basic search (Next.js built-in or Pagefind)
- [ ] **Deploy:** Deploy to Vercel (or equivalent static host)
- [ ] **SEO:** Meta tags, OpenGraph, sitemap
- [ ] **Lighthouse:** Score ≥ 90 on Performance, Accessibility, Best Practices

### Technical Design Notes

- **MDX** — All pages are MDX files that can embed React components inline. This allows interactive chart examples inside documentation pages without iframes for most cases.

- **API docs generation** — Consider using `typedoc` or `tsdoc` to auto-generate API reference from the TypeScript types. This prevents docs from drifting out of sync with actual type definitions.

- **Performance page** — The stress test page loads 1M points and shows FPS counter, memory usage, and LOD level in real-time. This serves as both documentation and marketing — developers can see the library hit its performance targets live in their browser.

### Definition of Done

- [ ] Docs site renders all pages without errors
- [ ] Getting Started guide works (verified by following it in a fresh project)
- [ ] All 8 guide pages have live interactive examples
- [ ] All 8 API pages have complete prop tables
- [ ] Lighthouse ≥ 90 on all scores
- [ ] Search works
- [ ] Deployed and publicly accessible

---

## E5.3 — Export Engine (PNG, SVG) (P0, 8 SP)

### User Stories

1. **As a user**, I want to export the current chart view as a high-resolution PNG image.
2. **As a user**, I want to export the current chart view as a scalable SVG file.
3. **As a developer**, I want a programmatic `exportChart()` function and a composable `<ChartExportButton>`.

### Deliverables

#### D5.3.1 — Export API

```typescript
export interface ExportOptions {
  /** Export format */
  format: "png" | "svg";
  /** Pixel ratio for PNG (default: 2 for retina) */
  pixelRatio?: number;
  /** Background color (default: transparent) */
  backgroundColor?: string;
  /** Include legend in export */
  includeLegend?: boolean; // default: true
  /** Include axes labels */
  includeAxes?: boolean; // default: true
  /** Custom width (default: current chart width) */
  width?: number;
  /** Custom height (default: current chart height) */
  height?: number;
  /** File name for download (without extension) */
  fileName?: string;
}

/**
 * Export the current chart view.
 * Returns a Blob for programmatic use, or triggers a download.
 */
function exportChart(chart: UseChartReturn<any>, options: ExportOptions): Promise<Blob>;

/**
 * Convenience: export and trigger browser download.
 */
function downloadChart(chart: UseChartReturn<any>, options: ExportOptions): Promise<void>;
```

#### D5.3.2 — PNG Export Pipeline

```typescript
/**
 * PNG export pipeline:
 *
 * 1. Create offscreen canvas at target resolution (width × pixelRatio, height × pixelRatio)
 * 2. Set background (fill with backgroundColor or transparent)
 * 3. Re-render chart to offscreen canvas:
 *    - For Canvas2D backend: draw directly to offscreen context
 *    - For WebGPU backend: render to offscreen texture, then readback via readPixels
 * 4. If includeLegend: draw legend labels using Canvas2D text API
 * 5. If includeAxes: draw axis labels using Canvas2D text API
 * 6. Convert to blob: offscreenCanvas.convertToBlob({ type: 'image/png' })
 * 7. Return blob or trigger download via <a download>
 *
 * Performance note: for 1M-point charts, this re-renders at best LOD for the
 * export resolution, which may be different from screen LOD. Typical export
 * time: < 2s for 1M points at 2× resolution.
 */
```

#### D5.3.3 — SVG Export Pipeline

```typescript
/**
 * SVG export pipeline:
 *
 * 1. Query LOD for export viewport (use higher detail than screen if width > screen)
 * 2. Build SVG document:
 *    - <svg> root with viewBox matching data range
 *    - <rect> background (if backgroundColor set)
 *    - <g class="grid"> → grid lines as <line> elements
 *    - <g class="series"> → each series as <polyline> or <path>
 *    - <g class="axes"> → axis labels as <text> elements
 *    - <g class="legend"> → legend entries as <text> + <line> (color swatch)
 * 3. Serialize to string: new XMLSerializer().serializeToString(svgDoc)
 * 4. Create blob: new Blob([svgString], { type: 'image/svg+xml' })
 * 5. Return blob or trigger download
 *
 * Point limit: SVG with > 50K points per series becomes unwieldy.
 * If data exceeds 50K at export LOD, auto-decimate to 50K or warn.
 * For full-fidelity export of large datasets, prefer PNG.
 */
```

#### D5.3.4 — `<ChartExportButton>` Composable

```tsx
export interface ChartExportButtonProps {
  chart: UseChartReturn<any>;
  format?: "png" | "svg"; // default: "png"
  /** Additional export options */
  options?: Partial<ExportOptions>;
  /** Button variant (follows shadcn Button conventions) */
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  children?: React.ReactNode; // default: download icon + format label
}

// Usage:
<div className="flex gap-2">
  <ChartExportButton chart={chart} format="png" variant="outline" size="sm" />
  <ChartExportButton chart={chart} format="svg" variant="outline" size="sm" />
</div>
```

### Task Checklist

- [ ] **PNG:** Implement offscreen canvas creation at target resolution
- [ ] **PNG:** Re-render chart to offscreen canvas (Canvas2D backend path)
- [ ] **PNG:** Re-render chart to offscreen canvas (WebGPU readback path)
- [ ] **PNG:** Draw legend and axes labels to offscreen canvas
- [ ] **PNG:** Convert to blob via `convertToBlob()`
- [ ] **PNG:** Download via `<a download>` trick
- [ ] **PNG:** Support custom pixelRatio (1×, 2×, 3×)
- [ ] **SVG:** Build SVG DOM document from chart state
- [ ] **SVG:** Render grid lines as `<line>` elements
- [ ] **SVG:** Render series as `<polyline>` / `<path>` elements
- [ ] **SVG:** Render axis labels as `<text>` elements
- [ ] **SVG:** Render legend as `<text>` + color swatch
- [ ] **SVG:** Auto-decimate if series exceeds 50K points at export LOD
- [ ] **SVG:** Serialize to string and create blob
- [ ] **API:** Implement `exportChart()` → returns Blob
- [ ] **API:** Implement `downloadChart()` → triggers browser download
- [ ] **Component:** Implement `<ChartExportButton>` with format prop
- [ ] **Component:** Default icon + label (download icon + "PNG" / "SVG")
- [ ] **Performance:** PNG export of 1M points < 2 s
- [ ] **Performance:** SVG export of 10K points < 1 s
- [ ] **Tests:** Export 1M-point chart to PNG, verify blob is valid image
- [ ] **Tests:** Export to SVG, parse XML, verify series path element exists
- [ ] **Tests:** Visual comparison: exported image matches rendered chart

### Technical Design Notes

- **WebGPU readback** — Exporting from WebGPU requires `GPUBuffer.mapAsync()` to read pixel data from the GPU. This is async and can take 10-50 ms depending on GPU. The pipeline: render to texture → copy texture to buffer → map buffer → read pixels → create ImageData → draw to offscreen canvas → `convertToBlob()`.

- **Font rendering in export** — When exporting legend/axes text, the Canvas2D text API is used even when the chart uses WebGPU for lines. This ensures consistent text rendering across export formats. Font family, size, and color are read from the chart's computed CSS variables.

### Definition of Done

- [ ] PNG export works at 1×, 2×, 3× resolution
- [ ] SVG export produces valid, well-structured SVG
- [ ] Both formats include legend and axes when configured
- [ ] Export of 1M-point chart completes in < 2 s
- [ ] `<ChartExportButton>` integrates naturally with shadcn styling
- [ ] Downloads work in Chrome, Firefox, Safari, Edge

---

## E5.4 — npm Publish Pipeline & CI (P0, 5 SP)

### User Stories

1. **As a maintainer**, I want an automated publish pipeline that builds, tests, and publishes packages to npm with provenance.
2. **As a consumer**, I want packages that follow semver, include source maps, and have correct `exports` fields.
3. **As a contributor**, I want CI to run lint, type-check, unit tests, visual regression, and benchmarks on every PR.

### Deliverables

#### D5.4.1 — Package Configuration

```jsonc
// packages/charts/package.json
{
  "name": "@pitant/charts",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./data-engine": {
      "types": "./dist/data-engine/index.d.ts",
      "import": "./dist/data-engine/index.mjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
  "sideEffects": false,
  "license": "MIT",
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

```jsonc
// packages/charts-react/package.json
{
  "name": "@pitant/charts-react",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },
    "./blocks/*": {
      "types": "./dist/blocks/*.d.ts",
      "import": "./dist/blocks/*.mjs"
    }
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "files": ["dist", "registry.json", "README.md", "LICENSE", "CHANGELOG.md"],
  "sideEffects": false,
  "license": "MIT",
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

#### D5.4.2 — CI Pipeline

```yaml
# .github/workflows/ci.yml (conceptual outline)
# Triggers: push to main, PRs to main

jobs:
  lint-typecheck:
    # Run Biome lint + tsc --noEmit
    
  unit-tests:
    # Run Vitest with coverage
    # Coverage threshold: 80% lines
    
  build:
    # Build all packages
    # Check bundle size (size-limit)
    # Fail if core > 80 KB gzip
    
  visual-regression:
    # Playwright visual comparison
    # Snapshot artifacts on failure
    
  benchmark:
    # Run criterion-style benchmarks
    # Compare against baseline (fail if > 10% regression)
    
  cross-browser:
    # Playwright on Chrome, Firefox, Safari (WebKit), Edge
    # Matrix: { browser: [chromium, firefox, webkit] }
    
  publish:
    # Only on version tag push (v*.*.*)
    # npm publish --provenance
    # Create GitHub release with CHANGELOG entry
```

#### D5.4.3 — Bundle Size Guard

```jsonc
// .size-limit.json
[
  {
    "name": "@pitant/charts core",
    "path": "packages/charts/dist/index.mjs",
    "limit": "80 KB",
    "gzip": true
  },
  {
    "name": "@pitant/charts + all primitives",
    "path": ["packages/charts/dist/index.mjs", "packages/charts-react/dist/index.mjs"],
    "limit": "120 KB",
    "gzip": true
  },
  {
    "name": "@pitant/charts data-engine worker",
    "path": "packages/charts/dist/data-engine/index.mjs",
    "limit": "30 KB",
    "gzip": true
  }
]
```

### Task Checklist

- [ ] **Package:** Finalize `package.json` for both packages (exports, files, peerDeps)
- [ ] **Package:** Add `sideEffects: false` for tree-shaking
- [ ] **Package:** Generate `.d.ts` type declarations
- [ ] **Package:** Generate source maps
- [ ] **Package:** Write README.md for both packages
- [ ] **Package:** Write CHANGELOG.md (v1.0.0 entry)
- [ ] **Package:** Write LICENSE (MIT)
- [ ] **CI:** Set up lint + typecheck job
- [ ] **CI:** Set up unit test job with coverage threshold (80%)
- [ ] **CI:** Set up build job with `size-limit` bundle guard
- [ ] **CI:** Set up visual regression job (Playwright snapshots)
- [ ] **CI:** Set up benchmark job with regression detection
- [ ] **CI:** Set up cross-browser matrix (Chromium, Firefox, WebKit)
- [ ] **CI:** Set up publish job (tag-triggered, npm provenance)
- [ ] **CI:** GitHub release creation with CHANGELOG excerpt
- [ ] **Test:** Dry run `npm pack` and inspect tarball contents
- [ ] **Test:** Install packed tarball in fresh project, verify imports

### Definition of Done

- [ ] `npm pack` produces clean tarballs with correct files
- [ ] All exports resolve correctly (`@pitant/charts`, `@pitant/charts/data-engine`, etc.)
- [ ] TypeScript types resolve for consumers
- [ ] Bundle size within limits (80 KB / 120 KB gzip)
- [ ] CI pipeline runs all checks on PR
- [ ] Tag push triggers publish with provenance
- [ ] `npm audit` shows 0 critical/high vulnerabilities

---

## E5.5 — Cross-Browser Testing & Hardening (P0, 8 SP)

### User Stories

1. **As a user**, I want the chart to work correctly in Chrome, Firefox, Safari, and Edge on both desktop and mobile.
2. **As a developer**, I want to know that the library gracefully falls back when WebGPU is unavailable.
3. **As a user**, I want the chart to render correctly when the page is printed.

### Deliverables

#### D5.5.1 — Browser Compatibility Matrix

| Feature | Chrome 120+ | Firefox 120+ | Safari 17+ | Edge 120+ | iOS Safari 17+ | Android Chrome |
|---|---|---|---|---|---|---|
| WebGPU rendering | ✅ | ✅ (flag→stable 2025) | ✅ (partial) | ✅ | ❌ (Canvas2D fallback) | ✅ |
| Canvas2D fallback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Web Worker (LOD) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Touch interactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pointer events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| High DPI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offscreen export | ✅ | ✅ | ✅ (partial) | ✅ | ✅ | ✅ |

#### D5.5.2 — Hardening Areas

```typescript
/**
 * Cross-browser hardening checklist:
 *
 * 1. WebGPU fallback detection:
 *    - navigator.gpu check
 *    - GPU adapter request timeout (5s)
 *    - Device lost recovery (re-create device)
 *    - Safari WebGPU quirks (limited texture formats)
 *
 * 2. High DPI / Retina:
 *    - Canvas size = CSS size × devicePixelRatio
 *    - Handle DPR changes (monitor switch, drag between displays)
 *    - Listen for matchMedia DPR change events
 *
 * 3. Touch normalization:
 *    - iOS Safari: 300ms tap delay (use touch-action: manipulation)
 *    - Safari: non-standard gesture events for pinch
 *    - Passive event listeners for scroll performance
 *
 * 4. Resize handling:
 *    - ResizeObserver for container resize
 *    - Debounce resize → re-layout → re-render
 *    - Handle visibility change (hidden tab → visible tab)
 *
 * 5. Memory management:
 *    - GPU buffer cleanup on unmount
 *    - Worker termination on unmount
 *    - Canvas context loss and recovery
 *
 * 6. Print support:
 *    - @media print: render to high-res static image
 *    - Fallback: `<img>` with PNG data URL
 *
 * 7. RTL support:
 *    - Legend and tooltips respect dir="rtl"
 *    - Axis label placement
 */
```

### Task Checklist

- [ ] **Playwright:** Set up cross-browser test matrix (Chromium, Firefox, WebKit)
- [ ] **Playwright:** Mobile viewport tests (iPhone 14 Pro, Pixel 7)
- [ ] **Playwright:** Test WebGPU rendering on supported browsers
- [ ] **Playwright:** Test Canvas2D fallback on browsers without WebGPU
- [ ] **Fallback:** Verify auto-detection falls back to Canvas2D when WebGPU unavailable
- [ ] **Fallback:** Test GPU adapter request timeout (mock slow GPU)
- [ ] **Fallback:** Test device lost recovery (simulate context loss)
- [ ] **DPI:** Test on 1×, 2× (Retina), 3× DPR
- [ ] **DPI:** Handle DPR change mid-session (monitor switch)
- [ ] **Touch:** Verify zoom/pan/tooltip on iOS Safari
- [ ] **Touch:** Verify pinch-to-zoom on Android Chrome
- [ ] **Touch:** Set `touch-action: manipulation` on chart canvas
- [ ] **Resize:** Verify resize handling (container resize, window resize)
- [ ] **Resize:** Verify hidden→visible tab re-render
- [ ] **Memory:** Verify no GPU buffer leaks after mount/unmount cycles
- [ ] **Memory:** Verify Worker terminates on unmount
- [ ] **Memory:** Monitor `measureUserAgentSpecificMemory()` for leaks
- [ ] **Print:** `@media print` renders chart as static image
- [ ] **Print:** Verify print output in Chrome print preview
- [ ] **Edge Cases:** Very small container (< 100×100 px)
- [ ] **Edge Cases:** Container resized to 0×0 (hidden by CSS)
- [ ] **Edge Cases:** Multiple charts on same page (≤ 8)
- [ ] **Edge Cases:** Window.requestAnimationFrame cancelled on tab hide

### Technical Design Notes

- **Safari WebGPU caveats** — Safari's WebGPU implementation may lag behind Chrome/Firefox. Specific concerns: `storage` texture binding, some vertex formats, compute shader limitations. The renderer should feature-detect and fall back to Canvas2D for any unsupported feature rather than crashing.

- **GPU device lost** — The `GPUDevice.lost` promise resolves when the GPU context is lost (driver crash, system sleep, etc.). On device lost: log error, discard old device, request new adapter+device, re-create all pipelines and buffers, re-render. This should be transparent to the user.

- **Print CSS** — On `@media print`, the chart canvas is replaced with a high-resolution PNG `<img>`. This is done by listening to `window.matchMedia("print")` changes. Before print: generate PNG blob → set as `<img>` src → hide canvas. After print: restore canvas → remove `<img>`.

### Definition of Done

- [ ] Playwright cross-browser tests pass (Chromium, Firefox, WebKit)
- [ ] Touch interactions work on iOS Safari and Android Chrome
- [ ] WebGPU → Canvas2D fallback is seamless
- [ ] High DPI rendering is crisp (2× and 3×)
- [ ] No memory leaks after 100 mount/unmount cycles
- [ ] Print produces readable chart output
- [ ] All edge cases handled (tiny container, hidden tab, multi-chart)

---

## Consolidated Weekly Summary

### Week 21: Registry Blocks + Docs Setup

| Day | Tasks |
|---|---|
| Mon | E5.1: Set up registry.json, create timeseries-chart block, timeseries-streaming block |
| Tue | E5.1: Create multi-axis, digital-channel, synced-charts blocks |
| Wed | E5.1: Create datazoom-chart, chart-export, dashboard-overview blocks |
| Thu | E5.1: Test all blocks via `npx shadcn@latest add`, fix install issues |
| Fri | E5.2: Set up docs site (Next.js + MDX), landing page with hero chart |

### Week 22: Documentation + Export

| Day | Tasks |
|---|---|
| Mon | E5.2: Getting Started pages (installation, quick-start, shadcn integration) |
| Tue | E5.2: Guide pages (multi-pen, streaming, digital channels, zoom/pan) |
| Wed | E5.2: Guide pages (DataZoom, sync, export, theming) + API reference pages |
| Thu | E5.2: LiveExample component, search, deploy docs site |
| Fri | E5.3: PNG export pipeline (offscreen canvas, WebGPU readback, download) |

### Week 23: Export Completion + CI

| Day | Tasks |
|---|---|
| Mon | E5.3: SVG export pipeline (DOM construction, auto-decimation, serialization) |
| Tue | E5.3: `<ChartExportButton>` composable, export tests (visual comparison) |
| Wed | E5.4: Package configuration (exports, types, sideEffects, README, CHANGELOG) |
| Thu | E5.4: CI pipeline (lint, test, build, size-limit, visual regression, benchmark) |
| Fri | E5.4: Publish pipeline (tag-triggered npm publish with provenance) |

### Week 24: Cross-Browser Hardening + Launch

| Day | Tasks |
|---|---|
| Mon | E5.5: Cross-browser Playwright matrix (Chromium, Firefox, WebKit, mobile viewports) |
| Tue | E5.5: WebGPU fallback hardening, GPU device lost recovery, Safari quirks |
| Wed | E5.5: High DPI, touch normalization, resize handling, memory leak audit |
| Thu | E5.5: Print support, edge cases, final visual regression suite |
| Fri | **V1 LAUNCH:** npm publish v1.0.0, GitHub release, docs site live, announce |

---

## Phase 5 Exit Checklist (V1 Release Gate)

- [ ] **E5.1** Registry: 8 blocks pass `npx shadcn@latest add`. Render correctly with default theme. RSC-compatible.
- [ ] **E5.2** Docs: Site deployed. Getting Started works in < 5 min. All guides have live examples. API reference complete. Lighthouse ≥ 90.
- [ ] **E5.3** Export: PNG at 2× resolution < 2 s for 1M points. SVG < 1 s for 10K points. `<ChartExportButton>` works. Downloads work in all browsers.
- [ ] **E5.4** Publish: Both packages on npm. Bundle size ≤ 80 KB / ≤ 120 KB gzip. Provenance verified. `npm audit` clean. CHANGELOG, README, LICENSE present.
- [ ] **E5.5** Cross-browser: Playwright green on Chromium, Firefox, WebKit. Touch works on iOS + Android. Canvas2D fallback seamless. No memory leaks. Print works.
- [ ] **Final V1 gate**: All Phase 1–5 KPIs met. 1M pts ≥ 30 fps. 100K pts ≥ 60 fps. < 500 ms first render for 1M. ≤ 80 KB core gzip. ≤ 80 MB memory. axe-core 0 violations. All Playwright tests green across 3 browsers.
