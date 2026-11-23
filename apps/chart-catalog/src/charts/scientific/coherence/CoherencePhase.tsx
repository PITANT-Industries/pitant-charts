import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import '../scientific-figure.css'
import './coherence-phase.css'

export interface CoherenceRun {
  id: string
  label: string
  frequencyHz: readonly number[]
  coherence: readonly number[]
  phaseDeg: readonly number[]
}

export interface CoherenceData {
  runs: readonly CoherenceRun[]
}

export interface CoherencePhaseProps {
  data: CoherenceData
  label?: string
  compact?: boolean
  initialBand?: Band
  initialFrequencyHz?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Range = readonly [number, number]
type Band = 'full' | 'low'
type Field = 'coherence' | 'phaseDeg'
type Bins = { first: number; last: number }

const coherenceTicks = [0, .25, .5, .75, 1]
const phaseTicks = [-180, -90, 0, 90, 180]
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const coherenceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const phaseFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function frequencyDomain(data: CoherenceData): Range | null {
  if (!data.runs.length || new Set(data.runs.map(({ id }) => id)).size !== data.runs.length) return null
  let first = Infinity
  let last = 0
  for (const { frequencyHz, coherence, phaseDeg } of data.runs) {
    const count = frequencyHz.length
    if (count < 2 || coherence.length !== count || phaseDeg.length !== count) return null
    for (let index = 0; index < count; index++) {
      const frequency = frequencyHz[index]
      const estimate = coherence[index]
      const phase = phaseDeg[index]
      if (!Number.isFinite(frequency) || frequency < 0 || (index > 0 && frequency <= frequencyHz[index - 1])) return null
      if (!Number.isFinite(estimate) || estimate < 0 || estimate > 1) return null
      if (!Number.isFinite(phase) || phase < -180 || phase > 180) return null
    }
    first = Math.min(first, frequencyHz[0])
    last = Math.max(last, frequencyHz[count - 1])
  }
  return [first <= last / 100 ? 0 : first, last]
}

function insertionIndex(values: readonly number[], value: number) {
  let left = 0
  let right = values.length
  while (left < right) {
    const center = (left + right) >>> 1
    if (values[center] < value) left = center + 1
    else right = center
  }
  return left
}

function nearestBin(values: readonly number[], value: number, { first, last }: Bins) {
  const upper = Math.max(first, Math.min(last, insertionIndex(values, value)))
  const lower = Math.max(first, upper - 1)
  return Math.abs(values[upper] - value) < Math.abs(values[lower] - value) ? upper : lower
}

function binsInRange(values: readonly number[], range: Range): Bins {
  const start = insertionIndex(values, range[0])
  const end = insertionIndex(values, range[1])
  return { first: start, last: values[end] === range[1] ? end : end - 1 }
}

function linearTicks([minimum, maximum]: Range, target: number) {
  const interval = (maximum - minimum) / target
  const base = 10 ** Math.floor(Math.log10(interval))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => multiple * base >= interval) ?? 10)
  if (!(step > 0) || !Number.isFinite(step)) return [minimum, maximum]
  const first = Math.ceil(minimum / step)
  const last = Math.floor(maximum / step)
  const count = last - first + 1
  return count >= 2 ? Array.from({ length: Math.min(10, count) }, (_, index) => (first + index) * step) : [minimum, maximum]
}

