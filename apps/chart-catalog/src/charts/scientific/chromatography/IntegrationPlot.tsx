import { useId, useState } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { chromatogramSignalAt } from './model'
import type { ChromatogramPeak, ChromatogramSample, IntegratedChromatogramPeak, PreparedChromatogramData } from './model'

export type IntegratedPeak = { peak: ChromatogramPeak; result: IntegratedChromatogramPeak }
export type IntegrationHandle = 'start' | 'end' | 'baseline-start' | 'baseline-end'
type Domain = readonly [number, number]
type Bounds = { time: Domain; signal: Domain }
type EditGesture = { handle: IntegrationHandle; bounds: Bounds }

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const largeSignal = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function ticks([min, max]: Domain, divisions: number) {
  const approximate = (max - min) / divisions
  const power = 10 ** Math.floor(Math.log10(approximate))
  const step = power * ([1, 2, 2.5, 5, 10].find((value) => power * value >= approximate) ?? 10)
  const first = Math.ceil(min / step)
  const count = Math.min(12, Math.max(0, Math.floor(max / step) - first + 1))
  return Array.from({ length: count }, (_, index) => Number(((first + index) * step).toPrecision(12)))
}

function localTrace(samples: readonly ChromatogramSample[], [first, last]: Domain) {
  const start = chromatogramSignalAt(samples, first)
  const end = chromatogramSignalAt(samples, last)
  const visible = samples.filter(([time]) => time > first && time < last)
  return start === undefined || end === undefined ? visible : [[first, start] as const, ...visible, [last, end] as const]
}

function plotBounds(data: PreparedChromatogramData, regions: readonly IntegratedPeak[], focus?: IntegratedPeak): Bounds {
  const interval = focus ? focus.peak.end - focus.peak.start : 0
  const time: Domain = focus
    ? [Math.max(data.timeBounds[0], focus.peak.start - interval * .28), Math.min(data.timeBounds[1], focus.peak.end + interval * .28)]
    : data.timeBounds
  const trace = focus ? localTrace(data.samples, time) : data.samples
  let [min, max] = focus ? [Infinity, -Infinity] : data.signalBounds
  if (focus) {
    for (const [, signal] of trace) {
      min = Math.min(min, signal)
      max = Math.max(max, signal)
    }
  }
  for (const { result } of regions) {
    min = Math.min(min, ...result.baseline)
    max = Math.max(max, ...result.baseline)
  }
  const span = max - min || Math.max(Math.abs(max) * .1, .01)
  return { time, signal: [min - span * .1, max + span * .17] }
}

