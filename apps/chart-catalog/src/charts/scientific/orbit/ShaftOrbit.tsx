import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import type { ShaftOrbitData, ShaftOrbitRun } from './shaft-orbit-data'
import '../scientific-figure.css'
import './shaft-orbit.css'

export interface ShaftOrbitProps {
  data: ShaftOrbitData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string }
}

type OrbitWindow = { start: number; end: number; durationMs: number }
type PlotPosition = (x: number, y: number) => readonly [number, number]

const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const ticks = [-1, -.5, 0, .5, 1]

function displacementLimit(data: ShaftOrbitData) {
  if (!data.runs.length || new Set(data.runs.map((run) => run.id)).size !== data.runs.length) return null
  let peak = 0
  for (const run of data.runs) {
    const { sampleRateHz, xUm, yUm, triggerSamples } = run
    if (!(sampleRateHz > 0) || !Number.isFinite(sampleRateHz) || xUm.length !== yUm.length) return null
    if (triggerSamples.length < 2 || !triggerSamples.every((sample, index) =>
      Number.isInteger(sample) && sample >= 0 && sample < xUm.length &&
      (index === 0 || sample > triggerSamples[index - 1]))) return null
    for (let index = 0; index < xUm.length; index++) {
      const x = xUm[index]
      const y = yUm[index]
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      peak = Math.max(peak, Math.abs(x), Math.abs(y))
    }
  }
  const target = Math.max(1, peak) * 1.04
  const increment = 10 ** Math.floor(Math.log10(target)) / 2
  const padded = Math.ceil(target / increment) * increment
  return Number.isFinite(padded) ? padded : peak
}

function revolutionWindow(run: ShaftOrbitRun, revolution: number): OrbitWindow {
  const start = run.triggerSamples[revolution]
  const end = run.triggerSamples[revolution + 1]
  return { start, end, durationMs: (end - start) / run.sampleRateHz * 1000 }
}

