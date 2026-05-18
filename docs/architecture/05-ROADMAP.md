# 05 - Roadmap

This is the authoritative architecture roadmap for `pitant-charts`. It derives
from `00` through `04` and maps the process families in `02` to implementation
phases. `06-FEATURE-SPEC-INVENTORY.md` owns the maximal scope.

## Planning Rules

- V1 ships excellent line charts before broad chart catalogs.
- Every phase closes with tests or benchmarks, not only code.
- Public package exports are contracts and need compatibility discipline.
- Renderer work must preserve Canvas2D fallback.
- No phase may add control-write behavior.
- Feature maturity uses `contract_only`, `simulated`, `pilot`, `production`.

## Target Architecture Stack

| Layer | Reference choice | Public contract impact |
|---|---|---|
| Runtime config | Package options and React props | Stable TypeScript interfaces |
| Data model | Typed arrays plus Pitant contract adapters | `ColumnarData`, `TimeSeriesDataSet`, chart series types |
| Worker path | Web Worker with transferable buffers | Bounded message contracts |
| Renderer | WebGPU primary, Canvas2D fallback | `RenderContext` and capability model |
| Layout | Internal layout engine | Public axis/panel config |
| Interaction | Gesture state machines | Public visible range, cursor, selection APIs |
| Theming | CSS variables plus resolver | `tokens.css`, `ChartTokens` |
| Export | PNG/SVG first, PDF later | `ExportOptions`, replay spec |
| Observability | Benchmarks, stats, diagnostics | `ChartStats`, benchmark JSON |
| Distribution | Bun workspaces, tsup, npm, shadcn registry | Package exports and registry blocks |

## Complete Domain Model

- Chart view
- Series
- Data source
- Data window
- Timestamp
- Value
- Unit
- Quality code
- Gap
- Provenance
- LOD level
- View transform
- Plot area
- Axis
- Grid
- Panel
- Overlay lane
- Render command
- Renderer capability
- Interaction state
- Cursor
- Brush
- Data tip
- Sync group
- Theme token
- Export artifact
- Replay spec
- Benchmark scenario
- Fixture pack
- Maturity label
- Profile gate

## API and Contract Surface Map

| Surface | Stability tier | Owner phase |
|---|---|---|
| `@pitant/charts` root exports | MVP | 1 |
| `RenderContext` | MVP | 1 |
| `DataEngine` | MVP | 1 |
| `ColumnarData` and `DataSource` | MVP | 3 |
| `@pitant/charts-react` root exports | MVP | 2 |
| `ChartContainer`, `ChartLegend`, `ChartTooltip`, `ChartSyncGroup` | MVP | 2 |
| `TimeSeries` and `useTimeSeries()` | Contract-only | 3 |
| `DigitalChannel` | Contract-only | 3 |
| Interaction APIs | Contract-only | 4 |
| Export APIs | MVP | 5 |
| shadcn registry blocks | Contract-only | 5 |
| Post-v1 chart packs | Future | 6 |

## 06 Coverage Map

| 06 section heading | Phases that close it | Acceptance evidence |
|---|---|---|
| Whole-PITANT Composition Model | 0, 3, 5 | Architecture docs, contract references, frontend packs |
| Ingest | 1, 3 | Data-source tests and adapters |
| Normalize | 3, 4 | Quality/gap unit tests and fixtures |
| Transform | 1, 3 | LOD tests and benchmarks |
| Layout | 3, 4 | Axis/layout tests and visual checks |
| Render | 1, 3, 5 | Renderer tests, browser screenshots, FPS benchmarks |
| Interact | 4 | Browser interaction tests |
| Compose | 2, 3 | React tests and examples |
| Synchronize | 2, 4 | Sync group tests and multi-chart examples |
| Theme | 2, 5 | Token tests, high-contrast examples |
| Export | 5 | Export tests and artifact review |
| Benchmark | 1, 3, 4, 5 | `apps/benchmark` and browser metrics |
| Package | 5 | npm dry run, registry install |
| Govern | 0, 5, 9 | Claim ledger, readiness labels |
| Post-v1 Industrial Packs | 6 | Contract-only inventory and gated roadmap |

## Cross-Repo Integration Gate

