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
  const temperature = new Float64Array(SAMPLE_COUNT)
  const pressure = new Float64Array(SAMPLE_COUNT)
  const flow = new Float64Array(SAMPLE_COUNT)
  const quality = new Uint8Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    temperature[index] = 88 + Math.sin(index / 28) * 3.5 + Math.sin(index / 9) * 0.4
    pressure[index] = 7.4 + Math.cos(index / 33) * 0.42 + Math.sin(index / 11) * 0.06
    flow[index] = 510 + Math.sin(index / 35) * 42 + Math.cos(index / 8) * 7
    quality[index] = index > 410 && index < 430 ? 1 : 0
  }

  return {
    timestamps,
    columns: { temperature, pressure, flow },
    quality: { flow: quality },
    provenance: {
      temperature: 'live adapter',
      pressure: 'live adapter',
      flow: 'calculated mass balance',
    },
    gaps: [{ startIndex: 410, endIndex: 430 }],
  }
}

const config: TimeSeriesConfig = {
  series: [
    {
      key: 'temperature',
      label: 'Temperature',
      field: 'temperature',
      yAxisKey: 'temperature',
      color: 'hsl(220 70% 50%)',
      rgba: [0.18, 0.39, 0.86, 1],
    },
    {
      key: 'pressure',
      label: 'Pressure',
      field: 'pressure',
      yAxisKey: 'pressure',
      color: 'hsl(30 80% 55%)',
      rgba: [0.89, 0.42, 0.12, 1],
    },
    {
      key: 'flow',
      label: 'Flow',
      field: 'flow',
      yAxisKey: 'flow',
      color: 'hsl(160 60% 45%)',
      rgba: [0.11, 0.62, 0.44, 1],
    },
  ],
  xAxis: {
    label: 'Time',
    formatValue: (value) => new Date(value).toLocaleTimeString(),
  },
  yAxes: [
    { key: 'temperature', label: '°C', range: [82, 95], formatValue: (value) => value.toFixed(1) },
    { key: 'pressure', side: 'right', label: 'bar', formatValue: (value) => value.toFixed(2) },
    { key: 'flow', side: 'right', label: 'kg/h', formatValue: (value) => value.toFixed(0) },
  ],
  renderer: 'auto',
}

export function PitantMultiAxisBlock() {
  const data = useMemo(buildData, [])

  return (
    <TimeSeries
      ariaLabel="Temperature, pressure, and flow trend with independent value axes"
      aspectRatio={16 / 8}
      config={config}
      data={data}
      dataZoom
    >
      {(chart) => (
        <div className="absolute left-3 top-2 pointer-events-auto">
          <ChartLegend items={[...chart.legendItems]} onToggle={chart.toggleSeries} />
        </div>
      )}
    </TimeSeries>
  )
}

export default PitantMultiAxisBlock
