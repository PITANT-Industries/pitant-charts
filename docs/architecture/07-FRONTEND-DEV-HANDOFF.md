# 07 - Frontend Developer Handoff

This document is consumed by `pitant-web`, `pitant-client`,
`pitant-hmi-sdk`, and `pitant-mobile`. It converts the chart roadmap and feature
inventory into workflow and fixture expectations.

## Frontend Rules

- Always show quality, gap, provenance, and evidence state when values depend on
  them.
- Never silently hide bad, uncertain, stale, substituted, manual, calculated,
  corrected, interpolated, clipped, saturated, out-of-service, or
  communication-failed data.
- Never imply direct PLC, DCS, SIS, or actuator write authority.
- Always preserve tenant, site, zone, asset, trace, and audit linkage in saved
  views and exports when the upstream payload supplies it.
- AI/advisory views must show citations, model/version, approval state, and the
  chart evidence window before conclusions.
- Regulated, safety, forensic, and dispute workflows must expose custody,
  signatures, reviewers, holds, degraded states, and verification status.
- Fallback renderer or degraded performance must be visible when it changes user
  expectations.

## Primary Workflow Groups

| Workflow | Primary users | Route/component groups | Required UI states |
|---|---|---|---|
| Historian trend | Operators, process engineers | `TimeSeries`, `ChartLegend`, `ChartTooltip`, `ChartSyncGroup`, `ChartDataZoom` | loading, empty, partial-gap, quality-degraded, stale, corrected, live, paused, panned, keyboard-navigated, touch-panned, pinch-zoomed, datazoom-active, fallback-renderer, timed-out |
| Digital channel | Controls engineers | `DigitalChannel`, `ChartDataZoom`, state labels | loading, empty, stale, unknown-state, transition-dense, panned, keyboard-navigated, touch-panned, pinch-zoomed, datazoom-active, fallback-renderer |
| Anomaly review | Reliability, data science | anomaly tracks, root cause overlays | loading, no-evidence, detector-missing, signed-result, model-version-missing, denied |
| SPC review | Quality engineers | control chart, capability histogram | loading, no-limits, rule-violation, quality-degraded, signed-result, validation-error |
| Scientific analysis | Vibration, controls, power quality specialists | spectrogram, spectrum, Bode response | loading, irregular-cadence, sampling-rate-missing, tile-degraded, linked-trend-ready, denied, validation-error |
| Correlation workbench | Process engineers, data scientists | scatter, correlation matrix, parallel coordinates | loading, sampled-density, brushing, missing-data, linked-trend-ready, causality-warning, denied, validation-error |
| Batch profile | Batch engineers | batch profile, golden envelope | loading, no-batch, partial-batch, misaligned-phase, signed-result |
| Synchronized dashboard | Operators, engineers | `ChartSyncGroup`, DataZoom | loading, partial-panel-fail, synced-cursor, synced-range, panned, keyboard-navigated, touch-panned, pinch-zoomed, datazoom-active, sync-conflict, cross-site-denied, high-cost |
| Export and evidence | Auditors, engineers | export API, replay spec | proof-ready, no-evidence, degraded, denied, regulator-review, export-failed |
| Migration comparison | Engineers, admins | SciChart/incumbent parity fixture | loading, side-by-side, drift-detected, source-missing, validation-error |
| Benchmark lab | Maintainers | benchmark app | running, pass, fail, regression, unsupported-browser |
| Chart docs and blocks | App developers | registry examples | loading, simulated, contract_only, pilot, production |

## Contract Pack Format

Each frontend workflow gets `/docs/frontend-contracts/{workflow}.md` with:

- Workflow name and primary actors.
- Route or package API list with links to `06-FEATURE-SPEC-INVENTORY.md`.
- Request or prop shape with JSON/TypeScript examples.
- Success response or state shape.
- At minimum four fixtures: success, degraded, denied, validation-error.
- State machine for transitions.
- Profile gating.
- Mode vector summary.
- Screenshot or visual-regression expectation once browser harness exists.

## Fixture Requirements

- Success: realistic happy path with real-looking plant data.
- Degraded: at least one quality, gap, fallback, or provenance state visible.
- Denied: profile gate, tenant mismatch, or no-evidence reason visible.
- Validation: structured error state with actionable field/path message.

## Profile Gating Map

| Profile | Workflows enabled |
|---|---|
| workshop | simple TimeSeries, DigitalChannel, local export |
| plant | historian trend, synchronized dashboard, live append |
| regulated | evidence export, signed result labels, replay spec |
| safety_supporting | no-write warnings, degraded display enforcement |
| migration | side-by-side incumbent comparison |
| enterprise | federation-aware dashboards, package provenance |
| ai_ready | cited anomaly and copilot evidence windows |
| premium | persistent data tips, ruler, advanced overlays, scientific analysis, correlation workbench |
| future | disabled first-owner prototypes with preview labels |

## Status Mapping In UI

- `contract_only`: visible docs badge; no runtime claim.
- `simulated`: preview badge; fixture-only or fake-data examples.
- `pilot`: gated behind profile flag and release note warning.
- `production`: shown without preview label only after tests, fixtures, docs, and
  benchmark evidence exist.

## AI/Advisory Guardrails

- Citations before conclusions.
- Unsupported answers are rejected.
- Prompt and answer audit trails are accessible to admins through sibling repos.
- Generated content cannot create a control write.
- Model/version is visible on every AI-linked overlay.

## Contract Pack Index

| Workflow | Pack |
|---|---|
| Historian trend | [historian-trend.md](../frontend-contracts/historian-trend.md) |
| Digital channel | [digital-channel.md](../frontend-contracts/digital-channel.md) |
| Anomaly review | [anomaly-review.md](../frontend-contracts/anomaly-review.md) |
| SPC review | [spc-review.md](../frontend-contracts/spc-review.md) |
| Scientific analysis | [scientific-analysis.md](../frontend-contracts/scientific-analysis.md) |
| Correlation workbench | [correlation-workbench.md](../frontend-contracts/correlation-workbench.md) |
| Batch profile | `../frontend-contracts/batch-profile.md` |
| Synchronized dashboard | [synchronized-dashboard.md](../frontend-contracts/synchronized-dashboard.md) |
| Export and evidence | [export-evidence.md](../frontend-contracts/export-evidence.md) |
| Migration comparison | `../frontend-contracts/migration-comparison.md` |
| Benchmark lab | [benchmark-lab.md](../frontend-contracts/benchmark-lab.md) |
