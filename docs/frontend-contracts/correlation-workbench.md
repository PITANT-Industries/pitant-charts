# Correlation Workbench Contract Pack

## Workflow

Correlation workbench supports scatter, correlation matrix, and parallel
coordinates for multivariate exploration. Primary actors are process engineers,
data scientists, reliability engineers, and model-prep reviewers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Future chart | `ScatterPlot` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `CorrelationMatrix` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `ParallelCoordinates` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Handoff owner | `pitant-model-registry` for model features | Whole-PITANT Composition Model |

## Request Or Prop Shape

```ts
<CorrelationWorkbench
  ariaLabel="Reactor operating-state correlation review"
  variables={variables}
  sampleSet={sampleSet}
  brushing={brushingState}
  linkedTimeRange={linkedTimeRange}
/>
```

## Success State Shape

- Scatter plots support brushing, density fallback, selection summaries, and
  linked trend handoff.
- Correlation matrix shows missing-data state and refuses to imply causality.
- Parallel coordinates show sampled density mode and axis brushing.
- Every exported selection carries variable list, sample-set identity, time
  bounds, filter policy, and tenant/site scope.

## Fixtures

- Success: `scatter-500k-brush`, `correlation-matrix-128vars`, and
  `parallel-coordinates-20k` render and round-trip brushed selections.
- Degraded: missing values, mixed units, sampled rows, and density fallback are
  visible.
- Denied: user lacks access to one or more variables in the requested matrix.
- Validation-error: variables have incompatible tenant/site scope or no shared
  sample-set identity.

## State Machine

`loading -> ready -> brushing -> selection-exported`

`loading -> degraded`

`loading -> denied`

`loading -> validation-error`

## Profile Gating

Enabled for `enterprise`, `ai_ready`, and `premium`. Pilot-only for plant
profiles until model/dataset handoff contracts are production-ready.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}`

## Use Boundary

Use this pack for relationship discovery and sample selection. Do not use it
for causality claims, autonomous recommendations, or regulator-facing evidence
without a signed export/evidence workflow.
