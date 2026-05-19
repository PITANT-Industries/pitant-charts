import type { RendererType } from '@pitant/charts'
import '@pitant/charts/styles/tokens.css'
import {
  ChartLegend,
  CorrelationMatrix,
  type CorrelationMatrixConfig,
  type CorrelationMatrixData,
  DigitalChannel,
  type DigitalChannelColumnData,
  type DigitalChannelConfig,
  Distribution,
  type DistributionColumnData,
  type DistributionConfig,
  KpiStrip,
  type KpiStripConfig,
  type KpiStripData,
  type KpiStripItemData,
  ScatterPlot,
  type ScatterPlotColumnData,
  type ScatterPlotConfig,
  Spectrogram,
  type SpectrogramConfig,
  type SpectrogramMatrixData,
  Spectrum,
  type SpectrumColumnData,
  type SpectrumConfig,
  TimeSeries,
  type TimeSeriesColumnData,
  type TimeSeriesConfig,
} from '@pitant/charts-react'
import { useEffect, useMemo, useState } from 'react'

type RendererChoice = RendererType | 'auto'
type LoadProfile =
  | 'compact'
  | 'large'
  | 'bands'
  | 'anomaly'
  | 'spc'
  | 'spectrum'
  | 'spectrogram'
  | 'distribution'
  | 'correlation'
  | 'kpi'
  | 'scatter'

interface GeneratedData {
  analog: TimeSeriesColumnData
  correlation: CorrelationMatrixData
  digital: DigitalChannelColumnData
  distribution: DistributionColumnData
  kpi: KpiStripData
  scatter: ScatterPlotColumnData
  spectrum: SpectrumColumnData
  spectrogram: SpectrogramMatrixData
}

declare global {
  interface Window {
    __PITANT_RENDER_HARNESS_STATE__?: {
      renderer: RendererChoice
      profile: LoadProfile
      pointCount: number
      analogSeries: number
      analogBands: number
      analogAnomalyTracks: number
      analogSpcTracks: number
      correlationCells: number
      digitalChannels: number
      distributionBins: number
      kpiItems: number
      scatterDensityCells: number
      scatterPoints: number
      spectrumBins: number
      spectrogramTiles: number
    }
  }
}

const RENDERERS: readonly RendererChoice[] = ['auto', 'canvas2d', 'webgpu']
const PROFILES: readonly LoadProfile[] = [
  'compact',
  'large',
  'bands',
  'anomaly',
  'spc',
  'spectrum',
  'spectrogram',
  'distribution',
  'correlation',
  'kpi',
  'scatter',
]

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

const BAND_CONFIG: NonNullable<TimeSeriesConfig['bands']> = [
  {
    kind: 'value-band',
    key: 'flow-warning',
    label: 'Flow warning',
    yStart: 385,
    yEnd: 455,
    fillRgba: [0.86, 0.15, 0.15, 0.13],
    lineRgba: [0.86, 0.15, 0.15, 0.62],
    lineWidth: 1,
  },
  {
    kind: 'envelope',
    key: 'flow-expected',
    label: 'Expected flow envelope',
    lowerField: 'flow_low',
    upperField: 'flow_high',
    fillRgba: [0.03, 0.58, 0.78, 0.16],
    lineRgba: [0.03, 0.58, 0.78, 0.5],
    lineWidth: 1,
  },
]

const ANOMALY_TRACK_CONFIG: NonNullable<TimeSeriesConfig['anomalyTracks']> = [
  {
    key: 'model-a',
    label: 'Model A',
    scoreField: 'anomaly_a',
    threshold: 0.72,
    modelVersion: 'v2026.05-a',
    reviewerState: 'review-pending',
    placement: 'bottom',
    laneHeightRatio: 0.1,
    fillRgba: [0.86, 0.15, 0.15, 0.16],
    lineRgba: [0.86, 0.15, 0.15, 0.78],
    thresholdRgba: [0.12, 0.12, 0.12, 0.62],
  },
  {
    key: 'model-b',
    label: 'Model B',
    scoreField: 'anomaly_b',
    threshold: 0.68,
    modelVersion: 'v2026.05-b',
    reviewerState: 'approved',
    placement: 'top',
    laneHeightRatio: 0.1,
    fillRgba: [0.48, 0.23, 0.93, 0.14],
    lineRgba: [0.48, 0.23, 0.93, 0.72],
    thresholdRgba: [0.12, 0.12, 0.12, 0.62],
  },
]

