import { useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './phase-plane.css'

export interface PhasePlaneSample {
  timeSeconds: number
  position: number
  velocity: number
}

export interface PhasePlaneRun {
  id: string
  label: string
  samples: readonly PhasePlaneSample[]
  acceleration?: (position: number, velocity: number) => number
}

export interface PhasePlaneData {
  positionLabel: string
  positionUnit: string
  velocityLabel: string
  velocityUnit: string
  runs: readonly PhasePlaneRun[]
}

export interface PhasePlaneProps {
  data: PhasePlaneData
  label?: string
  compact?: boolean
  initialTimeSeconds?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Domain = readonly [number, number]
type Domains = { time: Domain; position: Domain; velocity: Domain }
type Coordinate = readonly [number, number]
type Frame = { left: number; right: number; top: number; bottom: number }
const numbers = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const axis = (label: string, unit: string) => unit ? `${label} (${unit})` : label
const format = (value: number) => numbers.format(value).replace('-', '−')
const positionOn = (value: number, [low, high]: Domain, a: number, b: number) => a + (value - low) / (high - low) * (b - a)

function extent(low: number, high: number): Domain {
  const pad = low === high ? (Math.abs(low) || 1) * .1 : (high - low) * .08
  return [low - pad, high + pad]
}

function domainsFor({ runs }: PhasePlaneData): Domains | null {
  if (!runs.length || new Set(runs.map(({ id }) => id)).size !== runs.length) return null
  let first = Infinity
  let last = -Infinity
  let lowPosition = Infinity
  let highPosition = -Infinity
  let lowVelocity = Infinity
  let highVelocity = -Infinity
  for (const { samples } of runs) {
    if (samples.length < 2) return null
    let previous = -Infinity
    for (const { timeSeconds, position, velocity } of samples) {
      if (!Number.isFinite(timeSeconds) || timeSeconds <= previous || !Number.isFinite(position) || !Number.isFinite(velocity)) return null
      previous = timeSeconds
      lowPosition = Math.min(lowPosition, position)
      highPosition = Math.max(highPosition, position)
      lowVelocity = Math.min(lowVelocity, velocity)
      highVelocity = Math.max(highVelocity, velocity)
    }
    first = Math.min(first, samples[0].timeSeconds)
    last = Math.max(last, previous)
  }
  const domains = { time: [first, last] as Domain, position: extent(lowPosition, highPosition), velocity: extent(lowVelocity, highVelocity) }
  return Object.values(domains).every(([low, high]) => high > low && Number.isFinite(high - low)) ? domains : null
}

function ticks([min, max]: Domain, target: number) {
  const approximate = (max - min) / target
  const base = 10 ** Math.floor(Math.log10(approximate))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= approximate) ?? 10)
  if (!Number.isFinite(step) || step <= 0) return [min, max]
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  return last > first ? Array.from({ length: Math.min(10, last - first + 1) }, (_, index) => (first + index) * step) : [min, max]
}

function nearestSample(samples: readonly PhasePlaneSample[], time: number) {
  let low = 0
  let high = samples.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    const before = samples[middle].timeSeconds
    const after = samples[middle + 1].timeSeconds
    if (time <= before + (after - before) / 2) high = middle
    else low = middle + 1
  }
  return low
}

function linePath(coordinates: readonly Coordinate[]) {
  return coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
}

function arrowHead([tipX, tipY]: Coordinate, dx: number, dy: number, length: number) {
  const span = Math.hypot(dx, dy)
  if (!(span > 0) || !Number.isFinite(span)) return ''
  const ux = dx / span
  const uy = dy / span
  const tailX = tipX - ux * length
  const tailY = tipY - uy * length
  const wing = length * .55
  return linePath([[tailX + uy * wing, tailY - ux * wing], [tipX, tipY], [tailX - uy * wing, tailY + ux * wing]])
}

function directionArrows(points: readonly Coordinate[]) {
  const lengths = points.slice(1).map(([x, y], index) => Math.hypot(x - points[index][0], y - points[index][1]))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (total < 12) return []
  let traversed = 0
  let segment = 0
  return [.15, .36, .57, .78].map((fraction) => {
    const distance = total * fraction
    while (segment < lengths.length - 1 && traversed + lengths[segment] < distance) traversed += lengths[segment++]
    const [ax, ay] = points[segment]
    const [bx, by] = points[segment + 1]
    const weight = (distance - traversed) / lengths[segment]
    return arrowHead([ax + weight * (bx - ax), ay + weight * (by - ay)], bx - ax, by - ay, 5)
  }).filter(Boolean)
}