| Sibling repo | What this repo needs from it | Stub or production |
|---|---|---|
| `pitant-contracts` | Shared chart data windows, quality codes, evidence labels | Stub now |
| `pitant-historian` | Trend query payloads, replay windows, source quality | Stub now, production before v1 field use |
| `pitant-web` | App shell, saved views, routing, auth context | Stub now |
| `pitant-client` | Desktop shell and offline profiles | Stub |
| `pitant-hmi-sdk` | Operator display boundary and no-write policy | Contract-only |
| `pitant-spc` | SPC feature payloads and rule metadata | Contract-only |
| `pitant-oee` | OEE buckets and KPI overlays | Contract-only |
| `pitant-batch` | Batch profile and episode windows | Contract-only |
| `pitant-sentinel` | Anomaly tracks and detector evidence | Contract-only |
| `pitant-design-system` | Tokens and component conventions | Stub now |

## Phase 0 - Planning, Import, Traceability

**Status.** In progress, 2026-05-18.

**Scope.** Import source from `/Users/ali/Pchart`, establish architecture docs,
baseline verification, and phase artifacts.

**Implementation tasks.**
- Import tracked Pchart files.
- Preserve Pitant repo context in README.
- Create `docs/architecture` 00-10.
- Create phase-0 baseline and gap ledger.
- Run install, lint, build, typecheck, test, and benchmark.

**Tests and Acceptance.** `bun run lint`, `bun run build`, `bun run typecheck`,
`bun run test`, `bun run bench`.

**Definition of Done.**
- [x] Source imported.
- [x] Verification baseline recorded.
- [x] Architecture doc structure exists.
- [ ] Phase-0 gap ledger reviewed.

**Release gate.** Unblocks Phase 3 implementation in this repo.

## Phase 1 - Foundation and Rendering Engine

**Status.** Mostly closed by imported code.

**Scope.** Shared renderer contract, WebGPU/Canvas2D backends, data engine, LOD,
and benchmark harness. It does not ship user-facing chart types.

**Implementation tasks.**
- Maintain `RenderContext` and renderer capability model.
- Keep WebGPU and Canvas2D paths aligned.
- Expand browser renderer benchmark coverage.
- Add command-list vector export compatibility rules.

**Tests and Acceptance.** Renderer unit tests, public API tests, LOD benchmarks,
future Playwright canvas checks.

**Definition of Done.**
- [x] Build passes.
- [x] Unit tests pass.
- [x] LOD benchmarks pass.
- [ ] Browser WebGPU and Canvas2D render benchmarks exist.

**Release gate.** Required before real chart types can claim performance.

## Phase 2 - Headless Primitives and Theming

**Status.** Mostly closed by imported code.

**Scope.** React primitives, accessibility helpers, sync group, token resolver,
and initial hook surface.

**Implementation tasks.**
- Keep primitives headless and CSS-variable driven.
- Add composed example fixtures.
- Add accessibility verification for composed examples.
- Clarify `useChart()` error state and renderer readiness.

**Tests and Acceptance.** React tests, token tests, accessibility checks.

**Definition of Done.**
- [x] Primitive tests pass.
- [x] Token tests pass.
- [ ] Composed browser examples exist.
- [ ] Accessibility checks run on examples.

**Release gate.** Required before TimeSeries is exposed to app teams.

## Phase 3 - TimeSeries and Data Pipeline

**Status.** In progress.

**Scope.** First concrete chart types: TimeSeries and DigitalChannel. This phase
does not include the full interaction suite.

**Implementation tasks.**
- Define `TimeSeriesDataSet`, `TimeSeriesSeries`, and `DigitalChannelSeries`.
- Wire `useChart().setData()` to `DataEngine.ingest()`.
- Wire `useChart().append()` to `DataEngine.append()`.
- Add layout pass for axes, grid, and plot area.
- Generate line commands from LOD query results.
- Render single-pen and multi-pen TimeSeries.
- Render DigitalChannel step geometry.
- Preserve quality and gap markers through query and render.
- Add examples and tests for visible-series toggles.

**Tests and Acceptance.** TimeSeries API tests, DigitalChannel tests, LOD
render tests, 8-pen benchmark, live append benchmark.

**Definition of Done.**
- [ ] Single-pen TimeSeries renders real data.
- [ ] 8-pen TimeSeries uses LOD and legend toggles.
- [ ] DigitalChannel renders step state.
- [ ] Streaming append updates without remount.
- [ ] Tests, typecheck, lint, build, benchmark pass.

**Release gate.** Unlocks interaction work.

## Phase 4 - Interactions and Navigation

**Status.** Not started.