const SPC_TRACK_CONFIG: NonNullable<TimeSeriesConfig['spcTracks']> = [
  {
    key: 'temperature-xbar',
    label: 'Temperature Xbar',
    chartKind: 'xbar',
    centerLine: 65,
    upperControlLimit: 84,
    lowerControlLimit: 46,
    upperWarningLimit: 78,
    lowerWarningLimit: 52,
    zoneFillRgba: [0.15, 0.39, 0.92, 0.07],
    warningFillRgba: [0.93, 0.47, 0.09, 0.12],
    centerLineRgba: [0.1, 0.1, 0.1, 0.72],
    controlLineRgba: [0.82, 0.12, 0.08, 0.78],
    warningLineRgba: [0.93, 0.47, 0.09, 0.72],
    markers: [
      {
        key: 'we-1-temp',
        label: 'WE-1',
        rule: 'Western Electric 1',
        x: 1_700_000_000_000 + 3_200 * 1000,
        severity: 'violation',
        labelVisible: true,
      },
      {
        key: 'we-2-temp',
        label: 'WE-2',
        rule: 'Western Electric 2',
        x: 1_700_000_000_000 + 7_600 * 1000,
        severity: 'warning',
      },
    ],
  },
]

const SPECTRUM_CONFIG: SpectrumConfig = {
  series: [
    {
      key: 'vibration-spectrum',
      label: 'Vibration spectrum',
      field: 'magnitude',
      color: 'var(--chart-5)',
      rgba: [0.48, 0.23, 0.93, 1],
      fillRgba: [0.48, 0.23, 0.93, 0.24],
      lineRgba: [0.48, 0.23, 0.93, 0.92],
      lineWidth: 0.9,
    },
  ],
  bands: [
    {
      key: 'bearing',
      label: 'Bearing band',
      frequencyStart: 68,
      frequencyEnd: 78,
      fillRgba: [0.86, 0.15, 0.15, 0.09],
      lineRgba: [0.86, 0.15, 0.15, 0.32],
    },
    {
      key: 'gear-mesh',
      label: 'Gear mesh',
      frequencyStart: 300,
      frequencyEnd: 336,
      fillRgba: [0.93, 0.47, 0.09, 0.1],
      lineRgba: [0.93, 0.47, 0.09, 0.38],
    },
  ],
  peakMarkers: [
    {
      key: 'bpfo',
      frequency: 73,
      magnitude: 50,
      label: 'BPFO',
      rgba: [0.86, 0.15, 0.15, 0.86],
    },
    {
      key: 'mesh',
      frequency: 312,
      magnitude: 36,
      label: 'mesh',
      rgba: [0.93, 0.47, 0.09, 0.86],
    },
  ],
  xAxis: {
    label: 'Hz',
    formatValue: (value) => `${value.toFixed(0)}`,
  },
  yAxis: {
    label: 'Magnitude',
    baseline: 0,
    paddingRatio: 0.08,
  },
}

const SPECTROGRAM_CONFIG: SpectrogramConfig = {
  colorStops: [
    { value: 0, rgba: [0.04, 0.07, 0.16, 1] },
    { value: 0.35, rgba: [0.03, 0.58, 0.78, 1] },
    { value: 0.7, rgba: [0.93, 0.74, 0.22, 1] },
    { value: 1, rgba: [0.86, 0.15, 0.15, 1] },
  ],
  xAxis: {
    label: 'Seconds',
    formatValue: (value) => `${value.toFixed(0)}`,
  },
  yAxis: {
    label: 'Hz',
    formatValue: (value) => `${value.toFixed(0)}`,
  },
  zAxis: {
    label: 'Magnitude',
  },
}

