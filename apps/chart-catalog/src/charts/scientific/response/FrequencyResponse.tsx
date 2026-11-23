import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { deriveFrequencyResponses } from './frequency-response'
import type { FrequencyResponseData, FrequencyResponseSample } from './frequency-response'
import './frequency-response.css'

export interface FrequencyResponseProps {
  data: FrequencyResponseData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string }
}

type Responses = ReturnType<typeof deriveFrequencyResponses>
type Axis = { min: number; max: number; ticks: readonly number[] }
type BodeField = 'magnitudeDb' | 'phaseDeg'
type Position = readonly [number, number]

const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const bodeLabels = {
  magnitudeDb: { title: 'Magnitude (dB)', reference: 0 },
  phaseDeg: { title: 'Unwrapped phase (°)', reference: -180 },
}

function valueAxis(min: number, max: number, tickCount = 4): Axis {
  const extent = (max - min) || 1
  const target = extent / tickCount
  const power = 10 ** Math.floor(Math.log10(target))
  const step = ([1, 2, 2.5, 5, 10].find((multiple) => multiple * power >= target) ?? 10) * power
  if (!Number.isFinite(step) || step <= 0) return { min, max: max === min ? min + 1 : max, ticks: [min, max] }
  const first = Math.floor(min / step)
  const last = Math.max(first + 1, Math.ceil(max / step))
  const ticks = Array.from({ length: Math.min(10, last - first + 1) }, (_, index) => (first + index) * step)
  return { min: first * step, max: last * step, ticks }
}

function responseAxes(responses: Responses) {
  let lowDb = 0
  let highDb = 0
  let lowPhase = -180
  let highPhase = 0
  let lowReal = -1
  let highReal = 0
  let maxImaginary = 0
  for (const { samples } of responses) {
    for (const sample of samples) {
      lowDb = Math.min(lowDb, sample.magnitudeDb)
      highDb = Math.max(highDb, sample.magnitudeDb)
      lowPhase = Math.min(lowPhase, sample.phaseDeg)
      highPhase = Math.max(highPhase, sample.phaseDeg)
      lowReal = Math.min(lowReal, sample.real)
      highReal = Math.max(highReal, sample.real)
      maxImaginary = Math.max(maxImaginary, Math.abs(sample.imaginary))
    }
  }
  return {
    magnitudeDb: valueAxis(lowDb - 1, highDb + 1),
    phaseDeg: valueAxis(lowPhase - 5, Math.max(highPhase, 5), 6),
    real: valueAxis(lowReal - .12, highReal + .12),
    imaginary: valueAxis(-Math.max(.25, maxImaginary) * 1.04, Math.max(.25, maxImaginary) * 1.04, 6),
  }
}

function span(value: number, start: number, end: number) {
  return start + value * (end - start)
}

