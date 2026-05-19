# Correlation Workbench Contract Pack

## Workflow

Correlation workbench supports scatter, correlation matrix, and parallel
coordinates for multivariate exploration. Primary actors are process engineers,
data scientists, reliability engineers, and model-prep reviewers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Future chart | `ScatterPlot` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Package API | `CorrelationMatrix`, `useCorrelationMatrix`, `CorrelationMatrixChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
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

<CorrelationMatrix
  ariaLabel="128-variable correlation matrix"
  config={{
    minSampleCount: 100,
    labels: { visible: true, maxCount: 24 },
    xAxis: { label: 'Source variable' },
    yAxis: { label: 'Target variable' }
  }}
  data={{
    variables,
    values: correlationValues,
    sampleCounts,
    missingCounts,
    mask
  }}
/>
```

## Success State Shape

- Scatter plots support brushing, density fallback, selection summaries, and
  linked trend handoff.
- Initial CorrelationMatrix renders frozen upstream coefficients, missing-data
  state, low-sample state, masked cells, labels, SVG export, and refuses to
  imply causality or lag discovery.
- Parallel coordinates show sampled density mode and axis brushing.
- Every exported selection carries variable list, sample-set identity, time
  bounds, filter policy, and tenant/site scope.

## Fixtures

- Success: `correlation-matrix-128vars` renders through `CorrelationMatrix`,
  benchmark `029_correlation_matrix_128vars`, and browser harness profile
  `correlation`; `scatter-500k-brush` and `parallel-coordinates-20k` remain
  contract-only.
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

Initial CorrelationMatrix is enabled for `enterprise`, `ai_ready`, and
`premium`, with plant profiles allowed for bounded engineering review. Scatter
and parallel-coordinate surfaces remain pilot-only until their fixtures move
beyond `contract_only`.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=engineering-review}`

## Use Boundary

Use this pack for relationship discovery and sample selection from a frozen
matrix. Do not use it for causality claims, autonomous recommendations, lag
discovery, model explanation, or regulator-facing evidence without analytics
handoff and a signed export/evidence workflow.
