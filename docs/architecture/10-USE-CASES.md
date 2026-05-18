# 10 - Use Cases

## Reading Rules

- Use cases are product slices, not repo ownership transfers.
- Every use case has a readiness label: `contract_only`, `simulated`,
  `pilot`, or `production`.
- UI, docs, fixtures, and sales must use the same readiness word.
- If a sibling repo is not built, this repo may validate contracts or simulator
  evidence but must not claim sibling runtime exists.
- The default product is core daily industrial charting. Add-ons and future
  packs are explicit.

## Product Bands

| Band | Meaning |
|---|---|
| Core daily charting | Stable charting for historian trends, digital channels, synchronization, and export |
| Add-on pack | Optional profile-gated chart family from `06` |
| Pilot composition | Customer-specific trial with simulator or partial sibling readiness |
| Future reserved | Roadmap signal, disabled by default |

## Use Case Template

Each use case declares:

- Actor
- Product band
- Profiles enabled
- What this repo owns
- Other repo owners
- Readiness dependency
- Acceptance evidence
- Explicitly not owned

## Core Daily Use Cases

## Historian Trend Replacement

**Actor.** Process engineer or operator.

**Product band.** Core daily charting.

**Profiles enabled.** plant, regulated, migration, enterprise.

**What this repo owns.** Multi-pen TimeSeries rendering, quality/gap visibility,
legend, tooltip, synchronized cursor, zoom/pan, export.

**Other repo owners.** `pitant-historian` owns query/replay. `pitant-web` owns
screen routing and saved views.

**Readiness dependency.** Production requires historian contract payload and
browser performance evidence.

**Acceptance evidence.** 8-pen million-point benchmark, quality/gap fixtures,
browser screenshots, export replay spec.

**Explicitly not owned.** Historian storage, auth policy, control writes.

## Digital Channel Review

**Actor.** Controls engineer.

**Product band.** Core daily charting.

**Profiles enabled.** workshop, plant, safety_supporting.

**What this repo owns.** Staircase rendering, state labels, transition density
handling, synchronized time axis.

**Other repo owners.** `pitant-fieldlink` and `pitant-historian` own source
state and storage.

**Readiness dependency.** Production requires digital-channel contract fixture.

**Acceptance evidence.** Step geometry tests, state label visual test,
transition-stress benchmark.

**Explicitly not owned.** Device state acquisition or command writes.

## Synchronized Investigation Dashboard

**Actor.** Reliability engineer or process engineer.

**Product band.** Core daily charting.

**Profiles enabled.** plant, enterprise, ai_ready.

**What this repo owns.** Multi-chart sync, cursor propagation, x-range sync,
selection state, and chart primitives.

**Other repo owners.** `pitant-web` owns dashboard state. `pitant-sentinel`
owns anomaly signals.

**Readiness dependency.** Production requires four-panel sync test and browser
budget evidence.

**Acceptance evidence.** Sync test, interaction benchmark, degraded panel
fixture.

**Explicitly not owned.** Dashboard authoring or alert lifecycle.

## Exported Evidence View

**Actor.** Auditor, quality engineer, incident reviewer.

**Product band.** Add-on pack for regulated and safety-supporting profiles.

**Profiles enabled.** regulated, safety_supporting, enterprise.

**What this repo owns.** Export labels, replay spec, data slice manifest,
degraded-state warnings.

**Other repo owners.** `pitant-compliance` and `pitant-audit` own evidence room,
signatures, retention, and reviewer workflows.

**Readiness dependency.** Production requires signed upstream payload and export
verification.

**Acceptance evidence.** PNG/SVG/PDF export tests, replay reconstruction test,
evidence label fixture.

**Explicitly not owned.** E-signature authority or legal hold.

## Add-On Packs

## SPC Pack

**Actor.** Quality engineer.

**Band.** Add-on.

**Repo owns.** Control chart, capability histogram, rule markers, quality state
display.

**Sibling owners.** `pitant-spc` owns rule computation and limits.

**Production promotion evidence.** SPC contract fixtures, rule-marker visual
tests, export evidence fixtures.

## Batch Pack

**Actor.** Batch engineer.

**Band.** Add-on.

**Repo owns.** Batch profile, golden envelope, phase-aligned comparison.

**Sibling owners.** `pitant-batch` owns batch genealogy and phase boundaries.

**Production promotion evidence.** Batch fixture packs and alignment tests.

## Anomaly Pack

**Actor.** Reliability engineer, data scientist.

**Band.** Add-on.

**Repo owns.** Anomaly score tracks, detector heatmaps, root-cause bars.

**Sibling owners.** `pitant-sentinel`, `pitant-model-registry`, and
`pitant-copilot` own detector outputs and explanations.

**Production promotion evidence.** Model-version labels, cited evidence window,
unsupported-answer rejection.

## Migration Pack

**Actor.** Platform engineer or customer migration lead.

**Band.** Pilot composition.

**Repo owns.** Side-by-side SciChart/incumbent visual comparison, drift markers,
view equivalence fixtures.

**Sibling owners.** `pitant-integrations` and `pitant-historian` own import,
mapping, and parallel-run evidence.

**Production promotion evidence.** Incumbent comparison fixture and signed
replacement report.

## Composition Examples

## Mid-Size Pharma Site

Core daily charting plus regulated evidence export plus SPC pack. Production
claim requires signed historian payloads, Part 11 evidence handoff through
`pitant-compliance`, and SPC fixtures from `pitant-spc`.

## Refinery Investigation

Core daily charting plus safety-supporting profile plus anomaly pack. Production
claim requires no-write proof, quality/gap fixtures, multi-panel performance,
and incident evidence export.

## Greenfield Gigafactory

Core daily charting plus enterprise/federation plus OEE, batch, energy, and
anomaly packs. Production claim requires browser budget gates and per-site
sovereignty labels in synchronized views.
