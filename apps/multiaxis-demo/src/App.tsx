import { type CSSProperties, type PointerEvent, useMemo, useState } from 'react'

type AxisSide = 'left' | 'right'

type SeriesId = 'pressure' | 'torque' | 'temperature' | 'vibration' | 'cycleState' | 'lubrication'
type ViewMode = 'rows' | 'focus' | 'normalized' | 'allAxes'
type OverlayId = 'alarmBands' | 'anomalyBands' | 'rollingAverage' | 'eventMarkers' | 'statusPoints'
type SignalStatus = 'normal' | 'warning' | 'anomaly' | 'alarm'
type EventSeverity = 'info' | 'maintenance' | 'quality' | 'alarm'

interface Sample {
  cycle: number
  time: number
  pressure: number
  torque: number
  temperature: number
  vibration: number
  cycleState: number
  lubrication: number
}

interface SeriesConfig {
  id: SeriesId
  label: string
  shortLabel: string
  unit: string
  color: string
  domain: readonly [number, number]
  side: AxisSide
  axisIndex: number
  decimals: number
  ticks: readonly number[]
  thresholds?: ThresholdConfig
  format?: (value: number) => string
  stepped?: boolean
}

interface ThresholdConfig {
  warning: readonly [low: number, high: number]
  alarm: readonly [low: number, high: number]
  anomaly: readonly [low: number, high: number]
  target?: number
}

interface Segment {
  startCycle: number
  endCycle: number
  state: number
}

interface PlotArea {
  left: number
  right: number
  top: number
  bottom: number
}

interface ViewModeConfig {
  id: ViewMode
  label: string
  eyebrow: string
  title: string
  useWhen: string
  avoidWhen: string
}

interface EventMarker {
  cycle: number
  label: string
  severity: EventSeverity
}

interface AnalyticsSummary {
  min: number
  max: number
  mean: number
  warningCount: number
  anomalyCount: number
  alarmCount: number
}

const VIEWBOX_WIDTH = 1200
const VIEWBOX_HEIGHT = 680
const ROW_VIEWBOX_HEIGHT = 620
const PLOT = {
  left: 236,
  right: 930,
  top: 72,
  bottom: 570,
} as const
const ROW_HEIGHT = 78
const ROW_STEP = ROW_HEIGHT
const ROW_TOP = 74

const STAGE_LABELS = ['Idle', 'Clamp', 'Press', 'Dwell', 'Return', 'Lube'] as const
const STAGE_COLORS = ['#8b95a5', '#2563eb', '#dc2626', '#7c3aed', '#16a34a', '#0891b2'] as const
const GRID_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const
const X_TICKS = [0, 20, 40, 60, 80, 100, 120] as const
const NORMALIZED_TICKS = [0, 25, 50, 75, 100] as const
const ROLLING_WINDOW = 9
const VIEW_MODES: readonly ViewModeConfig[] = [
  {
    id: 'rows',
    label: 'Rows',
    eyebrow: 'Operator view',
    title: 'Separate rows, shared cycle timeline',
    useWhen:
      'Use for daily monitoring, handoff reviews, and any case where operators need real units without axis clutter.',
    avoidWhen:
      'Do not use when the main question is whether two signals have the same shape at the same moment.',
  },
  {
    id: 'focus',
    label: 'Focus axis',
    eyebrow: 'Analysis view',
    title: 'One active y-axis, all visible signals overlaid',
    useWhen: 'Use when one signal is primary and the rest are context around it.',
    avoidWhen:
      'Do not use for exact comparison between non-active signals because their axes are hidden.',
  },
  {
    id: 'normalized',
    label: 'Normalized',
    eyebrow: 'Correlation view',
    title: 'All visible signals scaled to 0-100%',
    useWhen: 'Use to compare timing, shape, lag, spikes, and correlation across different units.',
    avoidWhen: 'Do not use when absolute values or alarm thresholds in real units matter.',
  },
  {
    id: 'allAxes',
    label: 'All axes',
    eyebrow: 'Expert view',
    title: 'Every selected metric keeps a visible y-axis',
    useWhen:
      'Use for debugging scale mapping or for expert users who need every axis visible at once.',
    avoidWhen:
      'Do not use as the default operator view; it becomes noisy as soon as many signals are enabled.',
  },
] as const

const EVENTS: readonly EventMarker[] = [
  { cycle: 18, label: 'Recipe load', severity: 'info' },
  { cycle: 34, label: 'Pressure spike', severity: 'alarm' },
  { cycle: 52, label: 'Tool change', severity: 'maintenance' },
  { cycle: 88, label: 'Vibration spike', severity: 'alarm' },
  { cycle: 103, label: 'Lube drop', severity: 'quality' },
] as const

const DEFAULT_OVERLAYS: Record<OverlayId, boolean> = {
  alarmBands: true,
  anomalyBands: true,
  rollingAverage: true,
  eventMarkers: true,
  statusPoints: true,
}

const CYCLE_INFO_SERIES: SeriesConfig = {
  id: 'cycleState',
  label: 'Cycle info',
  shortLabel: 'Cycle',
  unit: 'stage',
  color: '#d97706',
  domain: [0, 5],
  side: 'right',
  axisIndex: 1,
  decimals: 0,
  ticks: [0, 1, 2, 3, 4, 5],
  format: (value) => STAGE_LABELS[Math.round(value)] ?? String(value),
  stepped: true,
}

