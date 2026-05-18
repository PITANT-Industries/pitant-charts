# 09 - Phase 21 Enterprise Readiness Plan

This plan is not active yet. It defines what "enterprise-ready charting
library" means after the Phase 20 restructuring has created stable ownership.

## Planning Assumptions

| Area | Assumption |
|---|---|
| Starting point | V1 shipped and Phase 20 module ownership closed |
| Target deployment | Browser package used in regulated plant apps |
| Product profiles | workshop, plant, regulated, safety_supporting, enterprise, ai_ready, premium |
| Contract policy | shared payloads defined in `pitant-contracts` |
| Renderer policy | WebGPU primary, Canvas2D fallback remains |
| Security posture | no control writes, preserve identity/tenant/site metadata |
| Evidence standard | no production claim without tests, fixtures, docs, and benchmark evidence |

## 10/10 Scoring Rules

- 1-3: Concept, fixture, placeholder, incomplete.
- 4-5: MVP contract with useful behavior but missing production controls.
- 6-7: Strong behavior, missing browser matrix, evidence, or hardening.
- 8: Pilot-ready with bounded risks and runbooks.
- 9: Production-ready for named profiles with tested failure modes.
- 10: Enterprise-ready with repeatable install, upgrade, rollback, export,
  audit linkage, scale, security, and acceptance evidence.

No category reaches 10 without browser-matrix evidence and at least one
production-like app integration run. Local testing alone cannot score 10.

## Universal Phase Gate

### Baseline

- `bun run lint`
- `bun run build`
- `bun run typecheck`
- `bun run test`
- `bun run bench`
- Package export compatibility check
- Browser smoke test

### Contract and Compatibility

- Public TypeScript types unchanged or migrated.
- Package exports documented.
- Frontend fixtures updated for success, degraded, denied, validation-error.
- Profile-disabled behavior tested.
- Quality/gap/provenance display behavior tested.

### Enterprise Evidence

- Threat-model delta updated.
- Runbook delta updated.
- Claims-vs-evidence ledger updated.
- Browser support matrix updated.
- Bundle and dependency audit attached.

## Target Production Stack

| Layer | Reference choice | Public contract impact |
|---|---|---|
| Runtime config | Package props/options | Stable TS types |
| Data contracts | `pitant-contracts` generated clients | Stable chart payloads |
| Worker | Web Worker with transferables | Bounded messages |
| Renderer | WebGPU plus Canvas2D fallback | Capability model |
| Observability | `ChartStats`, benchmark JSON, browser diagnostics | Public diagnostic API |
| Supply chain | lockfile, npm provenance, SBOM | Release evidence |
| Deployment | npm package, registry blocks, app bundle guidance | Install contract |
| Test environment | Vitest, browser automation, visual regression | Evidence gates |

## Cross-Repo Ownership Guardrails

| Capability | Source of truth | This repo's responsibility |
|---|---|---|
| Shared data shape | `pitant-contracts` | Adapt and render |
| Auth/policy | `pitant-identity` | Preserve visible context |
| Historian query | `pitant-historian` | Display without semantic loss |
| App routing | `pitant-web` | Provide components and fixtures |
| Compliance evidence | `pitant-compliance`, `pitant-audit` | Export replay specs and labels |
| Deployment | `pitant-deploy` | Provide package constraints |

## Repo Readiness and Product Manageability Gate

- No public feature claim above pilot without acceptance evidence.
- No production badge without browser-matrix and benchmark results.
- No premium claim without contract, tests, fixtures, docs, and runbook note.
- No future-surface feature with runtime behavior enabled by default.
- No dependency added to core without explicit approval.

## Enterprise Hardening Phases

## Phase 21 - Baseline, CI, Supply Chain

**Scope.** Establish package integrity and CI evidence.

**Implementation Tasks.**
- Add package export compatibility tests.
- Add SBOM generation.
- Add dependency audit policy.
- Add npm pack dry-run CI.
- Add bundle-size gates.
- Add browser smoke CI.

**Tests and Acceptance.** CI run with artifacts.

**Release Gates.** Blocks production package claim.

**Definition of Done.**
- [ ] CI evidence attached.
- [ ] SBOM generated.
- [ ] npm package dry run passes.

## Phase 22 - Browser Matrix and Fallbacks

**Scope.** Prove WebGPU and Canvas2D behavior across supported browsers.

**Implementation Tasks.**
- Add Chrome WebGPU screenshot test.
- Add Firefox Canvas2D fallback test.
- Add Safari fallback test where runner permits.
- Add unsupported-browser warning test.
- Add renderer capability fixture.

**Tests and Acceptance.** Browser screenshots and pixel sanity checks.

**Release Gates.** Blocks regulated and plant production claims.

**Definition of Done.**
- [ ] Browser matrix passes.
- [ ] Fallback behavior visible.
- [ ] Rendered canvas is nonblank and framed.

## Phase 23 - Quality and Evidence Display Hardening

**Scope.** Ensure data uncertainty cannot be hidden.

**Implementation Tasks.**
- Add quality-code fixture set.
- Add gap fixture set.
- Add provenance labels.
- Add export warning labels.
- Add accessibility checks for degraded states.

**Tests and Acceptance.** Visual and unit tests.

**Release Gates.** Blocks regulated profile.

**Definition of Done.**
- [ ] Every quality code has expected display state.
- [ ] Exports preserve warnings.
- [ ] Data table fallback includes degraded states.

## Phase 24 - Interaction and Performance Acceptance

**Scope.** Prove chart interaction under realistic loads.

**Implementation Tasks.**
- Add 8-pen million-point browser benchmark.
- Add cursor sync benchmark.
- Add zoom/pan memory test.
- Add live append interaction test.
- Add profiler budget documentation.

**Tests and Acceptance.** Benchmark artifacts.

**Release Gates.** Blocks SciChart displacement claim.

**Definition of Done.**
- [ ] Performance budgets pass.
- [ ] No unbounded memory growth in stress test.
- [ ] Interaction latency is documented.

## Phase 25 - Install, Upgrade, Rollback, Support Bundle

**Scope.** Make package use supportable by product teams.

**Implementation Tasks.**
- Add install smoke app.
- Add migration notes.
- Add support bundle template.
- Add release checklist.
- Add compatibility matrix.

**Tests and Acceptance.** Clean checkout to first chart documented and tested.

**Release Gates.** Blocks enterprise-ready claim.

**Definition of Done.**
- [ ] Install guide works.
- [ ] Compatibility matrix published.
- [ ] Support bundle captures renderer/data diagnostics.

## Required Sub-Folder Artifacts

Under `docs/architecture/phase-21/` when Phase 21 starts:

- `enterprise-scorecard.md`
- `baseline-report.md`
- `supply-chain-policy.md`
- `release-checklist.md`
- `contract-integrity.md`
- `repo-boundary-readiness.md`
