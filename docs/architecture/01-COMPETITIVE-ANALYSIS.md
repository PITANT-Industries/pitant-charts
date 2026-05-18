# 01 - Competitive Analysis

This is a working competitive map, not marketing. It stress-tests the vision in
`00-VISION.md` against incumbent charting libraries, dashboard products, and
scientific visualization tools. `06-FEATURE-SPEC-INVENTORY.md` owns the full
feature surface and explicit absences.

## Cohorts

| Cohort | Players | Their pitch |
|---|---|---|
| High-performance commercial charts | SciChart, LightningChart JS | WebGL or WebAssembly accelerated chart controls for large real-time data |
| General scientific and dashboard charts | Plotly.js, Apache ECharts, Highcharts | Broad chart catalog, declarative options, polished interactivity |
| Operational dashboards | Grafana, Seeq Workbench, Cognite Data Fusion UI | Connect many data sources and provide investigation or dashboard workflows |
| Low-level open source building blocks | D3, uPlot, Dygraphs, Observable Plot | Flexible primitives or small fast plotting layers |
| Pitant sibling UX layers | pitant-web, pitant-client, pitant-hmi-sdk | Product surfaces that consume this package rather than compete with it |

## 1. SciChart (closest replacement target)

**What it is.** SciChart is a commercial charting family for WPF, iOS, Android,
JavaScript, and React. Its JavaScript library uses WebAssembly and WebGL for
large-data real-time rendering and ships many 2D/3D chart examples.

**Genuine strengths.**
- Strong large-data reputation and mature commercial support.
- Real-time JavaScript, React, and cross-platform chart controls.
- Shared WebGL context and performance guidance for multi-chart pages.
- Rich chart catalog and industrial/scientific positioning.
- Existing users can build highly interactive technical dashboards quickly.

**Customer pressure points to validate.**
- Proprietary runtime and licensing are not acceptable as a Pitant core layer.
- The public API would become a vendor dependency across Pitant apps.
- Deep Pitant semantics such as historian quality, gap lineage, and evidence
  replay are application-specific work on top of SciChart.
- WASM/WebGL internals are not the same as source-owned WebGPU design control.

**Where we must reach parity.**
- Million-point line chart interaction.
- Multi-chart synchronization and live update behavior.
- Zoom, pan, cursor, legend, annotation, and export ergonomics.

**Where we leapfrog.**
- Source-owned WebGPU renderer.
- Pitant contract-native quality, gap, provenance, and evidence semantics.
- Headless shadcn-compatible composition for Pitant UX repos.

## 2. LightningChart JS (performance peer)

**What it is.** LightningChart JS is a commercial JavaScript/TypeScript charting
library focused on GPU-accelerated WebGL rendering and high-performance
visualization components.

**Genuine strengths.**
- Strong performance positioning with WebGL acceleration.
- Broad technical chart types for scientific and industrial uses.
- TypeScript package and browser deployment model.
- Useful documentation around performance tuning.

**Customer pressure points to validate.**
- Commercial licensing and vendor API lock-in.
- Requires WebGL rather than Pitant's WebGPU-first architecture target.
- Industrial context semantics still live outside the library.

**Where we must reach parity.**
- Fast line rendering, high sample rates, and stable multi-series interaction.
- Technical chart catalog after v1.

**Where we leapfrog.**
- Contract-generated chart fixtures and evidence-aware display rules.
- Worker/renderer split designed around Pitant historian and analytics payloads.

## 3. Plotly.js (scientific breadth)

**What it is.** Plotly.js is an open-source declarative JavaScript graphing
library with many chart types, including 3D and statistical charts, and WebGL for
3D charts.

**Genuine strengths.**
- Broad scientific chart catalog.
- Strong Python/R/MATLAB ecosystem adjacency.
- Excellent exploratory-data-analysis ergonomics.
- Open-source availability and familiar declarative model.

**Customer pressure points to validate.**
- Heavy footprint for embedded industrial UX surfaces.
- Not designed as a zero-runtime-dependency Pitant core package.
- High-density historian trends and contract-specific quality semantics need
  substantial custom work.

**Where we must reach parity.**
- Scientific chart breadth over post-v1 packs.
- Export and exploratory interaction expectations.

**Where we leapfrog.**
- Render budget discipline for industrial dashboards.
- Pitant-native data contracts, mode vectors, and profile gates.

## 4. Apache ECharts (general dashboard breadth)