const SERIES: readonly SeriesConfig[] = [
  {
    id: 'pressure',
    label: 'Pressure',
    shortLabel: 'Pressure',
    unit: 'bar',
    color: '#2563eb',
    domain: [60, 190],
    side: 'left',
    axisIndex: 0,
    decimals: 0,
    ticks: [60, 90, 120, 150, 180],
    thresholds: {
      warning: [70, 165],
      alarm: [65, 180],
      anomaly: [72, 172],
      target: 125,
    },
  },
  {
    id: 'torque',
    label: 'Torque',
    shortLabel: 'Torque',
    unit: 'N m',
    color: '#16a34a',
    domain: [90, 360],
    side: 'left',
    axisIndex: 1,
    decimals: 0,
    ticks: [100, 160, 220, 280, 340],
    thresholds: {
      warning: [115, 315],
      alarm: [95, 350],
      anomaly: [105, 330],
      target: 210,
    },
  },
  {
    id: 'temperature',
    label: 'Temperature',
    shortLabel: 'Temp',
    unit: 'C',
    color: '#dc2626',
    domain: [30, 120],
    side: 'left',
    axisIndex: 2,
    decimals: 0,
    ticks: [40, 60, 80, 100, 120],
    thresholds: {
      warning: [36, 105],
      alarm: [32, 116],
      anomaly: [38, 108],
      target: 72,
    },
  },
  {
    id: 'vibration',
    label: 'Vibration',
    shortLabel: 'Vibration',
    unit: 'mm/s',
    color: '#7c3aed',
    domain: [0, 14],
    side: 'right',
    axisIndex: 0,
    decimals: 1,
    ticks: [0, 3, 6, 9, 12],
    thresholds: {
      warning: [0.3, 9],
      alarm: [0, 12],
      anomaly: [0.4, 10.5],
      target: 3,
    },
  },
  CYCLE_INFO_SERIES,
  {
    id: 'lubrication',
    label: 'Lubrication',
    shortLabel: 'Lube',
    unit: '%',
    color: '#0891b2',
    domain: [0, 100],
    side: 'right',
    axisIndex: 2,
    decimals: 0,
    ticks: [0, 25, 50, 75, 100],
    thresholds: {
      warning: [18, 88],
      alarm: [10, 96],
      anomaly: [16, 90],
      target: 45,
    },
  },
] as const

const AXIS_POSITIONS = {
  left: [194, 126, 58],
  right: [978, 1046, 1114],
} as const

function getStage(cycle: number): number {
  const phase = cycle % 24
  if (phase < 3) return 0
  if (phase < 7) return 1
  if (phase < 14) return 2
  if (phase < 17) return 3
  if (phase < 22) return 4
  return 5
}

function generateSamples(): Sample[] {
  return Array.from({ length: 121 }, (_, cycle) => {
    const stage = getStage(cycle)
    const phase = cycle % 24
    const pressPulse = stage === 2 ? Math.sin(((phase - 7) / 7) * Math.PI) : 0
    const clampPulse = stage === 1 ? (phase - 3) / 4 : 0
    const returnPulse = stage === 4 ? Math.sin(((phase - 17) / 5) * Math.PI) : 0
    const lubricationPulse = stage === 5 ? 82 - (phase - 22) * 15 : 28 + Math.sin(cycle / 8) * 6
    const pressureSpike = cycle === 34 || cycle === 35 ? 22 : 0
    const torqueSpike = cycle === 34 ? 72 : 0
    const temperatureDrift = cycle >= 96 && cycle <= 102 ? 20 : 0
    const vibrationSpike = cycle === 88 ? 5.4 : 0
    const lubricationDrop = cycle >= 101 && cycle <= 105 ? -22 : 0

    return {
      cycle,
      time: cycle * 0.5,
      pressure: 82 + pressPulse * 86 + clampPulse * 18 + Math.sin(cycle / 5) * 5 + pressureSpike,
      torque: 145 + pressPulse * 154 + returnPulse * 55 + Math.cos(cycle / 7) * 14 + torqueSpike,
      temperature: 48 + cycle * 0.42 + pressPulse * 8 + Math.sin(cycle / 11) * 3 + temperatureDrift,
      vibration:
        1.8 +
        pressPulse * 7.8 +
        returnPulse * 3.2 +
        Math.abs(Math.sin(cycle / 2.6)) * 1.1 +
        vibrationSpike,
      cycleState: stage,
      lubrication: Math.max(4, Math.min(96, lubricationPulse + lubricationDrop)),
    }
  })
}

function buildSegments(samples: readonly Sample[]): Segment[] {
  const first = samples[0]
  if (!first) return []

  const segments: Segment[] = []
  let startCycle = first.cycle
  let state = first.cycleState

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample) continue

    if (sample.cycleState !== state) {
      const previous = samples[index - 1]
      if (previous) {
        segments.push({ startCycle, endCycle: previous.cycle, state })
      }
      startCycle = sample.cycle
      state = sample.cycleState
    }
  }

  const last = samples[samples.length - 1]
  if (last) {
    segments.push({ startCycle, endCycle: last.cycle, state })
  }

  return segments
}

function plotWidth(area: PlotArea): number {
  return area.right - area.left
}

function plotHeight(area: PlotArea): number {
  return area.bottom - area.top
}

function xForArea(cycle: number, samples: readonly Sample[], area: PlotArea): number {
  const first = samples[0]?.cycle ?? 0
  const last = samples[samples.length - 1]?.cycle ?? 1
  return area.left + ((cycle - first) / (last - first)) * plotWidth(area)
}

function yForArea(value: number, domain: readonly [number, number], area: PlotArea): number {
  const [min, max] = domain
  return area.bottom - ((value - min) / (max - min)) * plotHeight(area)
}

function xFor(cycle: number, samples: readonly Sample[]): number {
  return xForArea(cycle, samples, PLOT)
}

function yFor(value: number, domain: readonly [number, number]): number {
  return yForArea(value, domain, PLOT)
}

function valueFor(sample: Sample, id: SeriesId): number {
  return sample[id]
}

