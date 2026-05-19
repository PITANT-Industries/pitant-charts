# Frontend Contract Packs

This folder will hold one contract pack per visible chart workflow.

## Required Pack Shape

Each pack must include:

- Workflow name and actors.
- Route or package API list.
- Request/prop shape.
- Success response/state shape.
- Fixtures: success, degraded, denied, validation-error.
- State machine.
- Profile gating.
- Mode vector summary.
- Visual-regression expectation once browser harness exists.

## Planned Packs

| Workflow | File | Status |
|---|---|---|
| Historian trend | `historian-trend.md` | initial pack |
| Digital channel | `digital-channel.md` | initial pack |
| Anomaly review | `anomaly-review.md` | contract-only pack |
| SPC review | `spc-review.md` | contract-only pack |
| Scientific analysis | `scientific-analysis.md` | contract-only pack |
| Correlation workbench | `correlation-workbench.md` | contract-only pack |
| Batch profile | `batch-profile.md` | pending |
| Synchronized dashboard | `synchronized-dashboard.md` | initial pack |
| Export and evidence | `export-evidence.md` | contract-only pack |
| Migration comparison | `migration-comparison.md` | pending |
| Benchmark lab | `benchmark-lab.md` | contract-only pack |