const DISTRIBUTION_CONFIG: DistributionConfig = {
  series: [
    {
      key: 'capability-distribution',
      label: 'Capability distribution',
      field: 'count',
      color: 'var(--chart-1)',
      rgba: [0.15, 0.39, 0.92, 1],
      fillRgba: [0.15, 0.39, 0.92, 0.28],
      lineRgba: [0.15, 0.39, 0.92, 0.88],
      lineWidth: 0.75,
    },
  ],
  markers: [
    { key: 'lsl', kind: 'lower-spec', value: -3, label: 'LSL' },
    { key: 'target', kind: 'target', value: 0, label: 'Target' },
    { key: 'usl', kind: 'upper-spec', value: 3, label: 'USL' },
    { key: 'p05', kind: 'percentile', value: -1.65, label: 'P05' },
    { key: 'p95', kind: 'percentile', value: 1.72, label: 'P95' },
  ],
  xAxis: {
    label: 'Deviation',
    formatValue: (value) => value.toFixed(1),
  },
  yAxis: {
    label: 'Count',
    baseline: 0,
    paddingRatio: 0.08,
    formatValue: (value) => value.toFixed(0),
  },
}

const CORRELATION_CONFIG: CorrelationMatrixConfig = {
  minSampleCount: 100,
  labels: {
    visible: true,
    maxCount: 12,
  },
  xAxis: {
    label: 'Source variable',
  },
  yAxis: {
    label: 'Target variable',
  },
}

const KPI_STRIP_CONFIG: KpiStripConfig = {
  columns: 16,
  labels: {
    visible: false,
    maxCount: 32,
  },
  sparklinePointLimit: 48,
  cardGapRatio: 0.05,
  cardPaddingRatio: 0.1,
}

const SCATTER_POINT_FIELD = 'pressure'

const SCATTER_CONFIG: ScatterPlotConfig = {
  series: [
    {
      key: 'pressure-torque',
      label: 'Pressure vs torque',
      xField: 'pressure',
      yField: 'torque',
      color: 'var(--chart-1)',
      rgba: [0.15, 0.39, 0.92, 1],
    },
    {
      key: 'temperature-vibration',
      label: 'Temperature vs vibration',
      xField: 'temperature',
      yField: 'vibration',
      color: 'var(--chart-4)',
      rgba: [0.86, 0.15, 0.15, 0.86],
    },
  ],
  xAxis: {
    label: 'Process input',
    range: [0, 120],
    formatValue: (value) => value.toFixed(0),
  },
  yAxis: {
    label: 'Process output',
    range: [0, 120],
    formatValue: (value) => value.toFixed(0),
  },
  maxRenderedPoints: 18_000,
  density: {
    columns: 192,
    rows: 128,
  },
}