function formatValue(value: number, series: SeriesConfig): string {
  if (series.format) return series.format(value)
  return `${value.toFixed(series.decimals)} ${series.unit}`
}

function formatTickValue(value: number, series: SeriesConfig): string {
  if (series.format) return series.format(value)
  return value.toFixed(series.decimals)
}

function isOutsideBand(value: number, band: readonly [number, number]): boolean {
  return value < band[0] || value > band[1]
}

function statusForValue(value: number, series: SeriesConfig): SignalStatus {
  const thresholds = series.thresholds
  if (!thresholds) return 'normal'
  if (isOutsideBand(value, thresholds.alarm)) return 'alarm'
  if (isOutsideBand(value, thresholds.anomaly)) return 'anomaly'
  if (isOutsideBand(value, thresholds.warning)) return 'warning'
  return 'normal'
}

function buildAnalyticsSummary(samples: readonly Sample[], series: SeriesConfig): AnalyticsSummary {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let total = 0
  let warningCount = 0
  let anomalyCount = 0
  let alarmCount = 0

  for (const sample of samples) {
    const value = valueFor(sample, series.id)
    const status = statusForValue(value, series)
    min = Math.min(min, value)
    max = Math.max(max, value)
    total += value

    if (status === 'warning') warningCount += 1
    if (status === 'anomaly') anomalyCount += 1
    if (status === 'alarm') alarmCount += 1
  }

  return {
    min,
    max,
    mean: samples.length > 0 ? total / samples.length : 0,
    warningCount,
    anomalyCount,
    alarmCount,
  }
}

function rollingAverageAt(
  samples: readonly Sample[],
  series: SeriesConfig,
  index: number,
  windowSize = ROLLING_WINDOW,
): number {
  const start = Math.max(0, index - windowSize + 1)
  let total = 0
  let count = 0

  for (let cursor = start; cursor <= index; cursor += 1) {
    const sample = samples[cursor]
    if (!sample) continue
    total += valueFor(sample, series.id)
    count += 1
  }

  return count > 0 ? total / count : 0
}

function normalizeValue(value: number, domain: readonly [number, number]): number {
  const [min, max] = domain
  return ((value - min) / (max - min)) * 100
}

function getSeriesById(id: SeriesId): SeriesConfig {
  const series = SERIES.find((candidate) => candidate.id === id)
  if (!series) {
    throw new Error(`Unknown series: ${id}`)
  }
  return series
}

function getViewModeConfig(id: ViewMode): ViewModeConfig {
  const mode = VIEW_MODES.find((candidate) => candidate.id === id)
  if (!mode) {
    throw new Error(`Unknown view mode: ${id}`)
  }
  return mode
}

function rowArea(index: number): PlotArea {
  const top = ROW_TOP + index * ROW_STEP
  return {
    left: PLOT.left,
    right: PLOT.right,
    top,
    bottom: top + ROW_HEIGHT,
  }
}

