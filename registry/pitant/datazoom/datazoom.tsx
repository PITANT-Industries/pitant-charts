// SPDX-License-Identifier: MPL-2.0

'use client'

import {
  ChartLegend,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
} from '@pitant/charts-react'
import { useMemo } from 'react'

const SAMPLE_COUNT = 2_400
const STEP_MS = 2_000
const START = 1_735_689_600_000

function buildData(): TimeSeriesColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const flow = new Float64Array(SAMPLE_COUNT)
  const pressure = new Float64Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    flow[index] = 480 + Math.sin(index / 40) * 18 + Math.sin(index / 5) * 3
    pressure[index] = 7.2 + Math.cos(index / 50) * 0.35 + Math.sin(index / 9) * 0.05
  }

  return {
    timestamps,
    columns: { flow, pressure },
    provenance: { flow: 'live adapter', pressure: 'live adapter' },
  }
}

export function PitantDataZoomBlock() {
  const data = useMemo(buildData, [])
  const config = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'flow',
          label: 'Feed flow',
          field: 'flow',
          color: 'hsl(220 70% 50%)',
          rgba: [0.18, 0.39, 0.86, 1],
        },
        {
          key: 'pressure',
          label: 'Pressure',
          field: 'pressure',
          color: 'hsl(30 80% 55%)',
          rgba: [0.89, 0.42, 0.12, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      yAxis: { paddingRatio: 0.1 },
      renderer: 'auto',
    }),
    [],
  )

  return (
    <section className="grid gap-3">
      <div className="text-sm font-medium text-foreground">Feed overview with DataZoom</div>
      <TimeSeries
        ariaLabel="Feed overview with DataZoom"
        aspectRatio={16 / 9}
        config={config}
        data={data}
        dataZoom
      >
        {(chart) => (
          <div className="absolute left-3 top-2 pointer-events-auto">
            <ChartLegend
              items={[...chart.legendItems]}
              onToggle={(key) => chart.toggleSeries(key)}
            />
          </div>
        )}
      </TimeSeries>
    </section>
  )
}

export default PitantDataZoomBlock