function CoherencePanel({ run, field, range, bins, selected, threshold, compact, onSelect }: {
  run: CoherenceRun
  field: Field
  range: Range
  bins: Bins
  selected: number
  threshold: number
  compact: boolean
  onSelect: (index: number) => void
}) {
  const phasePanel = field === 'phaseDeg'
  const yTicks = phasePanel ? phaseTicks : coherenceTicks
  const showXLabel = phasePanel || compact
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 450 : 750, 205)
  const left = 53
  const right = Math.max(left + 1, width - 20)
  const top = 24
  const bottom = Math.max(top + 1, height - (showXLabel ? 39 : 25))
  const yMin = yTicks[0]
  const ySpan = yTicks[yTicks.length - 1] - yMin
  const x = (frequency: number) => left + (frequency - range[0]) / (range[1] - range[0]) * (right - left)
  const y = (value: number) => bottom - (value - yMin) / ySpan * (bottom - top)
  const trace: string[] = []
  const phaseDots: { index: number; x: number; y: number }[] = []
  let previous = NaN
  for (let index = bins.first; index <= bins.last; index++) {
    const value = run[field][index]
    const pointX = x(run.frequencyHz[index])
    const pointY = y(value)
    if (phasePanel && run.coherence[index] < threshold) {
      previous = NaN
      continue
    }
    const connects = Number.isFinite(previous) && (!phasePanel || Math.abs(value - previous) <= 180)
    trace.push(`${connects ? 'L' : 'M'}${pointX.toFixed(2)} ${pointY.toFixed(2)}`)
    if (phasePanel) phaseDots.push({ index, x: pointX, y: pointY })
    previous = value
  }
  const selectedX = x(run.frequencyHz[selected])
  const visibleMarker = !phasePanel || run.coherence[selected] >= threshold

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = (event.clientX - bounds.left) / bounds.width
    onSelect(nearestBin(run.frequencyHz, range[0] + fraction * (range[1] - range[0]), bins))
  }

  return (
    <div className="coherence-panel scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={phasePanel ? 'Wrapped cross-spectral phase in degrees versus frequency' : 'Magnitude-squared coherence versus frequency'}
        data-coherence-plot={phasePanel ? undefined : ''} data-cross-phase-plot={phasePanel ? '' : undefined}>
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-coherence-axis-frame="" x={left} y={top}
            width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={15}>
            {phasePanel ? '(b) Cross-spectral phase' : compact ? run.label : '(a) Magnitude-squared coherence'}
          </text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
            {phasePanel ? 'Phase (°)' : 'Coherence'}
          </text>
          {yTicks.map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          {linearTicks(range, width < 400 ? 4 : 7).map((frequency) => (
            <g key={frequency}>
              <line className="scientific-tick" x1={x(frequency)} x2={x(frequency)} y1={bottom} y2={bottom + 4} />
              <text x={x(frequency)} y={bottom + 17} textAnchor="middle">{format.format(frequency)}</text>
            </g>
          ))}
          {showXLabel && <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Frequency (Hz)</text>}
        </g>
        {!compact && (
          <line className="scientific-reference" x1={left} x2={right}
            y1={y(phasePanel ? 0 : threshold)} y2={y(phasePanel ? 0 : threshold)} />
        )}
        <path className="coherence-trace" data-coherence-trace={phasePanel ? undefined : ''}
          data-phase-trace={phasePanel ? '' : undefined} d={trace.join(' ')} />
        {phaseDots.map((point) => <circle key={point.index} className="coherence-phase-bin" cx={point.x} cy={point.y} r={1.55} />)}
        {!compact && (
          <>
            <line className="scientific-reference" x1={selectedX} x2={selectedX} y1={top} y2={bottom} />
            {visibleMarker && (
              <circle className="coherence-marker" data-phase-marker={phasePanel ? '' : undefined}
                data-coherence-marker={phasePanel ? undefined : ''}
                data-frequency={run.frequencyHz[selected]} cx={selectedX} cy={y(run[field][selected])} r={3.5} />
            )}
            <rect className="coherence-plot-pick" x={left} y={top} width={right - left} height={bottom - top}
              fill="transparent" onClick={choose} />
          </>
        )}
      </svg>
    </div>
  )
}

