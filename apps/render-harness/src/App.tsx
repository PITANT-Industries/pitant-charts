import type { RendererType } from '@pitant/charts'
import '@pitant/charts/styles/tokens.css'
import {
  ChartLegend,
  DigitalChannel,
  type DigitalChannelColumnData,
  type DigitalChannelConfig,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
} from '@pitant/charts-react'
import { useEffect, useMemo, useState } from 'react'

type RendererChoice = RendererType | 'auto'
type LoadProfile = 'compact' | 'large'

interface GeneratedData {
  analog: TimeSeriesColumnData
  digital: DigitalChannelColumnData
}

declare global {
  interface Window {
    __PITANT_RENDER_HARNESS_STATE__?: {
      renderer: RendererChoice
      profile: LoadProfile
      pointCount: number
      analogSeries: number
      digitalChannels: number
    }
  }
}

const RENDERERS: readonly RendererChoice[] = ['auto', 'canvas2d', 'webgpu']
const PROFILES: readonly LoadProfile[] = ['compact', 'large']

const SERIES_CONFIG: TimeSeriesConfig['series'] = [
  {
    key: 'temperature',
    label: 'Temperature',
    field: 'temperature',
    color: 'var(--chart-1)',
    rgba: [0.15, 0.39, 0.92, 1],
    lineWidth: 1.5,
  },
  {
    key: 'pressure',
    label: 'Pressure',
    field: 'pressure',
    color: 'var(--chart-2)',
    rgba: [0.09, 0.64, 0.29, 1],
    lineWidth: 1.25,
  },
  {
    key: 'vibration',
    label: 'Vibration',
    field: 'vibration',
    color: 'var(--chart-4)',
    rgba: [0.86, 0.15, 0.15, 1],
    lineWidth: 1,
  },
  {
    key: 'flow',
    label: 'Flow',
    field: 'flow',
    color: 'var(--chart-6)',
    rgba: [0.03, 0.58, 0.78, 1],
    lineWidth: 1,
  },
]

const DIGITAL_CONFIG: DigitalChannelConfig['channels'] = [
  {
    key: 'running',
    label: 'Running',
    field: 'running',
    color: 'var(--chart-2)',
    rgba: [0.09, 0.64, 0.29, 1],
    stateLabels: { 0: 'Stopped', 1: 'Running' },
  },
  {
    key: 'fault',
    label: 'Fault',
    field: 'fault',
    color: 'var(--chart-4)',
    rgba: [0.86, 0.15, 0.15, 1],
    stateLabels: { 0: 'Clear', 1: 'Fault' },
  },
  {
    key: 'manual',
    label: 'Manual',
    field: 'manual',
    color: 'var(--chart-5)',
    rgba: [0.48, 0.23, 0.93, 1],
    stateLabels: { 0: 'Auto', 1: 'Manual' },
  },
]