export function App(): React.JSX.Element {
  const [renderer, setRenderer] = useState<RendererChoice>(() =>
    readChoiceFromQuery('renderer', RENDERERS, 'auto'),
  )
  const [profile, setProfile] = useState<LoadProfile>(() =>
    readChoiceFromQuery('profile', PROFILES, 'large'),
  )
  const pointCount =
    profile === 'large'
      ? 180_000
      : profile === 'bands' || profile === 'anomaly'
        ? 90_000
        : profile === 'spc' ||
            profile === 'spectrum' ||
            profile === 'spectrogram' ||
            profile === 'distribution' ||
            profile === 'correlation' ||
            profile === 'kpi' ||
            profile === 'scatter'
          ? 10_000
          : 12_000
  const generated = useMemo(() => generateData(pointCount, profile), [pointCount, profile])
  const timeSeriesConfig = useMemo<TimeSeriesConfig>(() => {
    const config: TimeSeriesConfig = {
      series: SERIES_CONFIG,
      renderer,
      xAxis: {
        gapThreshold: 15_000,
      },
      yAxis: {
        paddingRatio: 0.08,
      },
    }
    if (profile === 'bands') config.bands = BAND_CONFIG
    if (profile === 'anomaly') config.anomalyTracks = ANOMALY_TRACK_CONFIG
    if (profile === 'spc') config.spcTracks = SPC_TRACK_CONFIG
    return config
  }, [profile, renderer])
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
      analogBands: profile === 'bands' ? BAND_CONFIG.length : 0,
      analogAnomalyTracks: profile === 'anomaly' ? ANOMALY_TRACK_CONFIG.length : 0,
      analogSpcTracks: profile === 'spc' ? SPC_TRACK_CONFIG.length : 0,
      correlationCells: profile === 'correlation' ? generated.correlation.values.length : 0,
      digitalChannels: DIGITAL_CONFIG.length,
      distributionBins: profile === 'distribution' ? generated.distribution.binStarts.length : 0,
      kpiItems: profile === 'kpi' ? generated.kpi.items.length : 0,
      scatterDensityCells: 0,
      scatterPoints:
        profile === 'scatter' ? (generated.scatter.columns[SCATTER_POINT_FIELD]?.length ?? 0) : 0,
      spectrumBins: profile === 'spectrum' ? generated.spectrum.frequencies.length : 0,
      spectrogramTiles:
        profile === 'spectrogram'
          ? generated.spectrogram.timeBins.length * generated.spectrogram.frequencyBins.length
          : 0,
    }
  }, [
    generated.spectrogram.frequencyBins.length,
    generated.spectrogram.timeBins.length,
    generated.correlation.values.length,
    generated.distribution.binStarts.length,
    generated.kpi.items.length,
    generated.scatter.columns[SCATTER_POINT_FIELD],
    generated.spectrum.frequencies.length,
    pointCount,
    profile,
    renderer,
  ])

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

      {profile === 'spectrum' ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Vibration Spectrum</h2>
              <p>Precomputed-bin Spectrum API, one-million-sample source window</p>
            </div>
          </div>
          <Spectrum
            ariaLabel="Vibration spectrum render harness"
            className="chart-surface spectrum"
            config={{ ...SPECTRUM_CONFIG, renderer }}
            data={generated.spectrum}
          >
            {(chart) => (
              <div className="chart-overlay">
                <ChartLegend
                  items={[...chart.legendItems]}
                  onToggle={(key) => chart.toggleSeries(key)}
                />
                <SpectrumStatsRow
                  peakMarkerCount={chart.stats.peakMarkerCount}
                  renderTime={chart.stats.renderTime}
                  renderedBinCount={chart.stats.renderedBinCount}
                  segmentCount={chart.stats.segmentCount}
                />
              </div>
            )}
          </Spectrum>
        </section>
      ) : null}

      {profile === 'spectrogram' ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>STFT Spectrogram</h2>
              <p>Precomputed time-frequency tile API, one-hour source window</p>
            </div>
          </div>
          <Spectrogram
            ariaLabel="STFT spectrogram render harness"
            className="chart-surface spectrogram"
            config={{ ...SPECTROGRAM_CONFIG, renderer }}
            data={generated.spectrogram}
          >
            {(chart) => (
              <div className="chart-overlay">
                <SpectrogramStatsRow
                  frequencyBinCount={chart.stats.frequencyBinCount}
                  renderTime={chart.stats.renderTime}
                  renderedTileCount={chart.stats.renderedTileCount}
                  timeBinCount={chart.stats.timeBinCount}
                />
              </div>
            )}
          </Spectrogram>
        </section>
      ) : null}

      {profile === 'distribution' ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Capability Distribution</h2>
              <p>Precomputed-bin Distribution API, one-million-sample source window</p>
            </div>
          </div>
          <Distribution
            ariaLabel="Capability distribution render harness"
            className="chart-surface distribution"
            config={{ ...DISTRIBUTION_CONFIG, renderer }}
            data={generated.distribution}
          >
            {(chart) => (
              <div className="chart-overlay">
                <ChartLegend
                  items={[...chart.legendItems]}
                  onToggle={(key) => chart.toggleSeries(key)}
                />
                <DistributionStatsRow
                  markerCount={chart.stats.markerCount}
                  renderTime={chart.stats.renderTime}
                  renderedBinCount={chart.stats.renderedBinCount}
                  sourceBinCount={chart.stats.sourceBinCount}
                />
              </div>
            )}
          </Distribution>
        </section>
      ) : null}

      {profile === 'correlation' ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Correlation Matrix</h2>
              <p>Precomputed 128-variable matrix API, lag-disabled default</p>
            </div>
          </div>
          <CorrelationMatrix
            ariaLabel="Correlation matrix render harness"
            className="chart-surface correlation"
            config={{ ...CORRELATION_CONFIG, renderer }}
            data={generated.correlation}
          >
            {(chart) => (
              <div className="chart-overlay">
                <CorrelationStatsRow
                  lowSampleCellCount={chart.stats.lowSampleCellCount}
                  missingCellCount={chart.stats.missingCellCount}
                  renderTime={chart.stats.renderTime}
                  renderedCellCount={chart.stats.renderedCellCount}
                  visibleVariableCount={chart.stats.visibleVariableCount}
                />
              </div>
            )}
          </CorrelationMatrix>
        </section>
      ) : null}

      {profile === 'kpi' ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>KPI Strip</h2>
              <p>Precomputed 256-asset compact status and sparkline API</p>
            </div>
          </div>
          <KpiStrip
            ariaLabel="KPI strip render harness"
            className="chart-surface kpi"
            config={{ ...KPI_STRIP_CONFIG, renderer }}
            data={generated.kpi}
          >
            {(chart) => (
              <div className="chart-overlay">
                <KpiStatsRow
                  alarmCount={chart.stats.alarmCount}
                  renderTime={chart.stats.renderTime}
                  renderedItemCount={chart.stats.renderedItemCount}
                  sparklinePointCount={chart.stats.sparklinePointCount}
                  warningCount={chart.stats.warningCount}
                />
              </div>
            )}
          </KpiStrip>
        </section>
      ) : null}

      {profile === 'scatter' ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Scatter Density</h2>
              <p>150k frozen point relationship view with automatic density fallback</p>
            </div>
          </div>
          <ScatterPlot
            ariaLabel="Scatter density render harness"
            className="chart-surface scatter"
            config={{ ...SCATTER_CONFIG, renderer }}
            data={generated.scatter}
          >
            {(chart) => (
              <div className="chart-overlay">
                <ChartLegend
                  items={[...chart.legendItems]}
                  onToggle={(key) => chart.toggleSeries(key)}
                />
                <ScatterStatsRow
                  densityCellCount={chart.stats.densityCellCount}
                  filteredPointCount={chart.stats.filteredPointCount}
                  mode={chart.stats.mode}
                  renderTime={chart.stats.renderTime}
                  sourcePointCount={chart.stats.sourcePointCount}
                />
              </div>
            )}
          </ScatterPlot>
        </section>
      ) : null}
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

