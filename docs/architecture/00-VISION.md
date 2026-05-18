# 00 - Vision: What Premium Industrial Charts Mean

## Thesis

The market definition of a browser charting library is still a widget that turns
arrays into pixels. That is insufficient for Pitant Systems, because industrial
charts are not decorative dashboards; they are the operator, engineer, auditor,
and model-investigation surface for physical evidence. `pitant-charts` is the
source-owned charting layer that makes SciChart optional inside Pitant by
combining high-density rendering, contract-aware quality semantics, and
headless composition.

The thesis is falsifiable: if a Pitant historian trend, anomaly investigation,
or SPC workflow still needs SciChart to remain fast, correct, or credible after
v1, this repository has not met its purpose. `06-FEATURE-SPEC-INVENTORY.md` is
the source of truth for scope; this vision defines the constraints by which
scope disputes are settled.

## Five Product Principles

### P1 - The contract is the chart

Every rendered value has a stable input contract: timestamp semantics, series
identity, unit, quality, gap, provenance, and viewport state. SciChart and
LightningChart provide powerful APIs, but Pitant cannot let proprietary surface
types become its cross-repo contract. This repo can change renderers, workers,
and layout internals without changing the chart-data contract consumed by
`pitant-web`, `pitant-client`, or `pitant-hmi-sdk`.

### P2 - Fidelity beats pretty output

A clean line that hides bad quality or missing data is a defect. Grafana,
ECharts, and Highcharts can produce attractive dashboards, but the default
industrial path here must show gaps, stale data, substituted values, manual
entries, interpolation, corrections, and confidence bands when they exist.
Every design review can invoke P2 when a feature trades truthful state for
visual simplicity.

### P3 - Replayable views are first-class

The distinguishing verb for this repo is **replay**: given the same data window,
series config, theme tokens, interaction state, renderer version, and export
options, the view must be reconstructible. Plotly and D3 are strong exploratory
toolkits, but Pitant needs charts that can support regulated evidence, incident
reviews, and before/after analysis. The screenshot is not the artifact; the
replayable visual specification is.

### P4 - Composition belongs to Pitant

The library is not a monolithic dashboard builder. It provides core rendering,
data transforms, chart primitives, and React bindings that compose with
`pitant-historian`, `pitant-spc`, `pitant-oee`, `pitant-batch`,
`pitant-sentinel`, and `pitant-web`. This boundary prevents the chart package
from absorbing historian query, SPC rule evaluation, OEE calculation, alarm
workflow, or identity policy.

### P5 - Frame cost and memory are bounded

Every chart path has a budget: data ingestion, LOD query, command generation,
GPU upload, layout, tooltip lookup, export, and synchronized cursor propagation.
General chart libraries often make performance a tuning exercise after API
design. Pitant reverses that order: bounded frame cost is a product invariant,
not an optimization phase.

## What Premium Means Concretely

| Dimension | Commodity charting | Premium (`pitant-charts`) |
|---|---|---|
| Data model | Arrays of x/y points | Contracted series with time, quality, units, gaps, provenance, and trace context |
| Renderer | Canvas, SVG, WebGL chosen by library | WebGPU-first with Canvas2D fallback behind a stable `RenderContext` |
| Large data | Decimation as optional tuning | Min-max LOD and viewport query are default for high-density trends |
| Composition | Monolithic chart config | Headless primitives: container, legend, tooltip, sync group, data table, controls |
| Industrial state | Usually custom overlays | First-class gaps, quality, alarm bands, anomaly tracks, and evidence labels |
| Accessibility | Often afterthought | Keyboard paths, screen-reader data fallback, high contrast, reduced motion |
| Export | Image download | Replayable export spec plus PNG/SVG/PDF targets with evidence metadata |
| Replacement path | Rewrite app around vendor API | SciChart-compatible migration adapters where useful, Pitant-native contracts everywhere else |

## Scale Spectrum

The same packages serve the smallest and largest deployments. A workshop runs
the Canvas2D fallback on a single browser tab with a few hundred tags. A plant
control room runs multi-panel historian trends with WebGPU, synchronized
crosshairs, and live streaming. A gigafactory or fleet dashboard runs many
charts with shared workers, strict budgets, and contract-generated fixtures.
There is no "lite" rewrite; tier changes are configuration, budgets, and
colocation patterns.

## What This Repo Is Deliberately Not

- Not a historian; `pitant-historian` owns temporal storage, query, replay, and evidence.
- Not an edge collector; `pitant-fieldlink` owns device and protocol acquisition.
- Not the streaming backbone; `pitant-streams` owns durable event transport.
- Not the product shell; `pitant-web`, `pitant-client`, and `pitant-mobile` own app routing and workflow chrome.
- Not an HMI command surface; `pitant-hmi-sdk` owns operator-control UX boundaries.
- Not SPC calculation; `pitant-spc` owns rule evaluation and quality analytics.
- Not OEE or batch logic; `pitant-oee` and `pitant-batch` own those domain calculations.
- Not identity or authorization; `pitant-identity` owns users, roles, policies, and tokens.
- Not compliance record authority; `pitant-compliance` and `pitant-audit` own regulated evidence workflows.

## Non-Negotiables

- Charts never write to SIS, PLC, DCS, or actuator surfaces.
- Bad, uncertain, stale, manual, substituted, calculated, corrected, and
  interpolated states are visible or explicitly acknowledged.
- Renderer internals never leak into cross-repo contracts.
- Every high-density path is bounded in memory, message size, and frame work.
- Exports must not misrepresent quality, gaps, or provenance.
- React bindings remain headless and composable.
- SciChart migration is a bridge, not the permanent public API.
