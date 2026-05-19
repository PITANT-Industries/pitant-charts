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

const SAMPLE_COUNT = 600
const STEP_MS = 6_000
const START = 1_735_689_600_000

function buildTrendData(): TimeSeriesColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const production = new Float64Array(SAMPLE_COUNT)
  const energy = new Float64Array(SAMPLE_COUNT)
  const envelopeHigh = new Float64Array(SAMPLE_COUNT)
  const envelopeLow = new Float64Array(SAMPLE_COUNT)
  const energyQuality = new Uint8Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    production[index] = 71 + Math.sin(index / 26) * 4.2 + Math.sin(index / 7) * 0.7
    energy[index] = 38 + Math.cos(index / 31) * 3.6 + Math.sin(index / 12) * 0.5
    envelopeHigh[index] = 76
    envelopeLow[index] = 66
    energyQuality[index] = index > 260 && index < 286 ? 1 : 0
  }

  return {
    timestamps,
    columns: { production, energy, envelopeHigh, envelopeLow },
    quality: { energy: energyQuality },
    provenance: {
      production: 'live adapter',
      energy: 'energy meter',
      envelopeHigh: 'operating envelope',
      envelopeLow: 'operating envelope',
    },
    gaps: [{ startIndex: 260, endIndex: 286 }],
  }
}

function buildStateData(): DigitalChannelColumnData {
  const timestamps = new Float64Array(SAMPLE_COUNT)
  const lineRunning = new Float64Array(SAMPLE_COUNT)
  const qualityHold = new Float64Array(SAMPLE_COUNT)
  const maintenance = new Float64Array(SAMPLE_COUNT)

  for (let index = 0; index < SAMPLE_COUNT; index++) {
    timestamps[index] = START + index * STEP_MS
    lineRunning[index] = index % 120 < 104 ? 1 : 0
    qualityHold[index] = index > 260 && index < 286 ? 1 : 0
    maintenance[index] = index > 430 && index < 462 ? 1 : 0
  }

  return {
    timestamps,
    columns: { lineRunning, qualityHold, maintenance },
    provenance: {
      lineRunning: 'equipment state',
      qualityHold: 'quality system',
      maintenance: 'cmms schedule',
    },
  }
}

export function PitantDashboardOverviewBlock() {
  const trendData = useMemo(buildTrendData, [])
  const stateData = useMemo(buildStateData, [])
  const productionConfig = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'production',
          label: 'Production',
          field: 'production',
          color: 'hsl(220 70% 50%)',
          rgba: [0.18, 0.39, 0.86, 1],
        },
        {
          key: 'envelopeHigh',
          label: 'High',
          field: 'envelopeHigh',
          color: 'hsl(340 75% 55%)',
          rgba: [0.86, 0.18, 0.47, 0.8],
          lineWidth: 1,
        },
        {
          key: 'envelopeLow',
          label: 'Low',
          field: 'envelopeLow',
          color: 'hsl(340 75% 55%)',
          rgba: [0.86, 0.18, 0.47, 0.8],
          lineWidth: 1,
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'Units/min',
        paddingRatio: 0.08,
      },
      renderer: 'auto',
    }),
    [],
  )
  const energyConfig = useMemo<TimeSeriesConfig>(
    () => ({
      series: [
        {
          key: 'energy',
          label: 'Energy',
          field: 'energy',
          color: 'hsl(30 80% 55%)',
          rgba: [0.89, 0.42, 0.12, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      yAxis: {
        label: 'kWh',
        paddingRatio: 0.08,
      },
      renderer: 'auto',
    }),
    [],
  )
  const stateConfig = useMemo<DigitalChannelConfig>(
    () => ({
      channels: [
        {
          key: 'lineRunning',
          label: 'Line',
          field: 'lineRunning',
          stateLabels: { 0: 'Stopped', 1: 'Running' },
          color: 'hsl(160 60% 45%)',
          rgba: [0.11, 0.62, 0.44, 1],
        },
        {
          key: 'qualityHold',
          label: 'Quality hold',
          field: 'qualityHold',
          stateLabels: { 0: 'Clear', 1: 'Hold' },
          color: 'hsl(340 75% 55%)',
          rgba: [0.86, 0.18, 0.47, 1],
        },
        {
          key: 'maintenance',
          label: 'Maintenance',
          field: 'maintenance',
          stateLabels: { 0: 'Clear', 1: 'Active' },
          color: 'hsl(30 80% 55%)',
          rgba: [0.89, 0.42, 0.12, 1],
        },
      ],
      xAxis: {
        label: 'Time',
        formatValue: (value) => new Date(value).toLocaleTimeString(),
      },
      channelHeight: 22,
      channelGap: 7,
      renderer: 'auto',
    }),
    [],
  )

  return (
    <ChartSyncGroup className="grid gap-4 lg:grid-cols-2" sync={['cursor', 'xRange']}>
      <div className="text-sm font-medium text-foreground lg:col-span-2">Production overview</div>
      <TimeSeries
        ariaLabel="Production overview trend"
        aspectRatio={16 / 7}
        chartKey="overview-production"
        config={productionConfig}
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
      <TimeSeries
        ariaLabel="Energy overview trend"
        aspectRatio={16 / 7}
        chartKey="overview-energy"
        config={energyConfig}
        data={trendData}
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
      <div className="lg:col-span-2">
        <DigitalChannel
          ariaLabel="Operations state overview"
          aspectRatio={16 / 4}
          chartKey="overview-states"
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
      </div>
    </ChartSyncGroup>
  )
}

export default PitantDashboardOverviewBlock