function CoherenceFigure({ data, domain, label, compact = false, initialBand = 'full', initialFrequencyHz, source }: CoherencePhaseProps & { domain: Range }) {
  const [runId, setRunId] = useState(data.runs[0].id)
  const [band, setBand] = useState<Band>(initialBand)
  const [threshold, setThreshold] = useState(.6)
  const [frequency, setFrequency] = useState(() => {
    if (initialFrequencyHz !== undefined && Number.isFinite(initialFrequencyHz)) return initialFrequencyHz
    const run = data.runs[0]
    const peak = run.coherence.reduce((best, value, index) => value > run.coherence[best] ? index : best, 0)
    return run.frequencyHz[peak]
  })
  const run = data.runs.find(({ id }) => id === runId) ?? data.runs[0]
  const low: Range = [domain[0], domain[0] + (domain[1] - domain[0]) / 4]
  const lowBins = binsInRange(run.frequencyHz, low)
  const hasLowBand = lowBins.last > lowBins.first
  const visibleBand = band === 'low' && hasLowBand ? 'low' : 'full'
  const range = visibleBand === 'low' ? low : domain
  const bins = visibleBand === 'low' ? lowBins : { first: 0, last: run.frequencyHz.length - 1 }
  const selected = nearestBin(run.frequencyHz, frequency, bins)
  const selectedFrequency = run.frequencyHz[selected]
  const coherence = run.coherence[selected]
  const displayedCoherence = coherence < 1 && coherence >= .99995 ? '<1' : coherenceFormat.format(coherence)
  const phase = coherence >= threshold ? run.phaseDeg[selected] : null
  const selectBin = (index: number) => setFrequency(run.frequencyHz[index])
  const bandLabel = ([min, max]: Range) => `${format.format(min)}–${format.format(max)} Hz`

  return (
    <figure className="coherence-chart" aria-label={label} data-coherence-chart="" data-compact={compact}>
      {!compact && (data.runs.length > 1 || hasLowBand) && (
        <div className="coherence-options">
          {data.runs.length > 1 && (
            <label>Recording
              <select value={run.id} onChange={(event) => setRunId(event.currentTarget.value)}>
                {data.runs.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
              </select>
            </label>
          )}
          {hasLowBand && (
            <label>Frequency band
              <select value={visibleBand} onChange={(event) => setBand(event.currentTarget.value as Band)}>
                <option value="full">{bandLabel(domain)}</option>
                <option value="low">{bandLabel(low)}</option>
              </select>
            </label>
          )}
        </div>
      )}
      <CoherencePanel run={run} field="coherence" range={range} bins={bins} selected={selected}
        threshold={threshold} compact={compact} onSelect={selectBin} />
      {!compact && (
        <>
          <CoherencePanel run={run} field="phaseDeg" range={range} bins={bins} selected={selected}
            threshold={threshold} compact={false} onSelect={selectBin} />
          <div className="coherence-inspector">
            <output data-coherence-readout="" data-frequency={selectedFrequency} data-coherence={coherence}
              data-phase={phase ?? ''} data-threshold={threshold}>
              <strong>{format.format(selectedFrequency)} Hz</strong>
              <span>Coherence {displayedCoherence}</span>
              <span>{phase === null ? 'Phase below threshold' : `Phase ${phaseFormat.format(phase)}°`}</span>
            </output>
            <div className="coherence-sliders">
              <label>Frequency
                <input type="range" min={bins.first} max={bins.last} value={selected}
                  aria-valuetext={`${format.format(selectedFrequency)} hertz`}
                  onChange={(event) => selectBin(event.currentTarget.valueAsNumber)} />
              </label>
              <label>
                <span className="coherence-threshold-label">Coherence threshold <span>{threshold.toFixed(2)}</span></span>
                <input type="range" min={0} max={1} step={.05} value={threshold} aria-label="Coherence threshold"
                  aria-valuetext={threshold.toFixed(2)} onChange={(event) => setThreshold(event.currentTarget.valueAsNumber)} />
              </label>
            </div>
          </div>
          {source && (
            <figcaption className="coherence-caption">
              <strong>{source.label}</strong>
              <p>{source.description} <a href={source.href}>Dataset</a>
                {source.license && <> · {source.licenseUrl ? <a href={source.licenseUrl}>{source.license}</a> : source.license}</>}</p>
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function CoherencePhase({ data, label = 'Coherence and cross-spectral phase', ...props }: CoherencePhaseProps) {
  const domain = useMemo(() => frequencyDomain(data), [data])
  if (!domain) {
    return <p className="chart-render-message" role="status">Provide aligned frequency bins, coherence from 0 to 1, and phase from −180° to 180°.</p>
  }
  return <CoherenceFigure {...props} data={data} domain={domain} label={label} />
}
