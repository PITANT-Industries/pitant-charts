# Digital Channel Contract Pack

## Workflow

Digital channel lanes. Primary actors are operators, controls engineers,
maintenance engineers, and investigation teams comparing state changes against
analog trends.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| React component | `DigitalChannel` from `@pitant/charts-react` | Compose Inventory |
| React hook | `useDigitalChannel()` from `@pitant/charts-react` | Compose Inventory |
| Core chart class | `DigitalChannelChart` from `@pitant/charts` | Compose Inventory |
| Core render plan | `buildDigitalChannelRenderPlan()` from `@pitant/charts` | Render Inventory |

## Request Or Prop Shape

```ts
<DigitalChannel
  ariaLabel="Interlock and permissive lanes"
  config={digitalChannelConfig}
  data={columnarStateData}
/>
```

## Success State Shape

- Canvas has nonblank staircase lane pixels.
- Each lane has a stable label and state-label map.
- Hovering inside the plot shows a crosshair and nearest-state tooltip.
- Tooltip rows use channel state labels when configured and include quality,
  gap, and provenance metadata when supplied.
- Horizontal wheel, shifted scroll, Alt-drag, and focused keyboard shortcuts
  move or zoom the x-range while preserving lane geometry.
- When `dataZoom` is enabled, the chart shows an opt-in fixed-sample minimap
  using the first visible channel as the overview signal.
- On touch devices, one-finger drag pans the x-window and two-finger pinch zooms
  the x-range without changing lane geometry.
- Legend toggles hide channels before render-plan generation.
- `chart.stats.segmentCount` is greater than zero.
- `chart.error` is `null`.

## Fixtures

- Success: three lanes with binary states, all-good quality, tooltip state
  labels for visible lanes, panned/keyboard navigation states, and opt-in
  DataZoom/touch interaction.
- Degraded: one lane has bad or communication-failed quality over a state
  change, carries a provenance label such as `interlock replay`, and the tooltip
  exposes that degraded metadata.
- Denied: profile gate blocks the containing app workflow before chart props
  are constructed.
- Validation-error: a channel references a missing column and produces a
  warning/degraded state rather than a blank silent chart.

## State Machine

`loading -> ready -> channel-hidden -> ready`

`loading -> degraded -> ready`

`loading -> denied`

`loading -> validation-error`

## Profile Gating

Enabled for `plant`, `regulated`, `safety_supporting`, `migration`,
`enterprise`, and `premium`. Safety-supporting views must preserve quality and
scope labels supplied by upstream systems.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}`

## Visual Regression Expectation

Browser harness must cover at least one dense digital-lane profile before this
workflow can claim production readiness.
