import { useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import '../scientific-figure.css'
import './eye-diagram.css'

type Bit = 0 | 1
type Range = readonly [number, number]

export interface EyeTrace {
  previousBit: Bit
  bit: Bit
  voltageMv: readonly number[]
}

export interface EyeRun {
  id: string
  label: string
  levelsMv: Range
  traces: readonly EyeTrace[]
}

export interface EyeDiagramData {
  timeUi: readonly number[]
  symbolRateBaud: number
  runs: readonly EyeRun[]
}

export interface EyeDiagramProps {
  data: EyeDiagramData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string }
}

type RunMetrics = { jitterUi: number | null; crossingSpanUi: Range | null; overshootPercent: number }
type EyeDomains = { time: Range; voltage: Range }

const timeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const valueFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function eyeDomains(data: EyeDiagramData): EyeDomains | null {
  const { timeUi, symbolRateBaud, runs } = data
  if (!Number.isFinite(symbolRateBaud) || !(symbolRateBaud > 0) || !runs.length ||
      new Set(runs.map(({ id }) => id)).size !== runs.length) return null
  const first = timeUi[0]
  const last = timeUi[timeUi.length - 1]
  if (timeUi.length < 2 || first > 0 || last < 1 || !Number.isFinite(last - first) ||
      !timeUi.every((value, index) => Number.isFinite(value) && (index === 0 || value > timeUi[index - 1]))) return null

  let low = Infinity
  let high = -Infinity
  for (const { levelsMv: [lowRail, highRail], traces } of runs) {
    if (!Number.isFinite(highRail - lowRail) || lowRail >= highRail ||
        !traces.some(({ bit }) => bit === 0) || !traces.some(({ bit }) => bit === 1)) return null
    low = Math.min(low, lowRail)
    high = Math.max(high, highRail)
    for (const { previousBit, bit, voltageMv } of traces) {
      if ((previousBit !== 0 && previousBit !== 1) || (bit !== 0 && bit !== 1) || voltageMv.length !== timeUi.length) return null
      for (const voltage of voltageMv) {
        if (!Number.isFinite(voltage)) return null
        low = Math.min(low, voltage)
        high = Math.max(high, voltage)
      }
    }
  }
  const pad = (high - low) * .08
  if (!Number.isFinite(high - low + pad * 2)) return null
  return { time: [first, last], voltage: [low - pad, high + pad] }
}

function quantile(values: readonly number[], fraction: number) {
  const rank = (values.length - 1) * fraction
  const first = Math.floor(rank)
  return values[first] + (values[Math.ceil(rank)] - values[first]) * (rank - first)
}

function leftIndex(values: readonly number[], value: number) {
  let low = 0
  let high = values.length - 1
  while (high > low + 1) {
    const middle = (low + high) >>> 1
    if (values[middle] <= value) low = middle
    else high = middle
  }
  return low
}

function voltageQuantiles(run: EyeRun, time: readonly number[], phase: number): Range {
  const left = leftIndex(time, phase)
  const weight = (phase - time[left]) / (time[left + 1] - time[left])
  const lows: number[] = []
  const highs: number[] = []
  for (const trace of run.traces) {
    const voltage = trace.voltageMv[left] * (1 - weight) + trace.voltageMv[left + 1] * weight
    const measurements = trace.bit ? highs : lows
    measurements.push(voltage)
  }
  lows.sort((a, b) => a - b)
  highs.sort((a, b) => a - b)
  return [quantile(lows, .95), quantile(highs, .05)]
}

function crossingBetween(trace: EyeTrace, time: readonly number[], threshold: number) {
  if (trace.previousBit === trace.bit) return undefined
  const limit = .35
  let crossing: number | undefined
  for (let index = leftIndex(time, -limit); index + 1 < time.length && time[index] <= limit; index++) {
    const before = trace.voltageMv[index]
    const after = trace.voltageMv[index + 1]
    const crosses = trace.bit ? before < threshold && after >= threshold : before > threshold && after <= threshold
    if (!crosses) continue
    const at = time[index] + (time[index + 1] - time[index]) * (threshold - before) / (after - before)
    if (Math.abs(at) <= limit && (crossing === undefined || Math.abs(at) < Math.abs(crossing))) crossing = at
  }
  return crossing
}

