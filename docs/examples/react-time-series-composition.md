# React Time-Series Composition

Use this for the normal historian-trend surface: continuous values, multi-pen
legend toggles, renderer fallback, and optional streaming append. Do not use it
for digital state lanes, non-React shells, or app-level workflow state.

## Example

```tsx
import { useMemo } from 'react'
import { ChartLegend, ChartTooltip, TimeSeries } from '@pitant/charts-react'

export function HistorianTrend() {
  const data = useMemo(
    () => ({
      timestamps: new Float64Array([0, 1_000, 2_000, 3_000, 4_000]),
      columns: {
        reactor_temp: new Float64Array([91.2, 91.4, 91.1, 91.8, 92.0]),
        jacket_temp: new Float64Array([44.1, 44.3, 44.4, 44.2, 44.6]),
        reactor_expected_low: new Float64Array([90.8, 90.9, 90.9, 91.0, 91.1]),
        reactor_expected_high: new Float64Array([92.0, 92.1, 92.1, 92.2, 92.3]),
      },
      quality: {
        reactor_temp: new Uint8Array([0, 0, 1, 0, 0]),
        jacket_temp: new Uint8Array([0, 0, 0, 0, 0]),
      },
      gaps: [{ startIndex: 2, endIndex: 3 }],
    }),
    [],
  )

  const config = useMemo(
    () => ({
      series: [
        { key: 'reactor', label: 'Reactor temp', field: 'reactor_temp' },
        { key: 'jacket', label: 'Jacket temp', field: 'jacket_temp' },
      ],
      bands: [
        {
          kind: 'value-band' as const,
          key: 'high-warning',
          label: 'High warning',
          yStart: 92,
          yEnd: 94,
          fillRgba: [1, 0.16, 0.05, 0.12],
          lineRgba: [1, 0.16, 0.05, 0.7],
        },
        {
          kind: 'envelope' as const,
          key: 'expected-window',
          label: 'Expected window',
          lowerField: 'reactor_expected_low',
          upperField: 'reactor_expected_high',
          fillRgba: [0.1, 0.4, 1, 0.1],
        },
      ],
      annotations: [
        {
          kind: 'x-line' as const,
          key: 'batch-start',
          label: 'Batch start',
          x: 1_000,
        },
        {
          kind: 'ruler' as const,
          key: 'reactor-ramp',
          label: 'Ramp',
          xStart: 1_000,
          xEnd: 4_000,
          yStart: 91.4,
          yEnd: 92.0,
        },
      ],
      eventMarkers: [
        {
          key: 'batch-start',
          label: 'B42',
          x: 1_000,
          eventType: 'batch' as const,
          labelVisible: true,
        },
        {
          key: 'hi-temp-alarm',
          label: 'HI',
          x: 3_000,
          eventType: 'alarm' as const,
          placement: 'full-height' as const,
        },
      ],
      xAxis: {
        label: 'Time',
        gapThreshold: 90_000,
        formatValue: (value: number) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'degC',
        paddingRatio: 0.08,
      },
      renderer: 'auto' as const,
    }),
    [],
  )

  return (
    <TimeSeries
      ariaLabel="Reactor temperature trend"
      aspectRatio={16 / 9}
      config={config}
      data={data}
      streaming={{ liveEdge: true, windowSize: 15 * 60_000 }}
    >
      {(chart) => (
        <>
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 8,
              pointerEvents: 'auto',
            }}
          >
            <ChartLegend
              items={chart.legendItems}
              onToggle={(key) => chart.toggleSeries(key)}
            />
          </div>
          <ChartTooltip payload={chart.tooltipPayload} position={chart.tooltipPosition} />
        </>
      )}
    </TimeSeries>
  )
}
```

## Notes

- `chart.tooltipPayload` is `null` until Phase 4 crosshair/snap interaction
  logic supplies a hover source. Keep `ChartTooltip` mounted anyway; this fixes
  the future composition slot.
- `chart.append(nextData)` is the streaming path. It preserves the data-source
  hot path and live-edge range instead of rebuilding the chart.
- Legend toggles filter series before render-plan generation, so hidden pens do
  not pay draw cost.
- `config.bands` renders value bands and envelope bands inside the core command
  frame, not as per-point React elements.
- `config.annotations` renders reviewed reference lines, region highlights, and
  rulers inside the core command frame so export uses the same geometry.
- `config.eventMarkers` renders sparse starts, stops, alarms, comments,
  batches, holds, corrections, maintenance events, and investigation pins as
  time-axis ticks inside the core command frame.
- Quality and gap arrays stay in the data object so degraded states can be
  surfaced by overlays and future evidence exports.
