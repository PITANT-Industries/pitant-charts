# Synchronized Dashboard Composition

Use `ChartSyncGroup` when multiple charts in one workflow need shared cursor or
x-range state. Do not use it across tenants, sites, evidence contexts, or
authorization boundaries unless the app passes explicit scope metadata and the
workflow is reviewed.

Phase 3 exposes the sync state contract. Phase 4 owns automatic cursor, zoom,
and pan interaction wiring. The example below therefore shows manual range
publication and application without claiming finished interaction behavior.

## Example

```tsx
import type { ComponentProps } from 'react'
import { ChartSyncGroup, TimeSeries, useChartSync } from '@pitant/charts-react'

type TrendProps = ComponentProps<typeof TimeSeries>

function SyncedTrend({
  chartKey,
  config,
  data,
}: {
  chartKey: string
  config: TrendProps['config']
  data: TrendProps['data']
}) {
  const { isSynced, syncState, updateXRange } = useChartSync(chartKey)

  return (
    <TimeSeries ariaLabel={`${chartKey} trend`} config={config} data={data}>
      {(chart) => {
        const hasLocalRange = chart.visibleRange[0] < chart.visibleRange[1]
        const remoteRange =
          syncState.source !== chartKey && syncState.xRange ? syncState.xRange : null

        return (
          <div
            style={{
              position: 'absolute',
              right: 12,
              top: 8,
              display: 'flex',
              gap: 8,
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              disabled={!isSynced || !hasLocalRange}
              onClick={() =>
                updateXRange(
                  hasLocalRange
                    ? [chart.visibleRange[0], chart.visibleRange[1]]
                    : null,
                )
              }
            >
              Share range
            </button>
            <button
              type="button"
              disabled={!remoteRange}
              onClick={() => {
                if (remoteRange) chart.setVisibleRange(remoteRange)
              }}
            >
              Apply range
            </button>
          </div>
        )
      }}
    </TimeSeries>
  )
}

export function ProcessDashboard({
  pressure,
  temperature,
  config,
}: {
  pressure: TrendProps['data']
  temperature: TrendProps['data']
  config: {
    pressure: TrendProps['config']
    temperature: TrendProps['config']
  }
}) {
  return (
    <ChartSyncGroup sync={['cursor', 'xRange']} className="pitant-chart-grid">
      <SyncedTrend chartKey="temperature" config={config.temperature} data={temperature} />
      <SyncedTrend chartKey="pressure" config={config.pressure} data={pressure} />
    </ChartSyncGroup>
  )
}
```

## Notes

- Use one sync group per visible workflow. Nested sync groups should be rare and
  must have clear ownership.
- Use stable `chartKey` values. They are used to avoid echoing local updates
  back into the source chart.
- Do not store `SyncState` as evidence. If a replayable investigation needs
  persisted view state, hand off to the evidence/export workflow.