function metricsFor(run: EyeRun, time: readonly number[]): RunMetrics {
  const [low, high] = run.levelsMv
  const threshold = low + (high - low) / 2
  const crossings: number[] = []
  let excursion = 0
  for (const trace of run.traces) {
    const crossing = crossingBetween(trace, time, threshold)
    if (crossing !== undefined) crossings.push(crossing)
    for (const voltage of trace.voltageMv) excursion = Math.max(excursion, voltage - high, low - voltage)
  }
  const overshootPercent = excursion / (high - low) * 100
  if (crossings.length < 2) return { jitterUi: null, crossingSpanUi: null, overshootPercent }
  const average = crossings.reduce((sum, value) => sum + value, 0) / crossings.length
  const jitterUi = Math.sqrt(crossings.reduce((sum, value) => sum + (value - average) ** 2, 0) / crossings.length)
  crossings.sort((a, b) => a - b)
  return { jitterUi, crossingSpanUi: [quantile(crossings, .05), quantile(crossings, .95)], overshootPercent }
}

function axisTicks([min, max]: Range, target: number) {
  const range = (max - min) / target
  const base = 10 ** Math.floor(Math.log10(range))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= range) ?? 10)
  if (!(step > 0) || !Number.isFinite(step)) return [min, max]
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  const count = Math.min(10, last - first + 1)
  return count > 1 ? Array.from({ length: count }, (_, index) => (first + index) * step) : [min, max]
}

