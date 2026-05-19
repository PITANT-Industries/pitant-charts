# SPC Review Contract Pack

## Workflow

SPC review renders quality control charts and capability views supplied by
`pitant-spc`. Primary actors are quality engineers, process engineers, batch
reviewers, and regulated-site approvers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Future chart | `SpcControlChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `CapabilityHistogram` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Future chart | `DistributionPanel` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Upstream owner | `pitant-spc` rule and limit contracts | Whole-PITANT Composition Model |

## Request Or Prop Shape

```ts
<SpcControlChart
  ariaLabel="Tablet weight Xbar/R review"
  series={subgroupSeries}
  limits={approvedLimits}
  rules={westernElectricRules}
  capability={capabilitySummary}
/>
```

## Success State Shape

- Control limits, center line, subgroup labels, and violation markers are
  visible without obscuring the plotted samples.
- Capability histogram shows spec limits, bin policy, outlier handling, Cp,
  Cpk, Pp, and Ppk.
- Rule names and limit provenance are visible in tooltip and export metadata.
- Chart never computes authoritative SPC rules unless `pitant-spc` provided the
  approved rule contract.

## Fixtures

- Success: `spc-xbar-r-10k` plus `capability-histogram-100k` with approved
  limits, named rules, and no missing subgroups.
- Degraded: missing subgroup, stale limit, held sample, and one substituted
  value are all visible.
- Denied: user lacks `quality.review` or the tenant profile excludes regulated
  quality workflows.
- Validation-error: values arrive without subgroup identity or sampling cadence.

## State Machine

`loading -> ready -> rule-violation -> review-ready`

`loading -> denied`

`loading -> validation-error`

`review-ready -> signed`

## Profile Gating

Enabled for `regulated`, `enterprise`, and `premium`. Pilot-enabled for
`plant` only when `pitant-spc` supplies simulated rule output.

## Mode Vector Summary

`{Proof=signed; Workflow=approve; Sovereignty=tenant-bound; Autonomy=assisted; Privacy=confidential; Liability=quality-impacting}`

## Use Boundary

Use this pack for approved SPC and capability review. Do not use it for ad hoc
histograms, exploratory correlations, or unapproved quality rule calculation.