function directionField(domain: Domains, frame: Frame, acceleration: NonNullable<PhasePlaneRun['acceleration']>) {
  const { left, right, top, bottom } = frame
  const columns = Math.max(4, Math.min(15, Math.floor((right - left) / 30)))
  const rows = Math.max(3, Math.min(9, Math.floor((bottom - top) / 28)))
  const length = Math.min((right - left) / columns, (bottom - top) / rows) * .36
  const scaleX = (right - left) / (domain.position[1] - domain.position[0])
  const scaleY = (top - bottom) / (domain.velocity[1] - domain.velocity[0])
  const paths: string[] = []
  for (let column = 0; column < columns; column++) {
    const x = left + (column + .5) / columns * (right - left)
    const position = positionOn(x, [left, right], ...domain.position)
    for (let row = 0; row < rows; row++) {
      const y = top + (row + .5) / rows * (bottom - top)
      const velocity = positionOn(y, [top, bottom], domain.velocity[1], domain.velocity[0])
      const dx = velocity * scaleX
      const dy = acceleration(position, velocity) * scaleY
      const magnitude = Math.hypot(dx, dy)
      if (!(magnitude > 0) || !Number.isFinite(magnitude)) continue
      const hx = dx / magnitude * length / 2
      const hy = dy / magnitude * length / 2
      const tip = [x + hx, y + hy] as const
      paths.push(linePath([[x - hx, y - hy], tip]), arrowHead(tip, dx, dy, length * .28))
    }
  }
  return paths.join(' ')
}

function PlotAxes({ frame, xDomain, yDomain, xLabel, yLabel, height, panel, compact }: {
  frame: Frame
  xDomain: Domain
  yDomain: Domain
  xLabel: string
  yLabel: string
  height: number
  panel: 'phase' | 'history'
  compact: boolean
}) {
  const { left, right, top, bottom } = frame
  const x = (value: number) => positionOn(value, xDomain, left, right)
  const y = (value: number) => positionOn(value, yDomain, bottom, top)
  const showZero = ([low, high]: Domain) => low < 0 && high > 0
  return (
    <g className="scientific-axis" aria-hidden="true">
      {panel === 'phase' && showZero(xDomain) && <line className="phase-zero" x1={x(0)} x2={x(0)} y1={top} y2={bottom} />}
      {showZero(yDomain) && <line className="phase-zero" x1={left} x2={right} y1={y(0)} y2={y(0)} />}
      <rect className="scientific-frame" data-phase-axis-frame={panel === 'phase' ? '' : undefined}
        x={left} y={top} width={right - left} height={bottom - top} />
      {ticks(xDomain, right - left < 330 ? 4 : 6).map((value) => (
        <g key={value}>
          <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
          <text x={x(value)} y={bottom + 17} textAnchor="middle">{format(value)}</text>
        </g>
      ))}
      {ticks(yDomain, bottom - top < 150 ? 3 : 5).map((value) => (
        <g key={value}>
          <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
          <text x={left - 8} y={y(value) + 4} textAnchor="end">{format(value)}</text>
        </g>
      ))}
      <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">{xLabel}</text>
      <text className="scientific-axis-label phase-y-label" data-short-label={compact || panel === 'history'}
        transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
    </g>
  )
}

function Portrait({ data, domain, run, sample, compact, showField, label }: {
  data: PhasePlaneData
  domain: Domains
  run: PhasePlaneRun
  sample: PhasePlaneSample
  compact: boolean
  showField: boolean
  label: string
}) {
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 410 : 720, compact ? 170 : 350)
  const left = width < 355 ? 49 : 56
  const right = Math.max(left + 1, width - 19)
  const top = 16
  const bottom = Math.max(top + 1, height - 41)
  const frame = { left, right, top, bottom }
  const coordinates = useMemo(() => run.samples.map(({ position, velocity }) =>
    [positionOn(position, domain.position, left, right), positionOn(velocity, domain.velocity, bottom, top)] as const),
  [run.samples, domain, left, right, bottom, top])
  const arrows = useMemo(() => directionArrows(coordinates), [coordinates])
  const path = useMemo(() => linePath(coordinates), [coordinates])
  const fieldPath = showField && !compact && run.acceleration ? directionField(domain, frame, run.acceleration) : ''
  const cx = positionOn(sample.position, domain.position, left, right)
  const cy = positionOn(sample.velocity, domain.velocity, bottom, top)

  return (
    <div ref={plot} className="phase-portrait scientific-plot">
      <svg data-phase-plot="" role="img" aria-label={`${label}, ${run.label}. ${data.velocityLabel} against ${data.positionLabel}.`}
        viewBox={`0 0 ${width} ${height}`}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        <PlotAxes frame={frame} xDomain={domain.position} yDomain={domain.velocity} xLabel={axis(data.positionLabel, data.positionUnit)}
          yLabel={axis(data.velocityLabel, data.velocityUnit)} height={height} panel="phase" compact={compact} />
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {fieldPath && <path className="phase-field" data-phase-field="" d={fieldPath} />}
          <path className="phase-trace" data-phase-trace="" d={path} />
          {arrows.map((arrow, index) => <path key={index} className="phase-arrow" data-phase-direction="" d={arrow} />)}
          <circle className="phase-start" cx={coordinates[0][0]} cy={coordinates[0][1]} r={compact ? 2.6 : 3.2} />
          {!compact && (
            <circle className="phase-cursor" data-phase-cursor="" data-time={sample.timeSeconds}
              data-position={sample.position} data-velocity={sample.velocity} cx={cx} cy={cy} r={4.5} />
          )}
        </g>
      </svg>
    </div>
  )
}