function EyePlot({ run, timeUi, domains, phase, opening, crossings, compact, label, selectPhase }: {
  run: EyeRun
  timeUi: readonly number[]
  domains: EyeDomains
  phase: number
  opening: Range
  crossings: Range | null
  compact: boolean
  label: string
  selectPhase: (value: number) => void
}) {
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 450 : 750, 310)
  const left = width < 375 ? 52 : 62
  const right = Math.max(left + 1, width - 22)
  const top = 25
  const bottom = Math.max(top + 1, height - 41)
  const [firstTime, lastTime] = domains.time
  const [lowVoltage, highVoltage] = domains.voltage
  const x = (time: number) => left + (time - firstTime) / (lastTime - firstTime) * (right - left)
  const y = (voltage: number) => bottom - (voltage - lowVoltage) / (highVoltage - lowVoltage) * (bottom - top)
  const [lowRail, highRail] = run.levelsMv
  const threshold = lowRail + (highRail - lowRail) / 2
  const cursor = x(phase)
  const traceOpacity = Math.max(.03, Math.min(.26, 13 / run.traces.length))
  const paths = useMemo(() => {
    const xPoints = timeUi.map((time) => left + (time - firstTime) / (lastTime - firstTime) * (right - left))
    const span = highVoltage - lowVoltage
    return run.traces.map(({ voltageMv }) => voltageMv.map((voltage, index) =>
      `${index ? 'L' : 'M'}${xPoints[index].toFixed(2)} ${(bottom - (voltage - lowVoltage) / span * (bottom - top)).toFixed(2)}`).join(' '))
  }, [run, timeUi, left, right, top, bottom, firstTime, lastTime, lowVoltage, highVoltage])

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    selectPhase(Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 100) / 100)
  }

  return (
    <div className="eye-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-eye-plot="" aria-label={`${label}, ${run.label}`}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-eye-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={15}>{compact ? run.label : 'Clock-aligned voltage traces'}</text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`}
            textAnchor="middle">Voltage (mV)</text>
          {axisTicks(domains.voltage, 4).map((level) => (
            <g key={level}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(level)} y2={y(level)} />
              <text x={left - 8} y={y(level) + 4} textAnchor="end">{valueFormat.format(level)}</text>
            </g>
          ))}
          {axisTicks(domains.time, 4).map((time) => (
            <g key={time}>
              <line className="scientific-tick" x1={x(time)} x2={x(time)} y1={bottom} y2={bottom + 4} />
              <text x={x(time)} y={bottom + 17} textAnchor="middle">{timeFormat.format(time)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Time (UI)</text>
        </g>
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          <line className="eye-threshold scientific-reference" x1={left} x2={right} y1={y(threshold)} y2={y(threshold)} />
          {paths.map((path, index) => (
            <path key={index} className="eye-trace" data-eye-trace="" d={path} opacity={traceOpacity} />
          ))}
          {!compact && (
            <>
              <line className="scientific-reference eye-sampling-line" data-eye-sampling-line=""
                x1={cursor} x2={cursor} y1={top} y2={bottom} />
              {opening[1] > opening[0] && (
                <path className="eye-opening" data-eye-opening=""
                  d={`M${cursor - 5} ${y(opening[0])} h10 m-5 0 V${y(opening[1])} m-5 0 h10`} />
              )}
              {crossings && (
                <path className="eye-crossing-spread"
                  d={`M${x(crossings[0])} ${y(threshold) - 4} v8 m0 -4 H${x(crossings[1])} m0 -4 v8`} />
              )}
            </>
          )}
        </g>
        {!compact && (
          <rect className="eye-plot-pick" x={x(0)} y={top} width={x(1) - x(0)} height={bottom - top}
            fill="transparent" onClick={choose} />
        )}
      </svg>
    </div>
  )
}

function EyeFigure({ data, domains, label, compact = false, source }: EyeDiagramProps & { domains: EyeDomains; label: string }) {
  const [runId, setRunId] = useState(data.runs[0].id)
  const [phase, setPhase] = useState(.5)
  const run = data.runs.find(({ id }) => id === runId) ?? data.runs[0]
  const metrics = useMemo(() => metricsFor(run, data.timeUi), [run, data.timeUi])
  const opening = voltageQuantiles(run, data.timeUi, phase)
  const eyeHeightMv = opening[1] - opening[0]
  const jitterPs = metrics.jitterUi === null ? null : metrics.jitterUi / data.symbolRateBaud * 1e12

  return (
    <figure className="digital-eye" data-eye-diagram="" data-compact={compact}>
      {!compact && data.runs.length > 1 && (
        <label className="eye-channel">Channel
          <select value={run.id} onChange={(event) => setRunId(event.currentTarget.value)}>
            {data.runs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      )}
      <EyePlot run={run} timeUi={data.timeUi} domains={domains} phase={phase} opening={opening} crossings={metrics.crossingSpanUi}
        compact={compact} label={label} selectPhase={setPhase} />
      {!compact && (
        <>
          <ul className="eye-legend" aria-label="Figure key">
            <li>Decision threshold</li>
            {eyeHeightMv > 0 && <li className="eye-key-opening">Eye height</li>}
            {metrics.crossingSpanUi && <li className="eye-key-crossings">5–95% crossing span</li>}
          </ul>
          <div className="eye-inspect">
            <output data-eye-readout="" data-phase={phase} data-height-mv={eyeHeightMv}
              data-jitter-ui={metrics.jitterUi ?? ''} data-overshoot-percent={metrics.overshootPercent}>
              <span>Eye height <strong>{valueFormat.format(eyeHeightMv)} mV</strong></span>
              <span>Crossing jitter (RMS) <strong>{jitterPs === null ? '—' : `${valueFormat.format(jitterPs)} ps`}</strong></span>
              <span>Overshoot <strong>{valueFormat.format(metrics.overshootPercent)}%</strong></span>
            </output>
            <label>
              <span>Sampling phase <span>{phase.toFixed(2)} UI</span></span>
              <input type="range" min={0} max={1} step={.01} value={phase} aria-label="Sampling phase"
                aria-valuetext={`${phase.toFixed(2)} unit intervals`}
                onChange={(event) => setPhase(event.currentTarget.valueAsNumber)} />
            </label>
          </div>
          {source && (
            <figcaption className="eye-caption">
              <strong>{source.label}</strong>
              <p>{source.description} <a href={source.href}>Eye diagram methods</a></p>
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function EyeDiagram({ data, label = 'Digital eye diagram', ...props }: EyeDiagramProps) {
  const domains = useMemo(() => eyeDomains(data), [data])
  if (!domains) {
    return <p className="chart-render-message" role="status">Provide clock-aligned traces with both bit values, nominal voltage levels, and a positive symbol rate.</p>
  }
  return <EyeFigure {...props} data={data} label={label} domains={domains} />
}