export function IntegrationPlot({ data, regions, active, compact, editing = false, onSelect, onEdit }: {
  data: PreparedChromatogramData
  regions: readonly IntegratedPeak[]
  active?: IntegratedPeak
  compact: boolean
  editing?: boolean
  onSelect?: (id: string) => void
  onEdit?: (handle: IntegrationHandle, value: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(720, compact ? 200 : 255)
  const [gesture, setGesture] = useState<EditGesture>()
  const clip = useId()
  const hatch = useId()
  const focus = editing ? active : undefined
  const visibleRegions = focus ? [focus] : regions
  const bounds = gesture?.bounds ?? plotBounds(data, visibleRegions, focus)
  const trace = focus ? localTrace(data.samples, bounds.time) : data.samples
  const margin = compact ? { top: 8, right: 10, bottom: 9, left: 8 } : { top: editing ? 24 : 16, right: 17, bottom: 43, left: 60 }
  const frame = { top: margin.top, right: Math.max(margin.left + 1, width - margin.right), bottom: Math.max(margin.top + 1, height - margin.bottom), left: margin.left }
  const plotWidth = frame.right - frame.left
  const plotHeight = frame.bottom - frame.top
  const deltaTime = bounds.time[1] - bounds.time[0]
  const deltaSignal = bounds.signal[1] - bounds.signal[0]
  const xAt = (time: number) => frame.left + (time - bounds.time[0]) / deltaTime * plotWidth
  const yAt = (signal: number) => frame.bottom - (signal - bounds.signal[0]) / deltaSignal * plotHeight
  const path = (points: readonly ChromatogramSample[]) => points.map(([time, signal], i) => `${i ? 'L' : 'M'}${xAt(time)} ${yAt(signal)}`).join('')

  function startEdit(event: PointerEvent<SVGGElement>, handle: IntegrationHandle) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setGesture({ handle, bounds })
  }

  function drag(event: PointerEvent<SVGGElement>) {
    if (!gesture || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const proportion = (value: number) => Math.max(0, Math.min(1, value))
    const value = gesture.handle.startsWith('baseline')
      ? bounds.signal[0] + proportion((frame.bottom - point.y) / plotHeight) * deltaSignal
      : bounds.time[0] + proportion((point.x - frame.left) / plotWidth) * deltaTime
    onEdit?.(gesture.handle, value)
  }

  return <div ref={plot} className={`scientific-plot chromatogram-plot ${editing ? 'chromatogram-plot-editor' : ''}`}>
    <svg data-peak-overview={editing ? undefined : ''} data-peak-editor={editing ? '' : undefined}
      data-time-min={bounds.time[0]} data-time-max={bounds.time[1]} data-signal-min={bounds.signal[0]} data-signal-max={bounds.signal[1]}
      data-plot-left={frame.left} data-plot-right={frame.right} data-plot-top={frame.top} data-plot-bottom={frame.bottom}
      viewBox={`0 0 ${width} ${height}`} role="img" aria-label={editing ? 'Selected integration region with editable time boundaries and baseline' : 'Chromatogram with integrated peak regions'}>
      <defs>
        <clipPath id={clip}><rect x={frame.left} y={frame.top} width={plotWidth} height={plotHeight} /></clipPath>
        <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V4" className="chromatogram-deficit-hatch" />
        </pattern>
      </defs>
      <g className="scientific-axis" aria-hidden="true">
        <path className="scientific-tick" fill="none" d={`M${frame.left} ${frame.top}V${frame.bottom}H${frame.right}`} />
        {!compact && <>
          {ticks(bounds.time, width < 390 ? 4 : 7).map((time) => <g key={time}>
            <line x1={xAt(time)} x2={xAt(time)} y1={frame.bottom} y2={frame.bottom + 4} className="scientific-tick" />
            <text x={xAt(time)} y={frame.bottom + 17} textAnchor="middle">{number.format(time)}</text>
          </g>)}
          {ticks(bounds.signal, 5).map((signal) => <g key={signal}>
            <line x1={frame.left} x2={frame.right} y1={yAt(signal)} y2={yAt(signal)} className="chromatogram-guide-line" />
            <line x1={frame.left - 4} x2={frame.left} y1={yAt(signal)} y2={yAt(signal)} className="scientific-tick" />
            <text x={frame.left - 7} y={yAt(signal)} textAnchor="end" dominantBaseline="middle">{(Math.abs(signal) >= 10_000 ? largeSignal : number).format(signal)}</text>
          </g>)}
          <text className="scientific-axis-label" x={(frame.left + frame.right) / 2} y={height - 5} textAnchor="middle">Retention time ({data.timeUnit})</text>
          <text className="scientific-axis-label" transform={`translate(12 ${(frame.top + frame.bottom) / 2}) rotate(-90)`}
            textAnchor="middle">Detector response ({data.signalUnit})</text>
        </>}
      </g>
      <g clipPath={`url(#${clip})`}>
        {visibleRegions.map(({ peak, result }) => <g key={peak.id} data-integrated-peak={peak.id} data-active={peak.id === active?.peak.id}
          onClick={editing || compact ? undefined : () => onSelect?.(peak.id)}>
          {result.segments.map(({ points, sign }, index) => <path data-peak-area={sign} key={index} d={`${path(points)}Z`}
            fill={sign === 'below' ? `url(#${hatch})` : undefined} className={`chromatogram-area chromatogram-area-${sign}`} />)}
          <line data-peak-baseline={peak.id} x1={xAt(peak.start)} x2={xAt(peak.end)} y1={yAt(result.baseline[0])} y2={yAt(result.baseline[1])}
            className="chromatogram-baseline" />
          {!editing && !compact && <circle data-peak-select={peak.id} className="chromatogram-peak-select" r={4.4}
            cx={xAt(result.apex.time)} cy={yAt(result.apex.signal)} />}
        </g>)}
        <path data-chromatogram-signal className="chromatogram-signal" d={path(trace)} />
        {focus && <>
          {[focus.peak.start, focus.peak.end].map((time, i) => <line data-peak-boundary={i === 0 ? 'start' : 'end'} key={i}
            x1={xAt(time)} x2={xAt(time)} y1={frame.top} y2={frame.bottom} className="chromatogram-boundary" />)}
          <circle data-peak-apex cx={xAt(focus.result.apex.time)} cy={yAt(focus.result.apex.signal)} r={3.4} className="chromatogram-apex" />
        </>}
      </g>
      {focus && ([['start', focus.peak.start, null], ['end', focus.peak.end, null],
        ['baseline-start', focus.peak.start, focus.result.baseline[0]], ['baseline-end', focus.peak.end, focus.result.baseline[1]]] as const)
        .map(([handle, time, signal]) => <g key={handle} data-peak-handle={handle} className="chromatogram-handle"
          data-kind={signal === null ? 'time' : 'baseline'} transform={`translate(${xAt(time)} ${signal === null ? frame.top : yAt(signal)})`}
          onPointerDown={(event) => startEdit(event, handle)} onPointerMove={drag}
          onLostPointerCapture={() => setGesture(undefined)} aria-hidden="true">
          <circle r={10} fill="transparent" />
          {signal === null ? <rect className="chromatogram-time-grip" x={-4} y={-6} width={8} height={12} rx={1.4} />
            : <path className="chromatogram-baseline-grip" d="M0 -5L5 0L0 5L-5 0Z" />}
        </g>)}
    </svg>
  </div>
}