function SpectrumStatsRow(props: {
  peakMarkerCount: number
  renderTime: number
  renderedBinCount: number
  segmentCount: number
}): React.JSX.Element {
  const { peakMarkerCount, renderTime, renderedBinCount, segmentCount } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>Bins</dt>
        <dd>{renderedBinCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Peaks</dt>
        <dd>{peakMarkerCount}</dd>
      </div>
      <div>
        <dt>Segments</dt>
        <dd>{segmentCount}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function SpectrogramStatsRow(props: {
  frequencyBinCount: number
  renderTime: number
  renderedTileCount: number
  timeBinCount: number
}): React.JSX.Element {
  const { frequencyBinCount, renderTime, renderedTileCount, timeBinCount } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>Tiles</dt>
        <dd>{renderedTileCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Windows</dt>
        <dd>{timeBinCount}</dd>
      </div>
      <div>
        <dt>Bands</dt>
        <dd>{frequencyBinCount}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function DistributionStatsRow(props: {
  markerCount: number
  renderTime: number
  renderedBinCount: number
  sourceBinCount: number
}): React.JSX.Element {
  const { markerCount, renderTime, renderedBinCount, sourceBinCount } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>Bins</dt>
        <dd>{renderedBinCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>{sourceBinCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Markers</dt>
        <dd>{markerCount}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function CorrelationStatsRow(props: {
  lowSampleCellCount: number
  missingCellCount: number
  renderTime: number
  renderedCellCount: number
  visibleVariableCount: number
}): React.JSX.Element {
  const {
    lowSampleCellCount,
    missingCellCount,
    renderTime,
    renderedCellCount,
    visibleVariableCount,
  } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>Cells</dt>
        <dd>{renderedCellCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Vars</dt>
        <dd>{visibleVariableCount}</dd>
      </div>
      <div>
        <dt>Quality</dt>
        <dd>{missingCellCount + lowSampleCellCount}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function KpiStatsRow(props: {
  alarmCount: number
  renderTime: number
  renderedItemCount: number
  sparklinePointCount: number
  warningCount: number
}): React.JSX.Element {
  const { alarmCount, renderTime, renderedItemCount, sparklinePointCount, warningCount } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>Assets</dt>
        <dd>{renderedItemCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Spark</dt>
        <dd>{sparklinePointCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Alerts</dt>
        <dd>{alarmCount + warningCount}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function ScatterStatsRow(props: {
  densityCellCount: number
  filteredPointCount: number
  mode: string
  renderTime: number
  sourcePointCount: number
}): React.JSX.Element {
  const { densityCellCount, filteredPointCount, mode, renderTime, sourcePointCount } = props
  return (
    <dl className="stats-row">
      <div>
        <dt>Source</dt>
        <dd>{sourcePointCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Filtered</dt>
        <dd>{filteredPointCount.toLocaleString()}</dd>
      </div>
      <div>
        <dt>{mode === 'density' ? 'Cells' : 'Mode'}</dt>
        <dd>{mode === 'density' ? densityCellCount.toLocaleString() : mode}</dd>
      </div>
      <div>
        <dt>Render</dt>
        <dd>{renderTime.toFixed(2)} ms</dd>
      </div>
    </dl>
  )
}

function generateData(pointCount: number, profile: LoadProfile): GeneratedData {
  const timestamps = new Float64Array(pointCount)
  const temperature = new Float64Array(pointCount)
  const pressure = new Float64Array(pointCount)
  const vibration = new Float64Array(pointCount)
  const flow = new Float64Array(pointCount)
  const flowLow = profile === 'bands' ? new Float64Array(pointCount) : undefined
  const flowHigh = profile === 'bands' ? new Float64Array(pointCount) : undefined
  const anomalyA = profile === 'anomaly' ? new Float64Array(pointCount) : undefined
  const anomalyB = profile === 'anomaly' ? new Float64Array(pointCount) : undefined
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
    const flowValue = 420 + Math.sin(i / 320) * 55 + Math.cos(i / 71) * 12
    flow[i] = flowValue
    if (flowLow && flowHigh) {
      const envelopeWidth = 26 + Math.abs(Math.sin(i / 900)) * 10
      flowLow[i] = flowValue - envelopeWidth
      flowHigh[i] = flowValue + envelopeWidth
    }
    if (anomalyA && anomalyB) {
      const pressureSpike = i % 22_000 < 900 ? 0.42 : 0
      const vibrationSpike = i % 31_000 > 29_500 ? 0.38 : 0
      anomalyA[i] = Math.min(1, Math.abs(Math.sin(i / 89)) * 0.32 + pressureSpike)
      anomalyB[i] = Math.min(1, Math.max(0, Math.sin(i / 12_000)) * 0.48 + vibrationSpike)
    }
    running[i] = i % 18_000 < 15_500 ? 1 : 0
    fault[i] = i % 45_000 > 43_500 ? 1 : 0
    manual[i] = i % 60_000 > 48_000 ? 1 : 0
  }

  const analogColumns = {
    temperature,
    pressure,
    vibration,
    flow,
    ...(flowLow && flowHigh ? { flow_low: flowLow, flow_high: flowHigh } : {}),
    ...(anomalyA && anomalyB ? { anomaly_a: anomalyA, anomaly_b: anomalyB } : {}),
  } satisfies TimeSeriesColumnData['columns']

  return {
    analog: {
      timestamps,
      columns: analogColumns,
    },
    correlation: generateCorrelationMatrixData(128),
    digital: {
      timestamps,
      columns: {
        running,
        fault,
        manual,
      },
    },
    distribution: generateDistributionData(512),
    kpi: generateKpiStripData(256, 96),
    scatter: generateScatterPlotData(150_000),
    spectrum: generateSpectrumData(8192),
    spectrogram: generateSpectrogramData(128, 96),
  }
}

function generateScatterPlotData(pointCount: number): ScatterPlotColumnData {
  const pressure = new Float32Array(pointCount)
  const torque = new Float32Array(pointCount)
  const temperature = new Float32Array(pointCount)
  const vibration = new Float32Array(pointCount)

  for (let index = 0; index < pointCount; index++) {
    const cluster = index % 4
    const centerPressure = cluster === 0 ? 22 : cluster === 1 ? 48 : cluster === 2 ? 71 : 88
    const centerTorque = cluster === 0 ? 34 : cluster === 1 ? 74 : cluster === 2 ? 52 : 24
    const ring = (index % 997) / 997
    pressure[index] =
      centerPressure + Math.sin(index / 17) * (4 + ring * 8) + Math.cos(index / 131) * 2.4
    torque[index] =
      centerTorque + Math.cos(index / 23) * (5 + ring * 9) + Math.sin(index / 89) * 3.2
    temperature[index] = 58 + cluster * 9 + Math.sin(index / 53) * 11 + Math.cos(index / 211) * 4
    vibration[index] =
      18 + cluster * 8 + Math.abs(Math.sin(index / 37)) * 34 + Math.cos(index / 157) * 3
  }

  return {
    columns: {
      pressure,
      torque,
      temperature,
      vibration,
    },
  }
}

function generateKpiStripData(itemCount: number, sparklinePoints: number): KpiStripData {
  const statuses = ['normal', 'warning', 'alarm', 'stale', 'offline'] as const
  const items = Array.from({ length: itemCount }, (_, index) => {
    const values = new Float32Array(sparklinePoints)
    const center = 72 + (index % 13) * 1.8
    const drift = ((index % 17) - 8) * 0.018
    for (let sample = 0; sample < sparklinePoints; sample++) {
      values[sample] =
        center +
        Math.sin(sample / 6 + index * 0.11) * 7 +
        Math.cos(sample / 17 + index * 0.07) * 2.5 +
        sample * drift
    }

    const item: KpiStripItemData = {
      key: `asset_${index}`,
      label: `Asset ${index + 1}`,
      value: values[sparklinePoints - 1] ?? center,
      unit: '%',
      status: statuses[(index * 7) % statuses.length] ?? 'unknown',
      freshnessSeconds: (index * 11) % 900,
      quality: 0.82 + ((index * 19) % 18) / 100,
      sparkline: {
        values,
        valueRange: [40, 105] as const,
      },
      target: 88,
      lowerLimit: 62,
      upperLimit: 98,
    }
    return item
  })

  return { items }
}

function generateCorrelationMatrixData(variableCount: number): CorrelationMatrixData {
  const variables = Array.from({ length: variableCount }, (_, index) => ({
    key: `var_${index}`,
    label: `V${index + 1}`,
  }))
  const values = new Float32Array(variableCount * variableCount)
  const sampleCounts = new Uint32Array(variableCount * variableCount)
  const missingCounts = new Uint32Array(variableCount * variableCount)

  for (let row = 0; row < variableCount; row++) {
    for (let column = 0; column < variableCount; column++) {
      const index = row * variableCount + column
      const distance = Math.abs(row - column)
      const cluster = Math.floor(row / 16) === Math.floor(column / 16) ? 0.46 : 0
      const antiCluster = (row + column) % 23 === 0 ? -0.36 : 0
      const wave = Math.sin((row + 5) * (column + 7) * 0.011) * 0.24
      values[index] =
        row === column
          ? 1
          : Math.max(-1, Math.min(1, cluster + wave + antiCluster - distance / 900))
      sampleCounts[index] = 9_000 - ((row * 19 + column * 31) % 220)
      missingCounts[index] = (row * 11 + column * 13) % 29 === 0 ? 7 : 0
    }
  }

  return {
    variables,
    values,
    sampleCounts,
    missingCounts,
  }
}

function generateSpectrumData(binCount: number): SpectrumColumnData {
  const frequencies = new Float64Array(binCount)
  const magnitude = new Float64Array(binCount)
  const sampleRateHz = 2048
  const binWidth = sampleRateHz / (binCount * 2)

  for (let i = 0; i < binCount; i++) {
    const frequency = i * binWidth
    const bearingPeak = gaussian(frequency, 73, 2.5) * 48
    const gearMeshPeak = gaussian(frequency, 312, 6) * 34
    const sideBand = gaussian(frequency, 328, 3.5) * 16
    const floor = 2 + Math.abs(Math.sin(i / 29)) * 0.8 + Math.abs(Math.cos(i / 97)) * 0.45
    frequencies[i] = frequency
    magnitude[i] = floor + bearingPeak + gearMeshPeak + sideBand
  }

  return {
    frequencies,
    columns: {
      magnitude,
    },
  }
}

function generateSpectrogramData(
  timeBinCount: number,
  frequencyBinCount: number,
): SpectrogramMatrixData {
  const timeBins = new Float64Array(timeBinCount)
  const frequencyBins = new Float64Array(frequencyBinCount)
  const values = new Float32Array(timeBinCount * frequencyBinCount)
  const timeBinWidth = 30
  const frequencyBinWidth = 4

  for (let timeIndex = 0; timeIndex < timeBinCount; timeIndex++) {
    timeBins[timeIndex] = timeIndex * timeBinWidth
  }
  for (let frequencyIndex = 0; frequencyIndex < frequencyBinCount; frequencyIndex++) {
    frequencyBins[frequencyIndex] = frequencyIndex * frequencyBinWidth
  }

  for (let frequencyIndex = 0; frequencyIndex < frequencyBinCount; frequencyIndex++) {
    const frequency = frequencyBins[frequencyIndex] ?? 0
    for (let timeIndex = 0; timeIndex < timeBinCount; timeIndex++) {
      const time = timeBins[timeIndex] ?? 0
      const bearing = 72 + Math.sin(time / 440) * 8
      const gearMesh = 310 + Math.cos(time / 760) * 13
      const floor =
        1.2 +
        Math.abs(Math.sin((timeIndex + frequencyIndex) / 31)) * 0.5 +
        Math.abs(Math.cos(frequencyIndex / 41)) * 0.35
      const magnitude =
        floor +
        gaussian(frequency, bearing, 3.8) * (26 + Math.sin(time / 180) * 7) +
        gaussian(frequency, gearMesh, 9) * (17 + Math.cos(time / 230) * 5)
      values[frequencyIndex * timeBinCount + timeIndex] = magnitude
    }
  }

  return {
    timeBins,
    frequencyBins,
    values,
    timeBinWidth,
    frequencyBinWidth,
  }
}

function generateDistributionData(binCount: number): DistributionColumnData {
  const binStarts = new Float64Array(binCount)
  const binEnds = new Float64Array(binCount)
  const count = new Float64Array(binCount)
  const min = -5
  const max = 5
  const binWidth = (max - min) / binCount

  for (let i = 0; i < binCount; i++) {
    const start = min + i * binWidth
    const end = start + binWidth
    const center = start + binWidth / 2
    binStarts[i] = start
    binEnds[i] = end
    count[i] =
      gaussian(center, -0.18, 0.82) * 11_000 +
      gaussian(center, 1.48, 0.42) * 1_900 +
      gaussian(center, -2.85, 0.3) * 650 +
      Math.abs(Math.sin(i / 11)) * 38 +
      Math.abs(Math.cos(i / 37)) * 19
  }

  return {
    binStarts,
    binEnds,
    columns: {
      count,
    },
  }
}

function gaussian(value: number, center: number, width: number): number {
  const normalized = (value - center) / Math.max(Number.EPSILON, width)
  return Math.exp(-0.5 * normalized * normalized)
}