function buildLinePathForArea(
  samples: readonly Sample[],
  series: SeriesConfig,
  area: PlotArea,
  domain: readonly [number, number] = series.domain,
  readValue: (sample: Sample) => number = (sample) => valueFor(sample, series.id),
): string {
  const first = samples[0]
  if (!first) return ''

  let path = `M ${xForArea(first.cycle, samples, area).toFixed(2)} ${yForArea(readValue(first), domain, area).toFixed(2)}`

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    const previous = samples[index - 1]
    if (!sample || !previous) continue

    const x = xForArea(sample.cycle, samples, area)
    const y = yForArea(readValue(sample), domain, area)

    if (series.stepped) {
      const previousY = yForArea(readValue(previous), domain, area)
      path += ` L ${x.toFixed(2)} ${previousY.toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
  }

  return path
}

function buildLinePath(samples: readonly Sample[], series: SeriesConfig): string {
  return buildLinePathForArea(samples, series, PLOT)
}

function buildRollingAveragePathForArea(
  samples: readonly Sample[],
  series: SeriesConfig,
  area: PlotArea,
  domain: readonly [number, number] = series.domain,
  readValue: (sample: Sample) => number = (sample) => valueFor(sample, series.id),
  windowSize = ROLLING_WINDOW,
): string {
  let path = ''

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample) continue

    const start = Math.max(0, index - windowSize + 1)
    let total = 0
    let count = 0

    for (let cursor = start; cursor <= index; cursor += 1) {
      const windowSample = samples[cursor]
      if (!windowSample) continue
      total += readValue(windowSample)
      count += 1
    }

    const average = count > 0 ? total / count : readValue(sample)
    const x = xForArea(sample.cycle, samples, area)
    const y = yForArea(average, domain, area)
    path += `${path === '' ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `
  }

  return path.trim()
}

function nearestSampleIndex(samples: readonly Sample[], cycle: number): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample) continue

    const distance = Math.abs(sample.cycle - cycle)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }

  return nearestIndex
}

function axisX(series: SeriesConfig): number {
  return AXIS_POSITIONS[series.side][series.axisIndex] ?? PLOT.left
}

function App(): React.JSX.Element {
  const samples = useMemo(() => generateSamples(), [])
  const segments = useMemo(() => buildSegments(samples), [samples])
  const [viewMode, setViewMode] = useState<ViewMode>('rows')
  const [activeSeriesId, setActiveSeriesId] = useState<SeriesId>('pressure')
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>(DEFAULT_OVERLAYS)
  const [visible, setVisible] = useState<Record<SeriesId, boolean>>({
    pressure: true,
    torque: true,
    temperature: true,
    vibration: true,
    cycleState: true,
    lubrication: true,
  })
  const [selectedIndex, setSelectedIndex] = useState(samples.length - 28)
  const selected = samples[selectedIndex] ?? samples[0]

  const activeSeries = getSeriesById(activeSeriesId)
  const modeConfig = getViewModeConfig(viewMode)
  const visibleSeries = useMemo(() => SERIES.filter((series) => visible[series.id]), [visible])
  const activeAnalytics = useMemo(
    () => buildAnalyticsSummary(samples, activeSeries),
    [samples, activeSeries],
  )
  const activeRollingAverage = selected ? rollingAverageAt(samples, activeSeries, selectedIndex) : 0
  const activeStatus = selected
    ? statusForValue(valueFor(selected, activeSeries.id), activeSeries)
    : 'normal'

  function toggleSeries(id: SeriesId): void {
    setVisible((current) => ({ ...current, [id]: !current[id] }))
  }

  function chooseActiveSeries(id: SeriesId): void {
    setActiveSeriesId(id)
    setVisible((current) => ({ ...current, [id]: true }))
  }

  function toggleOverlay(id: OverlayId): void {
    setOverlays((current) => ({ ...current, [id]: !current[id] }))
  }

  function updateCursor(event: PointerEvent<SVGSVGElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH
    if (pointerX < PLOT.left || pointerX > PLOT.right) return

    const firstCycle = samples[0]?.cycle ?? 0
    const lastCycle = samples[samples.length - 1]?.cycle ?? 1
    const cycle = firstCycle + ((pointerX - PLOT.left) / plotWidth(PLOT)) * (lastCycle - firstCycle)
    setSelectedIndex(nearestSampleIndex(samples, cycle))
  }

  return (
    <main className="app-shell">
      <section className="control-panel" aria-label="Signal controls">
        <div className="panel-heading">
          <p className="eyebrow">Industrial cycle</p>
          <h1>Multi-axis graph</h1>
          <p className="panel-copy">
            Switch layouts to trade off detail, clarity, and axis density.
          </p>
        </div>

        <fieldset className="mode-switch">
          <legend className="control-label">Display mode</legend>
          {VIEW_MODES.map((mode) => (
            <button
              aria-pressed={viewMode === mode.id}
              className="mode-button"
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </fieldset>

        <fieldset className="axis-picker">
          <legend className="control-label">Active axis</legend>
          <div className="axis-picker-grid">
            {SERIES.map((series) => (
              <button
                aria-pressed={activeSeriesId === series.id}
                className="axis-button"
                key={series.id}
                style={{ '--series-color': series.color } as CSSProperties}
                type="button"
                onClick={() => chooseActiveSeries(series.id)}
              >
                {series.shortLabel}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="overlay-picker">
          <legend className="control-label">Analytics layers</legend>
          <label>
            <input
              checked={overlays.alarmBands}
              type="checkbox"
              onChange={() => toggleOverlay('alarmBands')}
            />
            Warning and alarm limits
          </label>
          <label>
            <input
              checked={overlays.anomalyBands}
              type="checkbox"
              onChange={() => toggleOverlay('anomalyBands')}
            />
            Anomaly threshold band
          </label>
          <label>
            <input
              checked={overlays.rollingAverage}
              type="checkbox"
              onChange={() => toggleOverlay('rollingAverage')}
            />
            Rolling average
          </label>
          <label>
            <input
              checked={overlays.eventMarkers}
              type="checkbox"
              onChange={() => toggleOverlay('eventMarkers')}
            />
            Event markers
          </label>
          <label>
            <input
              checked={overlays.statusPoints}
              type="checkbox"
              onChange={() => toggleOverlay('statusPoints')}
            />
            Alarm/anomaly points
          </label>
        </fieldset>

        <div className="series-list">
          {SERIES.map((series) => (
            <label className="series-toggle" key={series.id}>
              <input
                checked={visible[series.id]}
                type="checkbox"
                onChange={() => toggleSeries(series.id)}
              />
              <span className="swatch" style={{ backgroundColor: series.color }} />
              <span>
                <strong>{series.label}</strong>
                <small>
                  {series.domain[0]}-{series.domain[1]} {series.unit}
                </small>
              </span>
            </label>
          ))}
        </div>

        <dl className="readout">
          <div>
            <dt>Cycle</dt>
            <dd>{selected?.cycle ?? 0}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{(selected?.time ?? 0).toFixed(1)}s</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{selected ? formatValue(selected.cycleState, CYCLE_INFO_SERIES) : 'Idle'}</dd>
          </div>
        </dl>
      </section>

      <section className="chart-panel" aria-label="Multi-axis machine graph">
        <div className="chart-toolbar">
          <div>
            <p className="eyebrow">{modeConfig.eyebrow}</p>
            <h2>{modeConfig.title}</h2>
          </div>
          <div className="selected-pill">cycle {selected?.cycle ?? 0}</div>
        </div>

        <div className="mode-guidance">
          <div>
            <strong>Use when</strong>
            <p>{modeConfig.useWhen}</p>
          </div>
          <div>
            <strong>Do not use when</strong>
            <p>{modeConfig.avoidWhen}</p>
          </div>
        </div>

        <AnalyticsPanel
          activeSeries={activeSeries}
          rollingAverage={activeRollingAverage}
          selected={selected}
          status={activeStatus}
          summary={activeAnalytics}
        />

        <div className={`chart-frame mode-${viewMode}`}>
          {viewMode === 'rows' ? (
            <RowsChart
              samples={samples}
              segments={segments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'focus' ? (
            <FocusAxisChart
              samples={samples}
              segments={segments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'normalized' ? (
            <NormalizedChart
              samples={samples}
              segments={segments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
          {viewMode === 'allAxes' ? (
            <MultiAxisChart
              samples={samples}
              segments={segments}
              selected={selected}
              visibleSeries={visibleSeries}
              activeSeries={activeSeries}
              overlays={overlays}
              onPointerMove={updateCursor}
            />
          ) : null}
        </div>

        <div className="detail-grid">
          {SERIES.map((series) => {
            const value = selected ? valueFor(selected, series.id) : 0
            const status = statusForValue(value, series)
            return (
              <button
                aria-pressed={activeSeriesId === series.id}
                className={`detail-tile status-${status}`}
                key={series.id}
                type="button"
                onClick={() => chooseActiveSeries(series.id)}
              >
                <span className="detail-dot" style={{ backgroundColor: series.color }} />
                <span>{series.shortLabel}</span>
                <strong style={{ color: series.color }}>{formatValue(value, series)}</strong>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}

interface MultiAxisChartProps {
  samples: readonly Sample[]
  segments: readonly Segment[]
  selected: Sample | undefined
  visibleSeries: readonly SeriesConfig[]
  activeSeries: SeriesConfig
  overlays: Record<OverlayId, boolean>
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
}

interface ModeChartProps extends MultiAxisChartProps {
  activeSeries: SeriesConfig
}

interface CycleBandProps {
  samples: readonly Sample[]
  segments: readonly Segment[]
  y: number
  height: number
}

function CycleBand({ samples, segments, y, height }: CycleBandProps): React.JSX.Element {
  return (
    <g aria-label="Cycle phase band">
      {segments.map((segment) => {
        const x = xFor(segment.startCycle, samples)
        const endX = xFor(segment.endCycle + 1, samples)
        const color = STAGE_COLORS[segment.state] ?? '#6b7280'
        return (
          <rect
            fill={color}
            key={`${segment.startCycle}-${segment.endCycle}-${segment.state}-${y}`}
            opacity="0.2"
            x={x}
            y={y}
            width={Math.max(2, endX - x)}
            height={height}
          />
        )
      })}
    </g>
  )
}

interface PlotGridProps {
  samples: readonly Sample[]
}

function PlotGrid({ samples }: PlotGridProps): React.JSX.Element {
  return (
    <>
      <rect
        className="plot-bg"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />

      {GRID_FRACTIONS.map((fraction) => {
        const y = PLOT.top + plotHeight(PLOT) * fraction
        return (
          <line
            className="grid-line"
            key={`grid-y-${fraction}`}
            x1={PLOT.left}
            x2={PLOT.right}
            y1={y}
            y2={y}
          />
        )
      })}

      {X_TICKS.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <g key={`x-${tick}`}>
            <line className="grid-line vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
            <text className="x-tick" x={x} y={PLOT.bottom + 34} textAnchor="middle">
              {tick}
            </text>
          </g>
        )
      })}

      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 66}>
        Cycle index / machine time
      </text>
    </>
  )
}

interface SingleAxisProps {
  series: SeriesConfig
}

function SingleAxis({ series }: SingleAxisProps): React.JSX.Element {
  const x = PLOT.left - 34

  return (
    <g className="axis-group focus-axis" style={{ color: series.color }}>
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        {series.label}
      </text>
      {series.ticks.map((tick) => {
        const y = yFor(tick, series.domain)
        return (
          <g key={`focus-${series.id}-${tick}`}>
            <line className="axis-tick" x1={x} x2={x + 8} y1={y} y2={y} />
            <text className="axis-tick-label" x={x - 12} y={y + 4} textAnchor="end">
              {formatTickValue(tick, series)}
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 34} textAnchor="middle">
        {series.unit}
      </text>
    </g>
  )
}

function NormalizedAxis(): React.JSX.Element {
  const x = PLOT.left - 34

  return (
    <g className="axis-group normalized-axis">
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        Normalized
      </text>
      {NORMALIZED_TICKS.map((tick) => {
        const y = yFor(tick, [0, 100])
        return (
          <g key={`normalized-${tick}`}>
            <line className="axis-tick" x1={x} x2={x + 8} y1={y} y2={y} />
            <text className="axis-tick-label" x={x - 12} y={y + 4} textAnchor="end">
              {tick}%
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 34} textAnchor="middle">
        0-100%
      </text>
    </g>
  )
}

interface CursorLayerProps {
  selected: Sample | undefined
  selectedX: number
  visibleSeries: readonly SeriesConfig[]
  activeSeries?: SeriesConfig
}

function CursorLayer({
  selected,
  selectedX,
  visibleSeries,
  activeSeries,
}: CursorLayerProps): React.JSX.Element | null {
  if (!selected) return null

  return (
    <g className="cursor-layer">
      <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
      <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
      <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
        {selected.cycle}
      </text>
      {visibleSeries.map((series) => {
        const y = yFor(valueFor(selected, series.id), series.domain)
        return (
          <circle
            className="cursor-dot"
            cx={selectedX}
            cy={y}
            fill={series.color}
            key={`dot-${series.id}`}
            r={activeSeries?.id === series.id ? 5.5 : 4.5}
          />
        )
      })}
    </g>
  )
}

interface EmptyStateProps {
  y: number
}

function EmptyState({ y }: EmptyStateProps): React.JSX.Element {
  return (
    <text className="empty-state" x={(PLOT.left + PLOT.right) / 2} y={y} textAnchor="middle">
      Select at least one signal
    </text>
  )
}

interface AnalyticsPanelProps {
  activeSeries: SeriesConfig
  rollingAverage: number
  selected: Sample | undefined
  status: SignalStatus
  summary: AnalyticsSummary
}

function AnalyticsPanel({
  activeSeries,
  rollingAverage,
  selected,
  status,
  summary,
}: AnalyticsPanelProps): React.JSX.Element {
  const selectedValue = selected ? valueFor(selected, activeSeries.id) : 0

  return (
    <section className="analytics-panel" aria-label="Active signal analytics">
      <div className="analytics-heading">
        <span className="control-label">Active signal</span>
        <strong>{activeSeries.label}</strong>
        <span className={`status-chip status-${status}`}>{status}</span>
      </div>

      <dl className="analytics-grid">
        <div>
          <dt>Value</dt>
          <dd>{formatValue(selectedValue, activeSeries)}</dd>
        </div>
        <div>
          <dt>Rolling avg</dt>
          <dd>{formatValue(rollingAverage, activeSeries)}</dd>
        </div>
        <div>
          <dt>Min / max</dt>
          <dd>
            {formatTickValue(summary.min, activeSeries)} /{' '}
            {formatTickValue(summary.max, activeSeries)}
          </dd>
        </div>
        <div>
          <dt>Mean</dt>
          <dd>{formatValue(summary.mean, activeSeries)}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{summary.warningCount}</dd>
        </div>
        <div>
          <dt>Anomalies</dt>
          <dd>{summary.anomalyCount}</dd>
        </div>
        <div>
          <dt>Alarms</dt>
          <dd>{summary.alarmCount}</dd>
        </div>
      </dl>
    </section>
  )
}

interface ThresholdOverlayProps {
  area: PlotArea
  normalized?: boolean
  overlays: Record<OverlayId, boolean>
  series: SeriesConfig
}

function ThresholdOverlay({
  area,
  normalized = false,
  overlays,
  series,
}: ThresholdOverlayProps): React.JSX.Element | null {
  const thresholds = series.thresholds
  if (!thresholds) return null
  const domain: readonly [number, number] = normalized ? [0, 100] : series.domain
  const project = (value: number) => (normalized ? normalizeValue(value, series.domain) : value)

  return (
    <g className="threshold-layer">
      {overlays.anomalyBands ? (
        <rect
          className="anomaly-band"
          x={area.left}
          y={yForArea(project(thresholds.anomaly[1]), domain, area)}
          width={plotWidth(area)}
          height={
            yForArea(project(thresholds.anomaly[0]), domain, area) -
            yForArea(project(thresholds.anomaly[1]), domain, area)
          }
        />
      ) : null}

      {overlays.alarmBands ? (
        <>
          <ThresholdLine
            area={area}
            domain={domain}
            label="warn low"
            kind="warning"
            value={project(thresholds.warning[0])}
          />
          <ThresholdLine
            area={area}
            domain={domain}
            label="warn high"
            kind="warning"
            value={project(thresholds.warning[1])}
          />
          <ThresholdLine
            area={area}
            domain={domain}
            label="alarm low"
            kind="alarm"
            value={project(thresholds.alarm[0])}
          />
          <ThresholdLine
            area={area}
            domain={domain}
            label="alarm high"
            kind="alarm"
            value={project(thresholds.alarm[1])}
          />
          {thresholds.target !== undefined ? (
            <ThresholdLine
              area={area}
              domain={domain}
              label="target"
              kind="target"
              value={project(thresholds.target)}
            />
          ) : null}
        </>
      ) : null}
    </g>
  )
}

interface ThresholdLineProps {
  area: PlotArea
  domain: readonly [number, number]
  kind: 'warning' | 'alarm' | 'target'
  label: string
  value: number
}

function ThresholdLine({
  area,
  domain,
  kind,
  label,
  value,
}: ThresholdLineProps): React.JSX.Element {
  const y = yForArea(value, domain, area)

  return (
    <g className={`threshold-line threshold-${kind}`}>
      <line x1={area.left} x2={area.right} y1={y} y2={y} />
      <text x={area.right + 10} y={y + 4}>
        {label}
      </text>
    </g>
  )
}

interface StatusMarkersProps {
  area: PlotArea
  domain?: readonly [number, number]
  normalized?: boolean
  samples: readonly Sample[]
  series: SeriesConfig
}

function StatusMarkers({
  area,
  domain,
  normalized = false,
  samples,
  series,
}: StatusMarkersProps): React.JSX.Element | null {
  if (!series.thresholds) return null
  const projectedDomain: readonly [number, number] =
    domain ?? (normalized ? [0, 100] : series.domain)

  return (
    <g className="status-point-layer">
      {samples.map((sample) => {
        const rawValue = valueFor(sample, series.id)
        const status = statusForValue(rawValue, series)
        if (status === 'normal') return null
        const projectedValue = normalized ? normalizeValue(rawValue, series.domain) : rawValue

        return (
          <circle
            className={`status-point status-${status}`}
            cx={xForArea(sample.cycle, samples, area)}
            cy={yForArea(projectedValue, projectedDomain, area)}
            key={`${series.id}-${sample.cycle}-${status}`}
            r={status === 'alarm' ? 4.6 : 3.6}
          />
        )
      })}
    </g>
  )
}

interface EventLayerProps {
  samples: readonly Sample[]
  y1: number
  y2: number
  showLabels?: boolean
}

function EventLayer({ samples, y1, y2, showLabels = true }: EventLayerProps): React.JSX.Element {
  return (
    <g className="event-layer">
      {EVENTS.map((event) => {
        const x = xFor(event.cycle, samples)
        return (
          <g
            className={`event-marker event-${event.severity}`}
            key={`${event.cycle}-${event.label}`}
          >
            <line x1={x} x2={x} y1={y1} y2={y2} />
            {showLabels ? (
              <text x={x + 6} y={y1 - 6}>
                {event.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

function RowsChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left
  const rowCount = Math.max(visibleSeries.length, 1)
  const bottomAxisY = ROW_TOP + rowCount * ROW_STEP + 26

  return (
    <svg
      aria-label="Stacked rows chart with one scale per metric"
      className="chart-svg chart-svg-rows"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${ROW_VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <CycleBand samples={samples} segments={segments} y={34} height={15} />

      {visibleSeries.length === 0 ? <EmptyState y={ROW_VIEWBOX_HEIGHT / 2} /> : null}

      {visibleSeries.map((series, index) => {
        const area = rowArea(index)
        const isActive = activeSeries.id === series.id
        const selectedValue = selected ? valueFor(selected, series.id) : 0
        const selectedY = yForArea(selectedValue, series.domain, area)

        return (
          <g className={isActive ? 'row-chart is-active' : 'row-chart'} key={series.id}>
            <rect
              className="row-bg"
              x={area.left}
              y={area.top}
              width={plotWidth(area)}
              height={plotHeight(area)}
            />

            {GRID_FRACTIONS.map((fraction) => {
              const y = area.top + plotHeight(area) * fraction
              return (
                <line
                  className="grid-line"
                  key={`${series.id}-row-grid-${fraction}`}
                  x1={area.left}
                  x2={area.right}
                  y1={y}
                  y2={y}
                />
              )
            })}

            {X_TICKS.map((tick) => {
              const x = xForArea(tick, samples, area)
              return (
                <line
                  className="grid-line vertical row-vertical"
                  key={`${series.id}-row-x-${tick}`}
                  x1={x}
                  x2={x}
                  y1={area.top}
                  y2={area.bottom}
                />
              )
            })}

            <ThresholdOverlay area={area} overlays={overlays} series={series} />

            <text className="row-label" fill={series.color} x="48" y={area.top + 24}>
              {series.label}
            </text>
            <text className="row-unit" x="48" y={area.top + 50}>
              {series.unit}
            </text>
            <text className="row-tick" x={area.left - 14} y={area.top + 16} textAnchor="end">
              {formatTickValue(series.domain[1], series)}
            </text>
            <text className="row-tick" x={area.left - 14} y={area.bottom - 8} textAnchor="end">
              {formatTickValue(series.domain[0], series)}
            </text>

            <path
              className="series-line row-line"
              d={buildLinePathForArea(samples, series, area)}
              stroke={series.color}
              strokeDasharray={series.stepped ? '7 7' : undefined}
            />

            {overlays.rollingAverage && !series.stepped ? (
              <path
                className="rolling-average-line"
                d={buildRollingAveragePathForArea(samples, series, area)}
              />
            ) : null}

            {overlays.statusPoints ? (
              <StatusMarkers area={area} samples={samples} series={series} />
            ) : null}

            {selected ? (
              <>
                <circle
                  className="cursor-dot"
                  cx={selectedX}
                  cy={selectedY}
                  fill={series.color}
                  r={isActive ? 5.5 : 4}
                />
                <text
                  className="row-value"
                  fill={series.color}
                  x={area.right + 18}
                  y={area.top + 46}
                >
                  {formatValue(selectedValue, series)}
                </text>
              </>
            ) : null}

            <rect
              className="row-border"
              x={area.left}
              y={area.top}
              width={plotWidth(area)}
              height={plotHeight(area)}
            />
          </g>
        )
      })}

      {overlays.eventMarkers ? (
        <EventLayer
          samples={samples}
          y1={58}
          y2={Math.min(ROW_TOP + rowCount * ROW_STEP, ROW_VIEWBOX_HEIGHT - 86)}
        />
      ) : null}

      {selected ? (
        <line
          className="rows-cursor-line"
          x1={selectedX}
          x2={selectedX}
          y1="58"
          y2={Math.min(ROW_TOP + rowCount * ROW_STEP, ROW_VIEWBOX_HEIGHT - 86)}
        />
      ) : null}

      {X_TICKS.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <text
            className="x-tick"
            key={`rows-x-label-${tick}`}
            x={x}
            y={bottomAxisY}
            textAnchor="middle"
          >
            {tick}
          </text>
        )
      })}
      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={bottomAxisY + 32}>
        Cycle index / machine time
      </text>
    </svg>
  )
}

function FocusAxisChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left

  return (
    <svg
      aria-label="Overlay chart with one active y-axis"
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <PlotGrid samples={samples} />
      <CycleBand samples={samples} segments={segments} y={PLOT.top - 30} height={16} />
      <SingleAxis series={activeSeries} />
      <ThresholdOverlay area={PLOT} overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      {visibleSeries.length === 0 ? <EmptyState y={(PLOT.top + PLOT.bottom) / 2} /> : null}

      {visibleSeries.map((series) => {
        const isActive = activeSeries.id === series.id
        return (
          <path
            className={isActive ? 'series-line is-active' : 'series-line is-muted'}
            d={buildLinePath(samples, series)}
            key={series.id}
            stroke={series.color}
            strokeDasharray={series.stepped ? '7 7' : undefined}
          />
        )
      })}

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT)}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} samples={samples} series={activeSeries} />
      ) : null}

      <CursorLayer
        selected={selected}
        selectedX={selectedX}
        visibleSeries={visibleSeries}
        activeSeries={activeSeries}
      />

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

function NormalizedChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: ModeChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left

  return (
    <svg
      aria-label="Normalized chart with every metric scaled from 0 to 100 percent"
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <PlotGrid samples={samples} />
      <CycleBand samples={samples} segments={segments} y={PLOT.top - 30} height={16} />
      <NormalizedAxis />
      <ThresholdOverlay area={PLOT} normalized overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      {visibleSeries.length === 0 ? <EmptyState y={(PLOT.top + PLOT.bottom) / 2} /> : null}

      {visibleSeries.map((series) => {
        const isActive = activeSeries.id === series.id
        return (
          <path
            className={isActive ? 'series-line is-active' : 'series-line'}
            d={buildLinePathForArea(samples, series, PLOT, [0, 100], (sample) =>
              normalizeValue(valueFor(sample, series.id), series.domain),
            )}
            key={series.id}
            stroke={series.color}
            strokeDasharray={series.stepped ? '7 7' : undefined}
          />
        )
      })}

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT, [0, 100], (sample) =>
            normalizeValue(valueFor(sample, activeSeries.id), activeSeries.domain),
          )}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} normalized samples={samples} series={activeSeries} />
      ) : null}

      {selected ? (
        <g className="cursor-layer">
          <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
          <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
          <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
            {selected.cycle}
          </text>
          {visibleSeries.map((series) => {
            const normalized = normalizeValue(valueFor(selected, series.id), series.domain)
            return (
              <circle
                className="cursor-dot"
                cx={selectedX}
                cy={yFor(normalized, [0, 100])}
                fill={series.color}
                key={`normalized-dot-${series.id}`}
                r={activeSeries.id === series.id ? 5.5 : 4}
              />
            )
          })}
        </g>
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

function MultiAxisChart({
  samples,
  segments,
  selected,
  visibleSeries,
  activeSeries,
  overlays,
  onPointerMove,
}: MultiAxisChartProps): React.JSX.Element {
  const selectedX = selected ? xFor(selected.cycle, samples) : PLOT.left

  return (
    <svg
      aria-label="Multi-axis chart with independent y-axis scales"
      className="chart-svg"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      onPointerMove={onPointerMove}
    >
      <rect
        className="plot-bg"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />

      {GRID_FRACTIONS.map((fraction) => {
        const y = PLOT.top + plotHeight(PLOT) * fraction
        return (
          <line
            className="grid-line"
            key={`grid-y-${fraction}`}
            x1={PLOT.left}
            x2={PLOT.right}
            y1={y}
            y2={y}
          />
        )
      })}

      {X_TICKS.map((tick) => {
        const x = xFor(tick, samples)
        return (
          <g key={`x-${tick}`}>
            <line className="grid-line vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
            <text className="x-tick" x={x} y={PLOT.bottom + 34} textAnchor="middle">
              {tick}
            </text>
          </g>
        )
      })}

      <text className="x-label" x={(PLOT.left + PLOT.right) / 2} y={PLOT.bottom + 66}>
        Cycle index / machine time
      </text>

      <g aria-label="Cycle phase band">
        {segments.map((segment) => {
          const x = xFor(segment.startCycle, samples)
          const endX = xFor(segment.endCycle + 1, samples)
          const color = STAGE_COLORS[segment.state] ?? '#6b7280'
          return (
            <rect
              fill={color}
              key={`${segment.startCycle}-${segment.endCycle}-${segment.state}`}
              opacity="0.2"
              x={x}
              y={PLOT.top - 30}
              width={Math.max(2, endX - x)}
              height="16"
            />
          )
        })}
      </g>

      <ThresholdOverlay area={PLOT} overlays={overlays} series={activeSeries} />

      {overlays.eventMarkers ? (
        <EventLayer samples={samples} y1={PLOT.top - 30} y2={PLOT.bottom} />
      ) : null}

      {SERIES.map((series) => (
        <Axis key={series.id} series={series} visible={visibleSeries.includes(series)} />
      ))}

      {visibleSeries.map((series) => (
        <path
          className="series-line"
          d={buildLinePath(samples, series)}
          key={series.id}
          stroke={series.color}
          strokeDasharray={series.stepped ? '7 7' : undefined}
        />
      ))}

      {overlays.rollingAverage && !activeSeries.stepped ? (
        <path
          className="rolling-average-line is-active"
          d={buildRollingAveragePathForArea(samples, activeSeries, PLOT)}
        />
      ) : null}

      {overlays.statusPoints ? (
        <StatusMarkers area={PLOT} samples={samples} series={activeSeries} />
      ) : null}

      {selected ? (
        <g className="cursor-layer">
          <line x1={selectedX} x2={selectedX} y1={PLOT.top - 30} y2={PLOT.bottom} />
          <rect x={selectedX - 30} y={PLOT.bottom + 10} width="60" height="24" rx="5" />
          <text x={selectedX} y={PLOT.bottom + 27} textAnchor="middle">
            {selected.cycle}
          </text>
          {visibleSeries.map((series) => {
            const y = yFor(valueFor(selected, series.id), series.domain)
            return (
              <circle
                className="cursor-dot"
                cx={selectedX}
                cy={y}
                fill={series.color}
                key={`dot-${series.id}`}
                r="5"
              />
            )
          })}
        </g>
      ) : null}

      <rect
        className="plot-border"
        x={PLOT.left}
        y={PLOT.top}
        width={plotWidth(PLOT)}
        height={plotHeight(PLOT)}
      />
    </svg>
  )
}

interface AxisProps {
  series: SeriesConfig
  visible: boolean
}

function Axis({ series, visible }: AxisProps): React.JSX.Element {
  const x = axisX(series)
  const textAnchor = series.side === 'left' ? 'end' : 'start'
  const tickStart = series.side === 'left' ? x : x - 8
  const tickEnd = series.side === 'left' ? x + 8 : x
  const labelX = series.side === 'left' ? x - 12 : x + 12

  return (
    <g className={visible ? 'axis-group' : 'axis-group muted'} style={{ color: series.color }}>
      <line className="axis-line" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
      <text className="axis-title" x={x} y="42" textAnchor="middle">
        {series.shortLabel}
      </text>
      {series.ticks.map((tick) => {
        const y = yFor(tick, series.domain)
        return (
          <g key={`${series.id}-${tick}`}>
            <line className="axis-tick" x1={tickStart} x2={tickEnd} y1={y} y2={y} />
            <text className="axis-tick-label" x={labelX} y={y + 4} textAnchor={textAnchor}>
              {series.format ? series.format(tick) : tick.toFixed(series.decimals)}
            </text>
          </g>
        )
      })}
      <text className="axis-unit" x={x} y={PLOT.bottom + 34} textAnchor="middle">
        {series.unit}
      </text>
    </g>
  )
}

export { App }