**What it is.** Apache ECharts is an open-source web visualization library with
many out-of-the-box chart types and Canvas/SVG rendering, plus ECharts GL for
some WebGL scenarios.

**Genuine strengths.**
- Large open-source community and broad chart catalog.
- Flexible declarative option tree.
- Good dashboard use cases and mobile/browser support.
- Canvas and SVG renderer options.

**Customer pressure points to validate.**
- General-purpose option tree can become heavy for high-frequency mutation.
- Industrial historian semantics are not native.
- WebGPU is not the primary architecture.

**Where we must reach parity.**
- Common chart catalog over time.
- Declarative setup ergonomics and theme integration.

**Where we leapfrog.**
- Line-chart-first performance and LOD defaults.
- Contracted overlays for quality, gaps, alarms, and anomalies.

## 5. Highcharts (polished business charts)

**What it is.** Highcharts is a commercial JavaScript charting suite with Stock,
Maps, Gantt, dashboards, accessibility, sonification, and export modules.

**Genuine strengths.**
- Mature documentation and enterprise adoption.
- Strong accessibility story.
- Export support and broad framework integrations.
- Business and financial chart polish.

**Customer pressure points to validate.**
- SVG-first model is not the target for 10M point industrial trends.
- Licensing and vendor dependency are not acceptable as a Pitant substrate.
- Scientific/industrial quality semantics are not first-class.

**Where we must reach parity.**
- Accessibility, export, documentation, and framework integration quality.

**Where we leapfrog.**
- WebGPU large-data path.
- Native Pitant quality/provenance and profile-gated workflows.

## 6. Grafana (operational dashboard incumbent)

**What it is.** Grafana is an open-source visualization and observability
platform built around panels, data sources, dashboards, and alerting.

**Genuine strengths.**
- Excellent data-source ecosystem.
- Widely understood dashboard authoring model.
- JSON/provisioning workflows and operational adoption.
- Time-series panel is familiar to operators and SREs.

**Customer pressure points to validate.**
- Grafana panels visualize query results; they do not own Pitant evidence,
  quality, or replay semantics.
- Multi-panel dashboards are not the same as source-owned embedded chart
  primitives inside Pitant product workflows.
- Industrial workflow state often requires custom plugins or conventions.

**Where we must reach parity.**
- Fast, legible time-series panels and synchronized dashboard behavior.
- Tooltip, legend, units, thresholds, and panel state ergonomics.

**Where we leapfrog.**
- Chart primitives are directly embedded in Pitant workflows rather than being
  generic panels over external data sources.

## 7. D3, uPlot, Dygraphs, and Observable Plot (open primitives)

**What they are.** These are open-source visualization layers ranging from
low-level DOM/SVG/data joins to very small time-series plotting libraries and
notebook-style plotting.

**Genuine strengths.**
- Flexible and source-available.
- Useful as reference designs for axes, scales, and simple interactions.
- uPlot and Dygraphs are light and fast for common time-series cases.

**Customer pressure points to validate.**
- They do not provide Pitant's full industrial chart contract.
- WebGPU rendering, worker LOD, and safety-visible quality states remain our
  responsibility.
- Teams would have to build product semantics repeatedly on top.

**Where we must reach parity.**
- Small API ergonomics for simple charts.
- Performance for modest time-series.

**Where we leapfrog.**
- First-class industrial state, worker data engine, and Pitant package boundary.

## Displacement Test

SciChart becomes optional when a Pitant engineer can replace a production
historian trend view, anomaly investigation panel, and synchronized multi-chart
dashboard with `@pitant/charts` without losing frame rate, interaction quality,
export behavior, quality/gap visibility, or React composition control.

The sales claim is not "we have feature parity with every chart library." The
claim is narrower and stricter: Pitant can ship its own high-density industrial
time-series surfaces without licensing SciChart, leaking vendor APIs into
contracts, or hiding regulated data state from users.

## Source Links

- SciChart: https://www.scichart.com/
- SciChart performance docs: https://www.scichart.com/documentation/js/v4/2d-charts/performance-tips/performance-tips-and-tricks/
- LightningChart JS: https://lightningchart.com/js-charts/
- Plotly.js: https://plotly.com/javascript/
- Apache ECharts features: https://echarts.apache.org/en/feature.html
- Highcharts products: https://www.highcharts.com/products
- Grafana visualizations: https://grafana.com/docs/grafana/latest/panels-visualizations/
