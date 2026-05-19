# React Digital Channel Composition

Use this for binary, enumerated, or state-lane data: equipment running states,
permissives, interlocks, alarm active/acknowledged state, quality gates, and
mode vectors. Do not use it for continuous analog trends where interpolation,
units, and y-range scaling matter.

## Example

```tsx
import { useMemo } from 'react'
import { ChartLegend, DigitalChannel } from '@pitant/charts-react'

export function InterlockLanes() {
  const data = useMemo(
    () => ({
      timestamps: new Float64Array([0, 1_000, 2_000, 3_000, 4_000]),
      columns: {
        pump_running: new Float64Array([0, 1, 1, 1, 0]),
        inlet_valve_open: new Float64Array([0, 0, 1, 1, 1]),
        permissive_ok: new Float64Array([1, 1, 1, 0, 0]),
      },
      quality: {
        pump_running: new Uint8Array([0, 0, 0, 0, 0]),
        inlet_valve_open: new Uint8Array([0, 0, 0, 0, 0]),
        permissive_ok: new Uint8Array([0, 0, 0, 2, 2]),
      },
    }),
    [],
  )

  const config = useMemo(
    () => ({
      channels: [
        {
          key: 'pump',
          label: 'Pump running',
          field: 'pump_running',
          stateLabels: { 0: 'Stopped', 1: 'Running' },
        },
        {
          key: 'valve',
          label: 'Inlet valve',
          field: 'inlet_valve_open',
          stateLabels: { 0: 'Closed', 1: 'Open' },
        },
        {
          key: 'permissive',
          label: 'Permissive',
          field: 'permissive_ok',
          stateLabels: { 0: 'Blocked', 1: 'OK' },
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value: number) => new Date(value).toLocaleTimeString(),
      },
      channelHeight: 26,
      channelGap: 8,
      renderer: 'auto' as const,
    }),
    [],
  )

  return (
    <DigitalChannel
      ariaLabel="Interlock and permissive lanes"
      aspectRatio={16 / 6}
      config={config}
      data={data}
    >
      {(chart) => (
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
      )}
    </DigitalChannel>
  )
}
```

## Notes

- The digital renderer emits staircase geometry, not smoothed lines.
- State labels belong in config so tooltips, axis labels, accessibility tables,
  and future evidence exports can agree on names.
- Use one channel per semantic lane. Do not pack unrelated states into a single
  numeric series just to reduce lane count.

