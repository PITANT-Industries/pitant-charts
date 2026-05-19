# Benchmark Lab Contract Pack

## Workflow

Benchmark lab exposes performance fixtures, renderer choice, frame timing,
memory budget, and browser matrix evidence for engineering review. Primary
actors are chart maintainers, release owners, and performance reviewers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Benchmark app | `apps/benchmark` scenarios | Benchmark Inventory |
| Browser harness | `apps/render-harness` | Benchmark Inventory |
| Verification script | `scripts/verify-render-harness.mjs` | Browser Matrix and Hardware Classes |
| Cross-browser script | `scripts/verify-cross-browser.mjs` | Browser Matrix and Hardware Classes |

## Request Or Prop Shape

```ts
runBenchmarkLab({
  fixture: 'trend-8x1m',
  renderer: 'canvas2d',
  profile: 'compact',
  benchmarkProfile: 'strict',
})
```

## Success State Shape

- Fixture, renderer, browser, hardware class, benchmark profile, point count,
  frame time, memory delta, and pass/fail target are visible.
- Strict local profile and CI hosted-runner profile are visibly distinct.
- Baseline update is disabled unless the strict profile is selected.
- Browser smoke includes nonblank pixel checks before FPS claims are accepted.

## Fixtures

- Success: all required performance fixtures execute with pass/fail reporting.
- Degraded: WebGPU unavailable, Canvas2D fallback active, or browser denies GPU.
- Denied: baseline update attempted from CI or non-strict profile.
- Validation-error: unknown fixture, renderer, profile, or benchmark target.

## State Machine

`idle -> running -> passed`

`idle -> running -> failed`

`idle -> denied`

`idle -> validation-error`

## Profile Gating

Enabled for maintainers in every profile. Hidden from ordinary operators and
auditors unless an evidence pack references benchmark results.

## Mode Vector Summary

`{Proof=checksum; Workflow=approve; Sovereignty=local-only; Autonomy=manual; Privacy=telemetry-only; Liability=engineering-review}`

## Use Boundary

Use this pack to prove performance claims and diagnose regressions. Do not use
it as an operator dashboard, customer-facing chart workflow, or substitute for
feature-specific acceptance tests.
