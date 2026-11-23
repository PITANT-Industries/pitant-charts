import { useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './allan-deviation.css'

export interface AllanDeviationPoint {
  tauSeconds: number
  deviation: number
  pairs?: number
}

export interface AllanDeviationCurve {
  id: string
  label: string
  points: readonly AllanDeviationPoint[]
}

export interface AllanDeviationData {
  quantity: string
  unit?: string
  curves: readonly AllanDeviationCurve[]
}

export interface AllanDeviationProps {
  data: AllanDeviationData
  label?: string
  compact?: boolean
  initialTauSeconds?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Domain = readonly [number, number]
type PlotDomains = { time: Domain; deviation: Domain }

const slopeGuides = [
  { slope: -.5, label: '−½' },
  { slope: 0, label: '0' },
  { slope: .5, label: '+½' },
] as const
const colors = ['#245781', '#983f2c', '#30694e', '#6b4f86']
const dashes = [undefined, '6 3', '2 3', '7 3 2 3']
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const decimal = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const count = new Intl.NumberFormat('en-US')

function powerOfTen(exponent: number) {
  return `10${String(exponent).replace('-', '⁻').replace(/\d/g, (digit) => superscripts[Number(digit)])}`
}

function showNumber(value: number) {
  if (value >= .001 && value < 10000) return decimal.format(value)
  const [coefficient, exponent] = value.toExponential(3).split('e')
  return `${Number(coefficient)} × ${powerOfTen(Number(exponent))}`
}

function plotDomains({ curves }: AllanDeviationData): PlotDomains | null {
  if (!curves.length || new Set(curves.map(({ id }) => id)).size !== curves.length) return null
  let first = Infinity
  let last = -Infinity
  let low = Infinity
  let high = -Infinity
  for (const { points } of curves) {
    if (!points.length) return null
    let previous = 0
    for (const { tauSeconds, deviation, pairs } of points) {
      if (!Number.isFinite(tauSeconds) || tauSeconds <= previous || !Number.isFinite(deviation) || deviation <= 0 ||
          (pairs !== undefined && (!Number.isSafeInteger(pairs) || pairs < 1))) return null
      previous = tauSeconds
      low = Math.min(low, Math.log10(deviation))
      high = Math.max(high, Math.log10(deviation))
    }
    first = Math.min(first, Math.log10(points[0].tauSeconds))
    last = Math.max(last, Math.log10(points[points.length - 1].tauSeconds))
  }
  const bottom = Math.floor(low - .04)
  return {
    time: [Math.floor(first), Math.max(Math.floor(first) + 1, Math.ceil(last))],
    deviation: [bottom, Math.max(bottom + 1, Math.ceil(high + .13))],
  }
}

function ticks([min, max]: Domain, target: number) {
  const stride = Math.max(1, Math.ceil((max - min) / target))
  return Array.from({ length: Math.floor((max - min) / stride) + 1 }, (_, index) => min + index * stride)
}

function minorTicks([min, max]: Domain, available: number) {
  if (available / (max - min) < 32) return []
  return Array.from({ length: max - min }, (_, index) => min + index)
    .flatMap((decade) => [decade + Math.log10(2), decade + Math.log10(5)])
}

function nearestPoint(points: readonly AllanDeviationPoint[], logTau: number) {
  let low = 0
  let high = points.length - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    const midpoint = (Math.log10(points[middle].tauSeconds) + Math.log10(points[middle + 1].tauSeconds)) / 2
    if (logTau <= midpoint) high = middle
    else low = middle + 1
  }
  return low
}

function AllanPlot({ data, domains, selected, activeCurve, label, compact, references, select }: {
  data: AllanDeviationData
  domains: PlotDomains
  selected: AllanDeviationPoint
  activeCurve: AllanDeviationCurve
  label: string
  compact: boolean
  references: boolean
  select: (logTau: number) => void
}) {
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 420 : 720, compact ? 160 : 310)
  const left = width < 355 ? 54 : 64
  const right = Math.max(left + 1, width - 21)
  const top = 15
  const bottom = Math.max(top + 1, height - 43)
  const [first, last] = domains.time
  const [low, high] = domains.deviation
  const x = (logTau: number) => left + (logTau - first) / (last - first) * (right - left)
  const y = (logDeviation: number) => bottom - (logDeviation - low) / (high - low) * (bottom - top)
  const cursorX = x(Math.log10(selected.tauSeconds))
  const cursorY = y(Math.log10(selected.deviation))
  const guideHalfWidth = Math.min(.3, (last - first) / 10, (high - low) / 8)

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    select(first + fraction * (last - first))
  }

  return (
    <div className="allan-plot scientific-plot" ref={plot}>
      <svg role="img" aria-label={`${label}. Overlapping Allan deviation of ${data.quantity} against averaging time on logarithmic axes.`}
        data-allan-plot="" viewBox={`0 0 ${width} ${height}`}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        <g className="scientific-axis" aria-hidden="true">
          {minorTicks(domains.deviation, bottom - top).map((value) => (
            <line className="scientific-tick" key={value} x1={left - 2} x2={left} y1={y(value)} y2={y(value)} />
          ))}
          {minorTicks(domains.time, right - left).map((value) => (
            <line className="scientific-tick" key={value} x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 2} />
          ))}
          {ticks(domains.deviation, Math.max(1, Math.floor((bottom - top) / 20))).map((exponent) => (
            <g key={exponent}>
              <line className="allan-grid" x1={left} x2={right} y1={y(exponent)} y2={y(exponent)} />
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(exponent)} y2={y(exponent)} />
              <text x={left - 8} y={y(exponent) + 4} textAnchor="end">{powerOfTen(exponent)}</text>
            </g>
          ))}
          {ticks(domains.time, Math.max(1, Math.floor((right - left) / 35))).map((exponent) => (
            <g key={exponent}>
              <line className="allan-grid" x1={x(exponent)} x2={x(exponent)} y1={top} y2={bottom} />
              <line className="scientific-tick" x1={x(exponent)} x2={x(exponent)} y1={bottom} y2={bottom + 4} />
              <text x={x(exponent)} y={bottom + 17} textAnchor="middle">{powerOfTen(exponent)}</text>
            </g>
          ))}
          <rect className="scientific-frame" data-allan-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text textAnchor="middle" className="scientific-axis-label allan-y-label" transform={`translate(14 ${(top + bottom) / 2}) rotate(-90)`}>
            {compact ? 'Allan deviation' : 'Overlapping Allan deviation'}, σᵧ(τ){data.unit ? ` (${data.unit})` : ''}
          </text>
          <text textAnchor="middle" className="scientific-axis-label" x={(left + right) / 2} y={height - 6}>Averaging time, τ (s)</text>
        </g>
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {data.curves.map((curve, curveIndex) => (
            <g key={curve.id} stroke={colors[curveIndex % colors.length]}>
              <path className="allan-trace" data-allan-trace="" data-curve={curve.id} strokeDasharray={dashes[curveIndex % dashes.length]}
                d={curve.points.map(({ tauSeconds, deviation }, index) => `${index ? 'L' : 'M'}${x(Math.log10(tauSeconds)).toFixed(2)} ${y(Math.log10(deviation)).toFixed(2)}`).join(' ')} />
              {curve.points.map(({ tauSeconds, deviation, pairs }) => (
                <circle key={tauSeconds} className="allan-point" data-allan-point="" data-curve={curve.id}
                  data-tau={tauSeconds} data-deviation={deviation} data-pairs={pairs}
                  cx={x(Math.log10(tauSeconds))} cy={y(Math.log10(deviation))} r={compact ? 1.7 : 2} />
              ))}
            </g>
          ))}
          {!compact && <line className="allan-cursor-line" x1={cursorX} x2={cursorX} y1={cursorY} y2={bottom} />}
        </g>
        {references && !compact && slopeGuides.map(({ slope, label: slopeLabel }, index) => {
          const center = first + (last - first) * (.52 + .18 * index)
          const anchor = high - (high - low) * .17
          return (
            <g className="allan-slope" aria-hidden="true" key={slope}>
              <line data-allan-reference="" data-slope={slope} className="scientific-reference"
                x1={x(center - guideHalfWidth)} x2={x(center + guideHalfWidth)}
                y1={y(anchor - slope * guideHalfWidth)} y2={y(anchor + slope * guideHalfWidth)} />
              <text x={x(center)} y={y(anchor + Math.abs(slope) * guideHalfWidth) - 4} textAnchor="middle">{slopeLabel}</text>
            </g>
          )
        })}
        {!compact && (
          <>
            <circle className="allan-cursor" data-allan-cursor="" data-curve={activeCurve.id} cx={cursorX} cy={cursorY} r={4} aria-hidden="true" />
            <rect className="allan-plot-pick" x={left} y={top} width={right - left} height={bottom - top}
              fill="transparent" onClick={choose} />
          </>
        )}
      </svg>
    </div>
  )
}