function trace(window: OrbitWindow, position: (index: number) => readonly [number, number]) {
  const points: string[] = []
  for (let index = window.start; index <= window.end; index++) {
    const [x, y] = position(index)
    points.push(`${index === window.start ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return points.join(' ')
}

function interpolate(values: readonly number[], index: number) {
  const lower = Math.floor(index)
  const amount = index - lower
  return amount === 0 ? values[lower] : values[lower] * (1 - amount) + values[lower + 1] * amount
}

function relativeClick(event: MouseEvent<SVGRectElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height] as const
}

function closestOrbitPhase(run: ShaftOrbitRun, window: OrbitWindow, position: PlotPosition, clickX: number, clickY: number) {
  let closest = window.start
  let distance = Infinity
  let [x, y] = position(run.xUm[window.start], run.yUm[window.start])
  for (let index = window.start; index < window.end; index++) {
    const [nextX, nextY] = position(run.xUm[index + 1], run.yUm[index + 1])
    const dx = nextX - x
    const dy = nextY - y
    const squaredLength = dx * dx + dy * dy
    const projection = squaredLength ? ((clickX - x) * dx + (clickY - y) * dy) / squaredLength : 0
    const weight = Math.min(1, Math.max(0, projection))
    const residual = Math.hypot(clickX - x - weight * dx, clickY - y - weight * dy)
    if (residual < distance) {
      closest = index + weight
      distance = residual
    }
    x = nextX
    y = nextY
  }
  return Math.round((closest - window.start) / (window.end - window.start) * 360)
}

function OrbitPlot({ run, revolution, window, limit, displacement, compact, label, onPick }: {
  run: ShaftOrbitRun
  revolution: number
  window: OrbitWindow
  limit: number
  displacement: readonly [number, number]
  compact: boolean
  label: string
  onPick: (phase: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 430 : 380, 330)
  const size = Math.max(1, Math.min(width - 80, height - 68))
  const left = Math.max(52, (width - size) / 2 + 9)
  const top = Math.max(26, (height - size) / 2 - 7)
  const bottom = top + size
  const centerX = left + size / 2
  const centerY = top + size / 2
  const position: PlotPosition = (x, y) => [centerX + (x / limit) * size / 2, centerY - (y / limit) * size / 2]
  const sample = (index: number) => position(run.xUm[index], run.yUm[index])
  const [triggerX, triggerY] = sample(window.start)
  const [selectedX, selectedY] = position(...displacement)
  const nearby = [revolution - 1, revolution + 1].filter((index) => index >= 0 && index < run.triggerSamples.length - 1)
  const arrowIndex = window.start + Math.floor((window.end - window.start) * .27)
  const [arrowX, arrowY] = sample(arrowIndex)
  const [nextX, nextY] = sample(arrowIndex + 1)
  const direction = Math.atan2(nextY - arrowY, nextX - arrowX) * 180 / Math.PI
  const showDirection = Math.hypot(nextX - arrowX, nextY - arrowY) > .05

  function pick(event: MouseEvent<SVGRectElement>) {
    const [x, y] = relativeClick(event)
    onPick(closestOrbitPhase(run, window, position, left + x * size, top + y * size))
  }

  return (
    <div className="orbit-panel orbit-panel--xy scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-orbit-plot="" role="img" aria-label={label}>
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-orbit-axis-frame="" x={left} y={top} width={size} height={size} />
          <line className="scientific-reference" x1={centerX} x2={centerX} y1={top} y2={bottom} />
          <line className="scientific-reference" x1={left} x2={left + size} y1={centerY} y2={centerY} />
          {(compact ? [-1, 0, 1] : ticks).map((tick) => {
            const [x, y] = position(tick * limit, tick * limit)
            return (
              <g key={tick}>
                <line className="scientific-tick" x1={x} x2={x} y1={bottom} y2={bottom + 4} />
                <line className="scientific-tick" x1={left - 4} x2={left} y1={y} y2={y} />
                <text x={left - 8} y={y + 4} textAnchor="end">{format.format(tick * limit)}</text>
                <text x={x} y={bottom + 17} textAnchor="middle">{format.format(tick * limit)}</text>
              </g>
            )
          })}
          <text className="scientific-panel-title" x={left} y={top - 9}>{compact ? run.label : '(a) Shaft centerline orbit'}</text>
          <text className="scientific-axis-label" transform={`translate(${left - 38} ${centerY}) rotate(-90)`} textAnchor="middle">Y displacement (µm)</text>
          <text className="scientific-axis-label" x={centerX} y={bottom + 32} textAnchor="middle">X displacement (µm)</text>
        </g>
        <g aria-hidden="true">
          {nearby.map((index) => (
            <path key={index} className="orbit-adjacent" d={trace(revolutionWindow(run, index), sample)} />
          ))}
          <path className="orbit-trace" d={trace(window, sample)} data-orbit-path="" />
          {showDirection && <path className="orbit-direction" d="M -3 -3 L 4 0 L -3 3 Z"
            transform={`translate(${arrowX} ${arrowY}) rotate(${direction})`} />}
          <path className="orbit-trigger" d={`M ${triggerX} ${triggerY - 6} l 6 6 -6 6 -6 -6 Z`}
            data-orbit-trigger="" />
          {!compact && <circle className="orbit-focus" cx={selectedX} cy={selectedY} r={3.5} />}
        </g>
        {!compact && <rect className="orbit-orbit-pick" x={left} y={top} width={size} height={size} fill="transparent" onClick={pick} />}
      </svg>
    </div>
  )
}

function WaveformPlot({ run, window, phase, limit, displacement, onPick }: {
  run: ShaftOrbitRun
  window: OrbitWindow
  phase: number
  limit: number
  displacement: readonly [number, number]
  onPick: (phase: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(460, 330)
  const left = 53
  const right = Math.max(left + 1, width - 20)
  const top = 26
  const bottom = Math.max(top + 1, height - 41)
  const x = (fraction: number) => left + (right - left) * fraction
  const y = (value: number) => (top + bottom) / 2 - (value / limit) * (bottom - top) / 2
  const valuePath = (channel: readonly number[]) => trace(window, (index) =>
    [x((index - window.start) / (window.end - window.start)), y(channel[index])])
  const focusX = x(phase / 360)

  return (
    <div className="orbit-panel orbit-panel--waveforms scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-orbit-waveforms="" role="img"
        aria-label="Aligned X and Y probe waveforms for the selected revolution">
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-orbit-waveform-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <line className="scientific-reference" x1={left} x2={right} y1={y(0)} y2={y(0)} />
          {ticks.map((tick) => {
            const height = y(tick * limit)
            return <g key={tick}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={height} y2={height} />
              <text x={left - 8} y={height + 4} textAnchor="end">{format.format(tick * limit)}</text>
            </g>
          })}
          {[0, .25, .5, .75, 1].map((fraction) => (
            <g key={fraction}>
              <line className="scientific-tick" x1={x(fraction)} x2={x(fraction)} y1={bottom} y2={bottom + 4} />
              <text x={x(fraction)} y={bottom + 17} textAnchor="middle">{format.format(window.durationMs * fraction)}</text>
            </g>
          ))}
          <text className="scientific-panel-title" x={left} y={17}>(b) Probe waveforms</text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Displacement (µm)</text>
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 7} textAnchor="middle">Time from trigger (ms)</text>
        </g>
        <g aria-hidden="true">
          <path className="orbit-probe-x" d={valuePath(run.xUm)} />
          <path className="orbit-probe-y" d={valuePath(run.yUm)} />
          <line className="scientific-reference" x1={focusX} x2={focusX} y1={top} y2={bottom} />
          <circle className="orbit-probe-dot-x" cx={focusX} cy={y(displacement[0])} r={3.4} />
          <circle className="orbit-probe-dot-y" cx={focusX} cy={y(displacement[1])} r={3.4} />
        </g>
        <rect className="orbit-waveform-pick" x={left} y={top} width={right - left} height={bottom - top} fill="transparent"
          onClick={(event) => onPick(Math.max(0, Math.min(360, Math.round(relativeClick(event)[0] * 360))))} />
      </svg>
    </div>
  )
}

function ShaftOrbitFigure({ data, label, compact, source, limit }: ShaftOrbitProps & { label: string; limit: number }) {
  const [runId, setRunId] = useState(data.runs[0].id)
  const [selectedRevolution, setRevolution] = useState(0)
  const [phase, setPhase] = useState(0)
  const run = data.runs.find(({ id }) => id === runId) ?? data.runs[0]
  const revolutionCount = run.triggerSamples.length - 1
  const revolution = Math.min(selectedRevolution, revolutionCount - 1)
  const window = revolutionWindow(run, revolution)
  const sample = window.start + (window.end - window.start) * phase / 360
  const displacement = [interpolate(run.xUm, sample), interpolate(run.yUm, sample)] as const
  const rpm = run.sampleRateHz / (window.end - window.start) * 60

  function selectRun(id: string) {
    setRunId(id)
    setRevolution(0)
    setPhase(0)
  }

  return (
    <figure className="shaft-orbit" data-shaft-orbit="" data-compact={compact}>
      {!compact && data.runs.length > 1 && (
        <label className="orbit-scenario">Signal scenario
          <select value={run.id} onChange={(event) => selectRun(event.currentTarget.value)}>
            {data.runs.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.label}</option>)}
          </select>
        </label>
      )}
      <div className="orbit-panels">
        <div className="orbit-plot-group">
          <OrbitPlot run={run} revolution={revolution} window={window} limit={limit} displacement={displacement}
            compact={Boolean(compact)} label={`${label}, ${run.label}, equal displacement scales in micrometres`} onPick={setPhase} />
          {!compact && (
            <ul className="orbit-legend" aria-label="Orbit key">
              {revolutionCount > 1 && <li className="orbit-key-adjacent">Adjacent turns</li>}
              <li className="orbit-key-trigger">Turn trigger</li>
              <li className="orbit-key-sample">Selected sample</li>
            </ul>
          )}
        </div>
        {!compact && (
          <div className="orbit-plot-group">
            <WaveformPlot run={run} window={window} phase={phase} limit={limit} displacement={displacement} onPick={setPhase} />
            <ul className="orbit-legend" aria-label="Probe key">
              <li className="orbit-key-x">X probe</li>
              <li className="orbit-key-y">Y probe</li>
            </ul>
          </div>
        )}
      </div>
      {!compact && (
        <div className="orbit-inspector">
          <output data-orbit-readout="" data-revolution={revolution + 1} data-phase={phase} data-rpm={rpm}
            data-x={displacement[0]} data-y={displacement[1]}>
            <strong>{format.format(rpm)} RPM · {phase}°</strong>
            <span>X {format.format(displacement[0])} µm · Y {format.format(displacement[1])} µm</span>
          </output>
          <div className="orbit-sliders">
            {revolutionCount > 1 && (
              <label>
                <span className="orbit-revolution-label">Revolution <span>{revolution + 1} / {revolutionCount}</span></span>
                <input type="range" min={1} max={revolutionCount} value={revolution + 1}
                  aria-label="Revolution"
                  aria-valuetext={`Revolution ${revolution + 1} of ${revolutionCount}`}
                  onChange={(event) => setRevolution(event.currentTarget.valueAsNumber - 1)} />
              </label>
            )}
            <label>Shaft phase
              <input type="range" min={0} max={360} value={phase}
                aria-valuetext={`${phase} degrees after the trigger`}
                onChange={(event) => setPhase(event.currentTarget.valueAsNumber)} />
            </label>
          </div>
        </div>
      )}
      {!compact && source && (
        <figcaption className="orbit-caption">
          <strong>{source.label}</strong>
          <p>{source.description} <a href={source.href}>Orbit method</a></p>
        </figcaption>
      )}
    </figure>
  )
}

export function ShaftOrbit({ label = 'Shaft displacement orbit', ...props }: ShaftOrbitProps) {
  const limit = useMemo(() => displacementLimit(props.data), [props.data])
  if (limit === null) {
    return <p className="chart-render-message" role="status">Provide paired probe samples, a positive sample rate, and strictly increasing trigger indices.</p>
  }
  return <ShaftOrbitFigure {...props} label={label} limit={limit} />
}
