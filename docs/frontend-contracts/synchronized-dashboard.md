# Synchronized Dashboard Contract Pack

## Workflow

Synchronized multi-panel chart dashboard. Primary actors are process engineers,
reliability engineers, and anomaly investigators comparing related signals in
one tenant/site context.

## Route Or Package API List

| Surface | Path or symbol | 06 section |
|---|---|---|
| Sync provider | `ChartSyncGroup` from `@pitant/charts-react` | Synchronize Inventory |
| Sync hook | `useChartSync()` from `@pitant/charts-react` | Synchronize Inventory |
| Trend panel | `TimeSeries` from `@pitant/charts-react` | Compose Inventory |
| Digital panel | `DigitalChannel` from `@pitant/charts-react` | Compose Inventory |

## Request Or Prop Shape

```tsx
<ChartSyncGroup sync={['cursor', 'xRange']}>
  <TrendPanel chartKey="temperature" />
  <TrendPanel chartKey="pressure" />
  <DigitalPanel chartKey="permissives" />
</ChartSyncGroup>
```

## Success State Shape

- All panels render inside one visible workflow.
- Each panel has a stable `chartKey`.
- Shared sync state carries `cursorTimestamp`, `xRange`, and `source`.
- Source chart ignores its own echoed update.
- `TimeSeries` and `DigitalChannel` publish local x-range changes and apply
  peer ranges when the update came from another `chartKey`.
- Local cursor hover publishes the nearest timestamp; peer panels rebuild
  tooltip payloads from their own visible data and render a vertical sync
  cursor without a synthetic horizontal crosshair.
- Pan and keyboard navigation publish through the same x-range path as zoom, so
  peer panels move with the initiating chart when sync includes `xRange`.
- DataZoom track recentering, window drag, and handle resizing publish through
  the same x-range path when a synchronized panel opts into `dataZoom`.
- Touch pan and pinch publish through the same x-range path, so synchronized
  panels move together when sync includes `xRange`.

## Fixtures

- Success: two analog trends and one digital lane share a site-local x-range,
  cursor timestamp, peer tooltip payload, and vertical sync cursor marker.
- Degraded: one panel has a gap while the others remain synchronized and the
  degraded panel tooltip exposes the gap state instead of hiding it.
- Denied: one panel is hidden by app authorization and does not publish sync
  state.
- Validation-error: duplicate `chartKey` is rejected by the containing app
  fixture.

## State Machine

`ready -> local-range-changed -> sync-published -> peer-applied`

`ready -> cursor-updated -> peer-cursor-visible`

`ready -> panel-denied -> ready`

`ready -> sync-conflict -> conflict-visible`

## Profile Gating

Enabled for `plant`, `regulated`, `migration`, `enterprise`, `ai_ready`, and
`premium`. Disabled across tenant/site/evidence boundaries unless the
containing workflow declares scope explicitly.

## Mode Vector Summary

`{Proof=checksum; Workflow=inspect; Sovereignty=site-local; Autonomy=manual; Privacy=telemetry-only; Liability=operational}`

## Phase Boundary

Phase 3 exposes the sync provider and hook contract. Phase 4 now implements
cursor, x-range, pan/scroll, keyboard, touch, and opt-in DataZoom behavior for
TimeSeries and DigitalChannel. Phase 4 still owns stress and latency evidence
before the interaction family can close.
