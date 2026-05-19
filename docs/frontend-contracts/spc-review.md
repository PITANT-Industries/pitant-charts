# SPC Review Contract Pack

## Workflow

SPC review renders quality control charts and capability views supplied by
`pitant-spc`. Primary actors are quality engineers, process engineers, batch
reviewers, and regulated-site approvers.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| React config | `TimeSeriesConfig.spcTracks[]` control limits and rule markers | Phase 6 Chart Family Use / Do Not Use Catalog |
| Package API | `Distribution`, `useDistribution`, `DistributionChart` for frozen capability histograms | Phase 6 Chart Family Use / Do Not Use Catalog |
| Upstream owner | `pitant-spc` rule and limit contracts | Whole-PITANT Composition Model |

## Request Or Prop Shape

```ts
<TimeSeries
  ariaLabel="Tablet weight Xbar/R review"
  data={subgroupTimeSeriesData}
  config={{
    series: [{ key: 'xbar', label: 'Xbar', field: 'xbar' }],
    spcTracks: [{
      key: 'xbar-approved-limits',
      chartKind: 'xbar',
      centerLine: approvedLimits.center,
      upperControlLimit: approvedLimits.ucl,
      lowerControlLimit: approvedLimits.lcl,
      upperWarningLimit: approvedLimits.uwl,
      lowerWarningLimit: approvedLimits.lwl,
      markers: westernElectricRules.violations,
    }],
  }}
/>
```

## Success State Shape

- Control limits, center line, subgroup labels, and violation markers are
- Control limits, warning limits, center line, subgroup labels, and sparse
  violation markers are visible without obscuring the plotted samples.
- Capability histogram shows spec limits, bin policy, outlier handling, Cp,
  Cpk, Pp, and Ppk from `pitant-spc`, while `Distribution` renders the frozen
  bins and spec/target/percentile markers.
- Rule names and limit provenance are visible in tooltip, app metadata, or
  sibling evidence surfaces before production claim.
- Chart never computes authoritative SPC rules unless `pitant-spc` provided the
  approved rule contract.

## Fixtures

- Success: `spc-xbar-r-10k` renders through
  `025_time_series_spc_tracks_10k` and through the render harness `spc`
  browser profile with approved limits, named rules, and no missing subgroups.
- Success: `capability-histogram-100k` renders the frozen histogram surface
  through `Distribution`, benchmark `028_distribution_1m_window_512_bins`, and
  render-harness profile `distribution`; authoritative capability metrics still
  come from `pitant-spc`.
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

Use this pack for approved SPC and capability review where `pitant-spc`
supplies limits and rule outputs. Do not use it for ad hoc histograms,
exploratory correlations, unapproved quality rule calculation, or control
advice.
