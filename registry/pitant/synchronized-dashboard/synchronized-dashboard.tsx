'use client'

import {
  ChartLegend,
  ChartSyncGroup,
  DigitalChannel,
  type DigitalChannelColumnData,
  type DigitalChannelConfig,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
} from '@pitant/charts-react'
import { useMemo } from 'react'

const SAMPLE_COUNT = 360
const STEP_MS = 5_000
const START = 1_735_689_600_000

function buildTrendData(): TimeSeriesColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const temp = new Float64Array(SAMPLE_COUNT)
  const pressure = new Float64Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    temp[index] = 91 + Math.sin(index / 24) * 1.4
    pressure[index] = 7.1 + Math.cos(index / 28) * 0.25
  }

  return {
    timestamps,
    columns: { temp, pressure },
    provenance: { temp: 'live adapter', pressure: 'live adapter' },
  }
}

function buildStateData(): DigitalChannelColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const running = new Float64Array(SAMPLE_COUNT)
  const permissive = new Float64Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    running[index] = index % 90 < 70 ? 1 : 0
    permissive[index] = index > 190 && index < 215 ? 0 : 1
  }

  return {
    timestamps,
    columns: { running, permissive },
    provenance: { running: 'live adapter', permissive: 'live adapter' },
  }
}

export function PitantSynchronizedDashboardBlock() {
  const trendData = useMemo(buildTrendData, [])
  const stateData = useMemo(buildStateData, [])
  const trendConfig = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'temp',
          label: 'Temperature',
          field: 'temp',
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
      yAxis: { paddingRatio: 0.08 },
      renderer: 'auto',
    }),
    [],
  )
  const stateConfig = useMemo<DigitalChannelConfig>(
    () => ({
      channels: [
        {
          key: 'running',
          label: 'Running',
          field: 'running',
          stateLabels: { 0: 'Stopped', 1: 'Running' },
          color: 'hsl(160 60% 45%)',
          rgba: [0.11, 0.62, 0.44, 1],
        },
        {
          key: 'permissive',
          label: 'Permissive',
          field: 'permissive',
          stateLabels: { 0: 'Blocked', 1: 'OK' },
          color: 'hsl(340 75% 55%)',
          rgba: [0.86, 0.18, 0.47, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      renderer: 'auto',
    }),
    [],
  )

  return (
    <ChartSyncGroup className="grid gap-4" sync={['cursor', 'xRange']}>
      <TimeSeries
        ariaLabel="Synchronized process trend"
        aspectRatio={16 / 7}
        chartKey="process"
        config={trendConfig}
        data={trendData}
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
      <DigitalChannel
        ariaLabel="Synchronized equipment states"
        aspectRatio={16 / 5}
        chartKey="states"
        config={stateConfig}
        data={stateData}
      >
        {(chart) => (
          <div className="absolute left-3 top-2 pointer-events-auto">
            <ChartLegend
              items={[...chart.legendItems]}
              onToggle={(key) => chart.toggleSeries(key)}
            />
          </div>
        )}
      </DigitalChannel>
    </ChartSyncGroup>
  )
}

export default PitantSynchronizedDashboardBlock