function svgPath(samples: readonly FrequencyResponseSample[], position: (sample: FrequencyResponseSample) => Position) {
  return samples.map((sample, index) => {
    const [x, y] = position(sample)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function closestFrequency(samples: readonly FrequencyResponseSample[], frequency: number) {
  const target = Math.log(frequency)
  let lower = 0
  let upper = samples.length - 1
  while (upper > lower + 1) {
    const middle = (lower + upper) >>> 1
    if (samples[middle].frequencyHz < frequency) lower = middle
    else upper = middle
  }
  const below = Math.abs(target - Math.log(samples[lower].frequencyHz))
  const above = Math.abs(target - Math.log(samples[upper].frequencyHz))
  return below <= above ? lower : upper
}

function logTicks(lower: number, upper: number, width: number) {
  const ticks: number[] = []
  const extent = upper - lower
  const minGap = extent * 32 / width
  for (let power = Math.floor(lower / Math.LN10); power <= Math.ceil(upper / Math.LN10); power++) {
    for (const multiple of [1, 2, 5]) {
      const value = power * Math.LN10 + Math.log(multiple)
      if (value >= lower && value <= upper && (!ticks.length || value - ticks[ticks.length - 1] >= minGap)) ticks.push(value)
    }
  }
  return ticks.length > 1 ? ticks : [lower, upper]
}

function clickPosition(event: MouseEvent<SVGRectElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height] as const
}

function BodePlot({ field, samples, selected, axis, onSelect }: {
  field: BodeField
  samples: readonly FrequencyResponseSample[]
  selected: FrequencyResponseSample
  axis: Axis
  onSelect: (index: number) => void
}) {
  const isPhase = field === 'phaseDeg'
  const { title, reference } = bodeLabels[field]
  const { plot, width, height } = usePlotSize<HTMLDivElement>(440, 168)
  const left = 40
  const right = Math.max(left + 1, width - 19)
  const top = 27
  const bottom = Math.max(top + 1, height - (isPhase ? 34 : 23))
  const logMin = Math.log(samples[0].frequencyHz)
  const logMax = Math.log(samples[samples.length - 1].frequencyHz)
  const x = (log: number) => span((log - logMin) / (logMax - logMin), left, right)
  const y = (value: number) => span((value - axis.min) / (axis.max - axis.min), bottom, top)
  const markerX = x(Math.log(selected.frequencyHz))
  const path = svgPath(samples, (sample) => [x(Math.log(sample.frequencyHz)), y(sample[field])])

  return (
    <div className={`response-panel response-bode${isPhase ? ' response-bode--phase' : ''}`} ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Bode ${title} versus frequency`}
        data-bode-magnitude={isPhase ? undefined : ''} data-bode-phase={isPhase ? '' : undefined}>
        <g className="response-grid" aria-hidden="true">
          {axis.ticks.map((value) => (
            <g key={value}>
              <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
              <text x={left - 5} y={y(value) + 3} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          {logTicks(logMin, logMax, right - left).map((log) => (
            <g key={log}>
              <line x1={x(log)} x2={x(log)} y1={top} y2={bottom} />
              <text x={x(log)} y={bottom + 13} textAnchor="middle">{format.format(Math.exp(log))}</text>
            </g>
          ))}
          <line className="response-reference" x1={left} x2={right} y1={y(reference)} y2={y(reference)} />
          <text className="response-axis-title" x={left} y={16}>{title}</text>
          {isPhase && <text className="response-axis-title" x={(left + right) / 2} y={height - 5} textAnchor="middle">Frequency (Hz, log)</text>}
        </g>
        <g aria-hidden="true">
          <path className="response-line" data-response-trace="" d={path} />
          <line className="response-crosshair" x1={markerX} x2={markerX} y1={top} y2={bottom} />
          <circle className="response-point" cx={markerX} cy={y(selected[field])} r={4} data-response-marker=""
            data-frequency={selected.frequencyHz} />
        </g>
        <rect className="response-bode-pick" x={left} y={top} width={right - left} height={bottom - top} fill="transparent"
          onClick={(event) => onSelect(closestFrequency(samples, Math.exp(span(clickPosition(event)[0], logMin, logMax))))} />
      </svg>
    </div>
  )
}

function NyquistPlot({ samples, selected, real, imaginary, compact, onSelect }: {
  samples: readonly FrequencyResponseSample[]
  selected: FrequencyResponseSample
  real: Axis
  imaginary: Axis
  compact: boolean
  onSelect: (index: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 450 : 380, compact ? 220 : 348)
  const leftPad = 41
  const rightPad = 14
  const topPad = 29
  const bottomPad = 39
  const availableWidth = Math.max(1, width - leftPad - rightPad)
  const availableHeight = Math.max(1, height - topPad - bottomPad)
  const scale = Math.min(availableWidth / (real.max - real.min), availableHeight / (imaginary.max - imaginary.min))
  const plotWidth = (real.max - real.min) * scale
  const plotHeight = (imaginary.max - imaginary.min) * scale
  const left = leftPad + (availableWidth - plotWidth) / 2
  const top = topPad + (availableHeight - plotHeight) / 2
  const x = (value: number) => left + (value - real.min) * scale
  const y = (value: number) => top + (imaginary.max - value) * scale
  const markerX = x(selected.real)
  const markerY = y(selected.imaginary)
  const criticalX = x(-1)
  const criticalY = y(0)

  function pick(event: MouseEvent<SVGRectElement>) {
    const [fractionX, fractionY] = clickPosition(event)
    const clickX = left + fractionX * plotWidth
    const clickY = top + fractionY * plotHeight
    let distance = Infinity
    let closest = 0
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index]
      const dx = clickX - x(sample.real)
      const toPositive = clickY - y(sample.imaginary)
      const toReflected = clickY - y(-sample.imaginary)
      const nearest = dx * dx + Math.min(toPositive * toPositive, toReflected * toReflected)
      if (nearest < distance) {
        closest = index
        distance = nearest
      }
    }
    onSelect(closest)
  }

  return (
    <div className="response-panel response-nyquist" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-nyquist-plot="" role="img"
        aria-label="Nyquist response in the complex plane with a reflected negative-frequency branch">
        <g className="response-grid" aria-hidden="true">
          {imaginary.ticks.map((value) => (
            <g key={value}>
              <line className={value === 0 ? 'response-zero' : undefined} x1={left} x2={left + plotWidth} y1={y(value)} y2={y(value)} />
              <text x={left - 6} y={y(value) + 3} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          {real.ticks.map((value) => (
            <g key={value}>
              <line className={value === 0 ? 'response-zero' : undefined} x1={x(value)} x2={x(value)} y1={top} y2={top + plotHeight} />
              <text x={x(value)} y={top + plotHeight + 13} textAnchor="middle">{format.format(value)}</text>
            </g>
          ))}
          <text className="response-axis-title" x={left} y={top - 8}>Imaginary</text>
          <text className="response-axis-title" x={left + plotWidth / 2} y={top + plotHeight + 28} textAnchor="middle">Real</text>
        </g>
        <g aria-hidden="true">
          <path className="response-reflection" d={svgPath(samples, (sample) => [x(sample.real), y(-sample.imaginary)])} />
          <path className="response-line" data-response-trace="" d={svgPath(samples, (sample) => [x(sample.real), y(sample.imaginary)])} />
          <path className="response-critical" data-nyquist-critical=""
            d={`M${criticalX - 3} ${criticalY - 3} l6 6 m-6 0 l6 -6`} />
          <text className="response-critical-label" x={criticalX - 7} y={criticalY - 6} textAnchor="end">−1</text>
          {!compact && <circle className="response-point" cx={markerX} cy={markerY} r={4} data-response-marker=""
            data-frequency={selected.frequencyHz} />}
        </g>
        {!compact && <rect className="response-nyquist-pick" x={left} y={top} width={plotWidth} height={plotHeight}
          fill="transparent" onClick={pick} />}
      </svg>
    </div>
  )
}

function FrequencyResponseFigure({ responses, compact, source, label }: Omit<FrequencyResponseProps, 'data'> & {
  responses: Responses
  label: string
}) {
  const [responseId, setResponseId] = useState(responses[0].id)
  const [frequency, setFrequency] = useState(() => {
    const samples = responses[0].samples
    return samples.reduce((peak, sample) => sample.magnitudeDb > peak.magnitudeDb ? sample : peak, samples[0]).frequencyHz
  })
  const response = responses.find(({ id }) => id === responseId) ?? responses[0]
  const axes = useMemo(() => responseAxes(responses), [responses])
  const { samples } = response
  const index = closestFrequency(samples, frequency)
  const selected = samples[index]

  function select(nextIndex: number) {
    setFrequency(samples[nextIndex].frequencyHz)
  }

  return (
    <figure className="frequency-response" aria-label={label} data-frequency-response="" data-compact={compact}>
      {!compact && source && (
        <figcaption className="response-caption">
          <strong>{source.label}</strong>
          <p>{source.description} <a href={source.href}>Frequency response methods</a></p>
        </figcaption>
      )}
      {!compact && responses.length > 1 && (
        <label className="response-gain">Loop gain
          <select value={response.id} onChange={(event) => setResponseId(event.currentTarget.value)}>
            {responses.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}
          </select>
        </label>
      )}
      <div className="response-panels">
        {!compact && (
          <div className="response-bode-stack">
            <BodePlot field="magnitudeDb" samples={samples} selected={selected} axis={axes.magnitudeDb} onSelect={select} />
            <BodePlot field="phaseDeg" samples={samples} selected={selected} axis={axes.phaseDeg} onSelect={select} />
          </div>
        )}
        <NyquistPlot samples={samples} selected={selected} real={axes.real} imaginary={axes.imaginary}
          compact={Boolean(compact)} onSelect={select} />
      </div>
      {!compact && (
        <div className="response-inspector">
          <output data-response-readout="" data-frequency={selected.frequencyHz}
            data-magnitude={selected.magnitudeDb} data-phase={selected.phaseDeg}
            data-real={selected.real} data-imaginary={selected.imaginary}>
            <strong>{format.format(selected.frequencyHz)} Hz</strong>
            <span>{format.format(selected.magnitudeDb)} dB · {format.format(selected.phaseDeg)}°</span>
            <span>Re {format.format(selected.real)} · Im {format.format(selected.imaginary)}</span>
          </output>
          <label>Frequency
            <input type="range" min={0} max={samples.length - 1} value={index}
              aria-valuetext={`${format.format(selected.frequencyHz)} hertz`}
              onChange={(event) => select(event.currentTarget.valueAsNumber)} />
          </label>
        </div>
      )}
    </figure>
  )
}

export function FrequencyResponse({ data, label = 'Linked Bode and Nyquist plots', ...props }: FrequencyResponseProps) {
  const responses = useMemo(() => deriveFrequencyResponses(data), [data])
  if (!responses.length) {
    return <p className="chart-render-message" role="status">Provide positive, increasing frequencies and aligned, nonzero complex samples.</p>
  }
  return <FrequencyResponseFigure {...props} responses={responses} label={label} />
}
