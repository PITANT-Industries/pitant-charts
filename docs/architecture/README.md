# pitant-charts - Architecture & Design Index

This folder defines the target architecture for `pitant-charts`: the Layer 6
charting library that replaces SciChart inside Pitant Systems while preserving
Pitant contracts, quality state, provenance, and performance evidence.

The implemented packages in this repository are the current executable truth.
Architecture documents describe target behavior unless a section links to code,
tests, fixtures, benchmarks, or CI evidence.

For current package entry points, local builds, and release procedures, see the
[developer guide](../getting-started.md) and [CI and delivery](../ci-cd.md).

## Read in order

| # | File | Purpose |
|---|---|---|
| 00 | [VISION.md](00-VISION.md) | Product thesis, principles, scale spectrum, and what premium charts mean |
| 01 | [COMPETITIVE-ANALYSIS.md](01-COMPETITIVE-ANALYSIS.md) | Incumbents, parity bars, displacement tests, and leapfrog points |
| 02 | [CORE-FEATURES.md](02-CORE-FEATURES.md) | Process families that should map to source modules |
| 03 | [SAFETY-AND-SECURITY.md](03-SAFETY-AND-SECURITY.md) | Display assurance tiers, IEC 62443 mapping, and mode vectors |
| 04 | [PHYSICAL-ARCHITECTURE.md](04-PHYSICAL-ARCHITECTURE.md) | Browser/package deployment shapes from workshop to fleet |
| 05 | [ROADMAP.md](05-ROADMAP.md) | Phase order, gates, and coverage map |
| 06 | [FEATURE-SPEC-INVENTORY.md](06-FEATURE-SPEC-INVENTORY.md) | Source of truth for feature scope and mode-vector tags |
| 07 | [FRONTEND-DEV-HANDOFF.md](07-FRONTEND-DEV-HANDOFF.md) | Workflow handoff, fixture expectations, and UI invariants |
| 08 | [PHASE-20-RESTRUCTURING-PLAN.md](08-PHASE-20-RESTRUCTURING-PLAN.md) | Future modular package restructuring plan |
| 09 | [PHASE-21-ENTERPRISE-READINESS-PLAN.md](09-PHASE-21-ENTERPRISE-READINESS-PLAN.md) | Future enterprise hardening and 10/10 scorecard plan |
| 10 | [USE-CASES.md](10-USE-CASES.md) | Product slices, readiness labels, and sibling repo handoffs |
| method | [PLANNING-DOC-CATALOG.md](PLANNING-DOC-CATALOG.md) | Historian-derived methodology for sibling repo planning docs |

## Build Control Artifacts

| File | Purpose |
|---|---|
| [phase-0/README.md](phase-0/README.md) | Phase 0 artifact index |
| [phase-0/baseline-report.md](phase-0/baseline-report.md) | Captured import, build, test, and benchmark baseline |
| [phase-0/gap-ledger.md](phase-0/gap-ledger.md) | Initial capability gaps against the architecture set |
| [phase-5/README.md](phase-5/README.md) | Phase 5 release-candidate artifact index |
| [phase-5/release-candidate-evidence.md](phase-5/release-candidate-evidence.md) | Local v1 package, registry, publish dry-run, and browser evidence |
| [../frontend-contracts/README.md](../frontend-contracts/README.md) | Frontend contract-pack template and planned workflow packs |

## Source of Truth

- Code, tests, fixtures, and benchmarks in this repository - executable truth.
- [06-FEATURE-SPEC-INVENTORY.md](06-FEATURE-SPEC-INVENTORY.md) - scope source of truth.
- [05-ROADMAP.md](05-ROADMAP.md) - phase order and closure gates.
- `pitant-contracts` - external target for shared wire-format contracts.
- [../../SESSION.md](../../SESSION.md) - current handoff state.

## Non-Negotiables

1. **No write paths into SIS, PLC, DCS, or control domains** - charts render and
   annotate; they never actuate.
2. **No vendor leakage** - public chart contracts never expose renderer, storage,
   or incumbent-specific names such as SciChart, ECharts, or PI as required
   schema.
3. **Contract-stable inputs** - chart data shapes are defined through Pitant
   contracts or stable package APIs before downstream apps depend on them.
4. **Quality and gap state are visible by default** - bad, uncertain, stale,
   substituted, manual, calculated, corrected, interpolated, clipped, and
   communication-failed data must not be silently hidden.
5. **Replayable visual state** - a chart view can be reconstructed from data
   range, series config, renderer version, token set, interaction state, and
   evidence metadata.
6. **Bounded memory and bounded frame cost** - every data path, worker message,
   render command list, and interaction loop has explicit budgets.
7. **Fail-safe display defaults** - when data, renderer, auth, or contract state
   is uncertain, the chart degrades visibly instead of drawing a misleading
   clean trend.
