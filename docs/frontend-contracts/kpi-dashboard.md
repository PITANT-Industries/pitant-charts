# KPI Dashboard Contract Pack

## Workflow

Compact asset KPI dashboard. Primary actors are operators, production
supervisors, reliability engineers, and OEE reviewers who need many assets on
one screen without opening raw trends.

## Package APIs

| Surface | Path or symbol | 06 section |
|---|---|---|
| Package API | `KpiStrip`, `useKpiStrip`, `KpiStripChart` | Phase 6 Chart Family Use / Do Not Use Catalog |
| Upstream owner | `pitant-oee`, `pitant-spc`, `pitant-reliability` | Whole-PITANT Composition Model |

## Prop Shape

```tsx
<KpiStrip
  ariaLabel="Asset KPI strip"
  config={{
    columns: 16,
    labels: { visible: false, maxCount: 32 },
    sparklinePointLimit: 48
  }}
  data={{
    items: [
      {
        key: 'line-01',
        label: 'Line 01',
        value: 91.8,
        unit: '%',
        status: 'normal',
        freshnessSeconds: 3,
        quality: 0.99,
        sparkline: {
          values,
          valueRange: [40, 105]
        },
        target: 88,
        lowerLimit: 62,
        upperLimit: 98
      }
    ]
  }}
/>
```

## Success State Shape

- Initial KPI Strip renders frozen upstream KPI values, status rails, compact
  labels, freshness/quality metadata, target lines, limit lines, and bounded
  sparklines.
- The package does not compute OEE, Cp/Cpk, reliability scores, alarm counts,
  or production losses. It renders values supplied by upstream domain repos.
- Dense mode hides labels by default and keeps a bounded sparkline sample count.

## Fixtures

- Success: `kpi-strip-256-assets` renders through `KpiStrip`, benchmark
  `030_kpi_strip_256_assets`, browser harness profile `kpi`, and the
  multi-axis demo KPI panel.
- Degraded: stale, offline, warning, alarm, missing value, low quality, and
  clipped sparkline states are visible.
- Denied: user lacks tenant/site/asset access for at least one KPI item.
- Validation: duplicate item key, empty item list, non-finite value, and
  mismatched sparkline policy return structured errors from the embedding app.

## State Machine

`loading -> success`
`loading -> denied`
`loading -> validation-error`
`success -> degraded`
`success -> stale`
`success -> exported`

## Profile Gating

Enabled for `plant`, `enterprise`, and `premium`. Workshop profiles may use
small strips. Regulated profiles must pair screenshots/exports with the signed
evidence workflow before the KPI view becomes a reviewed record.

## Mode Vector Summary

`[Frontend] {Proof=checksum; Workflow=observe; Sovereignty=tenant-bound; Autonomy=manual; Privacy=telemetry-only; Liability=operational}`

## Use Boundary

Use this pack for compact status scanning across many assets. Do not use it
when the user must inspect raw points, quality-code lineage, event sequence,
or evidence custody; open focused trend, SPC, OEE, reliability, or export
workflows instead.