export function App(): React.JSX.Element {
  const [renderer, setRenderer] = useState<RendererChoice>(() =>
    readChoiceFromQuery('renderer', RENDERERS, 'auto'),
  )
  const [profile, setProfile] = useState<LoadProfile>(() =>
    readChoiceFromQuery('profile', PROFILES, 'large'),
  )
  const pointCount = profile === 'large' ? 180_000 : 12_000
  const generated = useMemo(() => generateData(pointCount), [pointCount])
  const timeSeriesConfig = useMemo<TimeSeriesConfig>(
    () => ({
      series: SERIES_CONFIG,
      renderer,
      xAxis: {
        gapThreshold: 15_000,
      },
      yAxis: {
        paddingRatio: 0.08,
      },
    }),
    [renderer],
  )
  const digitalConfig = useMemo<DigitalChannelConfig>(
    () => ({
      channels: DIGITAL_CONFIG,
      renderer,
      xAxis: {
        gapThreshold: 15_000,
      },
      channelHeight: 1,
      channelGap: 0.6,
    }),
    [renderer],
  )

  useEffect(() => {
    window.__PITANT_RENDER_HARNESS_STATE__ = {
      renderer,
      profile,
      pointCount,
      analogSeries: SERIES_CONFIG.length,
      digitalChannels: DIGITAL_CONFIG.length,
    }
  }, [pointCount, profile, renderer])

  return (
    <main className="harness-shell" data-profile={profile} data-renderer={renderer}>
      <header className="toolbar">
        <div>
          <h1>PITANT Charts Render Harness</h1>
          <p>
            {pointCount.toLocaleString()} samples x {SERIES_CONFIG.length} analog pens
          </p>
        </div>
        <label>
          Renderer
          <select
            value={renderer}
            onChange={(event) => setRenderer(event.target.value as RendererChoice)}
          >
            {RENDERERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Load
          <select
            value={profile}
            onChange={(event) => setProfile(event.target.value as LoadProfile)}
          >
            {PROFILES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Analog Trend</h2>
            <p>LOD-backed multi-pen TimeSeries API</p>
          </div>
        </div>
        <TimeSeries
          ariaLabel="Analog trend render harness"
          className="chart-surface analog"
          config={timeSeriesConfig}
          data={generated.analog}
        >
          {(chart) => (
            <div className="chart-overlay">
              <ChartLegend
                items={[...chart.legendItems]}
                onToggle={(key) => chart.toggleSeries(key)}
              />
              <StatsRow
                lodLevel={chart.stats.lodLevel}
                rawPointCount={chart.stats.rawPointCount}
                renderTime={chart.stats.renderTime}
                returnedPointCount={chart.stats.returnedPointCount}
              />
            </div>
          )}
        </TimeSeries>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Digital States</h2>
            <p>Staircase DigitalChannel API</p>
          </div>
        </div>
        <DigitalChannel
          ariaLabel="Digital channel render harness"
          className="chart-surface digital"
          config={digitalConfig}
          data={generated.digital}
        >
          {(chart) => (
            <div className="chart-overlay">
              <ChartLegend
                items={[...chart.legendItems]}
                onToggle={(key) => chart.toggleSeries(key)}
              />
              <StatsRow
                lodLevel={chart.stats.lodLevel}
                rawPointCount={chart.stats.rawPointCount}
                renderTime={chart.stats.renderTime}
                returnedPointCount={chart.stats.returnedPointCount}
              />
            </div>
          )}
        </DigitalChannel>
      </section>
    </main>
  )
}

function readChoiceFromQuery<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback

  const value = new URLSearchParams(window.location.search).get(key)
  return allowed.includes(value as T) ? (value as T) : fallback
}

function StatsRow(props: {
  lodLevel: number
  rawPointCount: number
  renderTime: number
  returnedPointCount: number
}): React.JSX.Element {
  const { lodLevel, rawPointCount, renderTime, returnedPointCount } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>LOD</dt>
        <dd>{lodLevel}</dd>
      </div>
      <div>
        <dt>Returned</dt>
        <dd>{returnedPointCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Raw</dt>
        <dd>{rawPointCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function generateData(pointCount: number): GeneratedData {
  const timestamps = new Float64Array(pointCount)
  const temperature = new Float64Array(pointCount)
  const pressure = new Float64Array(pointCount)
  const vibration = new Float64Array(pointCount)
  const flow = new Float64Array(pointCount)
  const running = new Float64Array(pointCount)
  const fault = new Float64Array(pointCount)
  const manual = new Float64Array(pointCount)
  const start = 1_700_000_000_000

  for (let i = 0; i < pointCount; i++) {
    timestamps[i] = start + i * 1000
    const trend = i / pointCount
    temperature[i] = 65 + Math.sin(i / 180) * 14 + Math.sin(i / 28) * 1.5
    pressure[i] = 110 + Math.cos(i / 240) * 24 + trend * 12
    vibration[i] = 3 + Math.abs(Math.sin(i / 37)) * 5 + (i % 6000 === 0 ? 8 : 0)
    flow[i] = 420 + Math.sin(i / 320) * 55 + Math.cos(i / 71) * 12
    running[i] = i % 18_000 < 15_500 ? 1 : 0
    fault[i] = i % 45_000 > 43_500 ? 1 : 0
    manual[i] = i % 60_000 > 48_000 ? 1 : 0
  }

  return {
    analog: {
      timestamps,
      columns: {
        temperature,
        pressure,
        vibration,
        flow,
      },
    },
    digital: {
      timestamps,
      columns: {
        running,
        fault,
        manual,
      },
    },
  }
}
