// SPDX-License-Identifier: MPL-2.0

'use client'

import {
  ChartLegend,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
} from '@pitant/charts-react'
import { useMemo } from 'react'

const SAMPLE_COUNT = 720
const STEP_MS = 5_000
const START = 1_735_689_600_000

function buildData(): TimeSeriesColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const reactor = new Float64Array(SAMPLE_COUNT)
  const jacket = new Float64Array(SAMPLE_COUNT)
  const reactorQuality = new Uint8Array(SAMPLE_COUNT)
  const provenance = new Uint8Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    reactor[index] = 91 + Math.sin(index / 24) * 1.8 + Math.sin(index / 7) * 0.25
    jacket[index] = 44 + Math.cos(index / 30) * 0.9
    reactorQuality[index] = index > 280 && index < 305 ? 1 : 0
    provenance[index] = index > 430 && index < 452 ? 1 : 0
  }

  return {
    timestamps,
    columns: { reactor, jacket },
    quality: { reactor: reactorQuality },
    provenance: {
      reactor: {
        labels: ['live adapter', 'historian backfill'],
        codes: provenance,
      },
    },
    gaps: [{ startIndex: 280, endIndex: 305 }],
  }
}

export function PitantTimeSeriesBlock() {
  const data = useMemo(buildData, [])
  const config = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'reactor',
          label: 'Reactor temp',
          field: 'reactor',
          color: 'hsl(220 70% 50%)',
          rgba: [0.18, 0.39, 0.86, 1],
        },
        {
          key: 'jacket',
          label: 'Jacket temp',
          field: 'jacket',
          color: 'hsl(160 60% 45%)',
          rgba: [0.11, 0.62, 0.44, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        gapThreshold: STEP_MS * 4,
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'degC',
        paddingRatio: 0.08,
      },
      renderer: 'auto',
    }),
    [],
  )

  return (
    <section className="grid gap-3">
      <div className="text-sm font-medium text-foreground">Reactor temperature trend</div>
      <TimeSeries
        ariaLabel="Reactor temperature trend"
        aspectRatio={16 / 9}
        config={config}
        data={data}
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

export default PitantTimeSeriesBlock