function TimeHistory({ data, domain, run, sample, onSelect }: {
  data: PhasePlaneData
  domain: Domains
  run: PhasePlaneRun
  sample: PhasePlaneSample
  onSelect: (time: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(720, 170)
  const left = width < 355 ? 49 : 56
  const right = Math.max(left + 1, width - 19)
  const top = 17
  const bottom = Math.max(top + 1, height - 41)
  const frame = { left, right, top, bottom }
  const x = (time: number) => positionOn(time, domain.time, left, right)
  const y = (position: number) => positionOn(position, domain.position, bottom, top)
  const path = useMemo(() => linePath(run.samples.map(({ timeSeconds, position }) =>
    [positionOn(timeSeconds, domain.time, left, right), positionOn(position, domain.position, bottom, top)])),
  [run.samples, domain, left, right, bottom, top])
  const cx = x(sample.timeSeconds)

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onSelect(positionOn(fraction, [0, 1], ...domain.time))
  }

  return (
    <div className="phase-history scientific-plot" ref={plot}>
      <svg role="img" aria-label={`${run.label}. ${data.positionLabel} over time.`} data-phase-history=""
        viewBox={`0 0 ${width} ${height}`}>
        <PlotAxes frame={frame} xDomain={domain.time} yDomain={domain.position} xLabel="Time, t (s)"
          yLabel={axis(data.positionLabel, data.positionUnit)} height={height} panel="history" compact={false} />
        <g aria-hidden="true">
          <path className="phase-trace phase-history-trace" d={path} />
          <line x1={cx} x2={cx} y1={top} y2={bottom} className="scientific-reference" />
          <circle className="phase-cursor" data-phase-history-cursor="" data-time={sample.timeSeconds}
            data-position={sample.position} cx={cx} cy={y(sample.position)} r={3.5} />
        </g>
        <rect className="phase-history-pick" x={left} y={top} width={right - left} height={bottom - top} fill="transparent" onClick={choose} />
      </svg>
    </div>
  )
}

function PhaseFigure({ data, domain, label, compact = false, initialTimeSeconds, source }:
  PhasePlaneProps & { domain: Domains; label: string }) {
  const [runId, setRunId] = useState(data.runs[0].id)
  const [time, setTime] = useState(initialTimeSeconds !== undefined && Number.isFinite(initialTimeSeconds)
    ? initialTimeSeconds : data.runs[0].samples[0].timeSeconds)
  const [showField, setShowField] = useState(true)
  const run = data.runs.find(({ id }) => id === runId) ?? data.runs[0]
  const index = nearestSample(run.samples, time)
  const sample = run.samples[index]
  const selectedTime = `${format(sample.timeSeconds)} s`

  return (
    <figure className="phase-plane" data-phase-plane="" data-compact={compact}>
      {!compact && (
        <div className="phase-controls">
          {data.runs.length > 1 && (
            <label>Trajectory
              <select value={run.id} onChange={(event) => setRunId(event.currentTarget.value)}>
                {data.runs.map(({ id, label: condition }) => <option key={id} value={id}>{condition}</option>)}
              </select>
            </label>
          )}
          {run.acceleration && (
            <label><input type="checkbox" checked={showField} onChange={(event) => setShowField(event.currentTarget.checked)} />Show direction field</label>
          )}
        </div>
      )}
      <Portrait data={data} domain={domain} run={run} sample={sample} label={label} compact={compact} showField={showField} />
      {!compact && (
        <>
          <div className="phase-key" aria-label="Figure key">
            <span><svg width="25" height="10" aria-hidden="true"><path className="phase-arrow" d="M1 5h22m-5-4l5 4-5 4" /></svg>Increasing time</span>
            <span><svg width="12" height="10" aria-hidden="true"><circle className="phase-start" cx="6" cy="5" r="3" /></svg>Initial sample</span>
          </div>
          <TimeHistory data={data} domain={domain} run={run} sample={sample} onSelect={setTime} />
          <label className="phase-scrub">Time
            <input type="range" min={0} max={run.samples.length - 1} step={1} value={index} aria-valuetext={selectedTime}
              onChange={(event) => setTime(run.samples[Number(event.currentTarget.value)].timeSeconds)} />
          </label>
          <output className="phase-readout" data-phase-readout="" data-time={sample.timeSeconds}
            data-position={sample.position} data-velocity={sample.velocity}>
            <span>Time <strong>{selectedTime}</strong></span>
            <span>{data.positionLabel} <strong>{format(sample.position)} {data.positionUnit}</strong></span>
            <span>{data.velocityLabel} <strong>{format(sample.velocity)} {data.velocityUnit}</strong></span>
          </output>
          {source && (
            <figcaption className="phase-caption">
              <a href={source.href}>{source.label}</a>
              {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
              {source.description && <p>{source.description}</p>}
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function PhasePlane({ data, label = 'Phase-plane portrait', ...props }: PhasePlaneProps) {
  const domain = useMemo(() => domainsFor(data), [data])
  if (!domain) return <p className="chart-render-message" role="status">Provide finite position and velocity samples in increasing time order for each trajectory.</p>
  return <PhaseFigure {...props} data={data} domain={domain} label={label} />
}