**Scope.** Region zoom, pan, wheel, keyboard, touch, crosshair, snap tooltip,
DataZoom, and synchronized cursor/range.

**Implementation tasks.**
- Implement screen-to-data mapping.
- Implement gesture state machines.
- Add cursor nearest-point lookup.
- Add DataZoom minimap.
- Sync cursor and ranges across `ChartSyncGroup`.
- Test interactions during streaming append.

**Tests and Acceptance.** Browser interaction tests, mobile/touch checks,
memory-leak stress test.

**Definition of Done.**
- [ ] Zoom and pan under one-frame budget.
- [ ] Cursor sync across four charts.
- [ ] Tooltip includes quality/gap/provenance.
- [ ] Interactions work during live append.

**Release gate.** Required before v1 launch packaging.

## Phase 5 - Registry, Docs, Export, Launch

**Status.** Not started.

**Scope.** shadcn registry, docs, PNG/SVG export, npm readiness, cross-browser
checks, and release gates.

**Implementation tasks.**
- Build registry blocks for TimeSeries, streaming, sync, DigitalChannel, export.
- Create docs site or Storybook.
- Implement true SVG export.
- Harden PNG export dimensions and backgrounds.
- Add npm publish dry run.
- Add bundle-size and browser matrix gates.

**Tests and Acceptance.** Registry install test, npm pack test, export tests,
browser visual checks.

**Definition of Done.**
- [ ] New user renders first chart in under five minutes.
- [ ] Registry blocks install.
- [ ] PNG and SVG export verified.
- [ ] npm packages are publishable.

**Release gate.** v1 release candidate.

## Phase 6 - Post-v1 Industrial Chart Packs

**Status.** Planned.

**Scope.** Overlay, spectral, SPC, distribution, correlation, anomaly, and KPI
packs after v1 field feedback.

**Implementation tasks.**
- Add AlarmBand, EnvelopeBand, AnomalyScoreTrack.
- Add spectrogram and power spectrum.
- Add SPC control chart surfaces.
- Add scatter/correlation/parallel coordinate surfaces.
- Add PDF export after SVG/PNG are stable.

**Tests and Acceptance.** Pack-specific unit, visual, and performance tests.

**Definition of Done.**
- [ ] Each pack has contract-only inventory before implementation.
- [ ] V1 performance is not regressed.
- [ ] Pack maturity labels are visible.

**Release gate.** Post-v1 product expansion only.

## Build Order Summary

| Phase | Primary family | Closure signal |
|---|---|---|
| 0 | Govern | Architecture docs and baseline |
| 1 | Render, Transform, Benchmark | Renderer/data tests and benchmarks |
| 2 | Compose, Theme, Synchronize | React primitive tests |
| 3 | Ingest, Normalize, Layout, Render | Real chart types |
| 4 | Interact, Synchronize | Browser interaction tests |
| 5 | Export, Package, Benchmark | npm/registry/export gates |
| 6 | Post-v1 packs | Gated industrial chart catalog |

## Universal Phase Gate

- `bun run lint` passes.
- `bun run build` passes.
- `bun run typecheck` passes after build until package resolution is fixed.
- `bun run test` passes.
- `bun run bench` passes for relevant scenarios.
- Public exports are reviewed for compatibility.
- Feature maturity labels are accurate.
- Quality/gap/provenance behavior is not weakened.

## Deliberately Not Building

- Historian query engine - owned by `pitant-historian`.
- Data acquisition - owned by `pitant-fieldlink`.
- Event bus - owned by `pitant-streams`.
- Auth and authorization - owned by `pitant-identity`.
- Product shell - owned by `pitant-web`, `pitant-client`, `pitant-mobile`.
- Control/HMI command writes - owned by future controlled repos, never here.
- Domain calculations - owned by `pitant-spc`, `pitant-oee`, `pitant-batch`,
  `pitant-energy`, `pitant-reliability`.

## Product Manageability Rules

- No chart type enters implementation without a 06 inventory section.
- No renderer-specific public data shape.
- No hidden global sync state.
- No chart pack before TimeSeries v1 is stable.
- No export artifact without degraded-state labels.
- No production claim without tests, examples, and benchmark evidence.

## Final Acceptance

This repo is feature-complete for its premium v1 target when Pitant can replace
SciChart in daily historian trend, anomaly review, and synchronized
multi-panel workflows while preserving performance, quality/gap visibility,
React composition, export behavior, and replayable view state.