function AllanFigure({ data, domains, label, compact = false, initialTauSeconds, source }:
  AllanDeviationProps & { domains: PlotDomains; label: string }) {
  const [curveId, setCurveId] = useState(data.curves[0].id)
  const curve = data.curves.find(({ id }) => id === curveId) ?? data.curves[0]
  const [logTau, setLogTau] = useState(() => initialTauSeconds && Number.isFinite(initialTauSeconds) && initialTauSeconds > 0
    ? Math.log10(initialTauSeconds)
    : Math.log10(curve.points.reduce((minimum, point) => point.deviation < minimum.deviation ? point : minimum).tauSeconds))
  const [references, setReferences] = useState(true)
  const index = nearestPoint(curve.points, logTau)
  const point = curve.points[index]
  const pointTime = `${showNumber(point.tauSeconds)} s`

  return (
    <figure className="allan-deviation" data-allan-deviation="" data-compact={compact}>
      <AllanPlot data={data} domains={domains} selected={point} activeCurve={curve}
        label={label} compact={compact} references={references} select={setLogTau} />
      {!compact && (
        <>
          <ul className="allan-key" aria-label="Recording key">
            {data.curves.map(({ id, label: curveLabel }, index) => (
              <li key={id}>
                <svg aria-hidden="true" width="24" height="12" viewBox="0 0 24 12">
                  <path d="M1 6H23" stroke={colors[index % colors.length]} strokeWidth="1.5" strokeDasharray={dashes[index % dashes.length]} />
                  <circle cx="12" cy="6" r="2" fill="#fff" stroke={colors[index % colors.length]} />
                </svg>
                {curveLabel}
              </li>
            ))}
          </ul>
          <div className="allan-controls">
            <label className="allan-reference-choice"><input type="checkbox" checked={references} onChange={(event) => setReferences(event.currentTarget.checked)} />Show reference slopes</label>
            {data.curves.length > 1 && (
              <label className="allan-recording">Recording
                <select value={curve.id} onChange={(event) => setCurveId(event.currentTarget.value)}>
                  {data.curves.map(({ id, label: recording }) => <option key={id} value={id}>{recording}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className="allan-scrub">Averaging time
            <input type="range" min={0} max={curve.points.length - 1} step={1} value={index} aria-valuetext={pointTime}
              disabled={curve.points.length === 1} onChange={(event) => setLogTau(Math.log10(curve.points[Number(event.currentTarget.value)].tauSeconds))} />
          </label>
          <output className="allan-readout" data-allan-readout="" data-tau={point.tauSeconds} data-deviation={point.deviation} data-pairs={point.pairs}>
            <span>Averaging time <strong>{pointTime}</strong></span>
            <span>Allan deviation <strong>{showNumber(point.deviation)}{data.unit ? ` ${data.unit}` : ''}</strong></span>
            {point.pairs !== undefined && <span>Overlapping pairs <strong>{count.format(point.pairs)}</strong></span>}
          </output>
          {source && (
            <figcaption className="allan-caption">
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

export function AllanDeviation({ data, label = 'Allan deviation', ...props }: AllanDeviationProps) {
  const domains = useMemo(() => plotDomains(data), [data])
  if (!domains) return <p className="chart-render-message" role="status">Provide positive deviation values and increasing positive averaging times for each recording.</p>
  return <AllanFigure {...props} data={data} domains={domains} label={label} />
}
