import { useId, useMemo, useState } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './crack-growth.css'

type Domain = readonly [number, number]

export interface CrackGrowthPoint {
  deltaK: number
  rateMmPerCycle: number
}

export interface CrackGrowthSeries {
  id: string
  label: string
  stressRatio?: number
  points: readonly CrackGrowthPoint[]
  fitRange?: Domain
}

export interface CrackGrowthData {
  series: readonly CrackGrowthSeries[]
}

export interface CrackGrowthProps {
  data: CrackGrowthData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Fit = { exponent: number; logCoefficient: number; coefficient: number; rSquared: number | null; count: number }
const precision = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function powerOfTen(exponent: number) {
  return `10${String(exponent).replace('-', '⁻').replace(/\d/g, (digit) => superscripts[Number(digit)])}`
}

function scientific(value: number) {
  const [coefficient, exponent] = value.toExponential(3).split('e')
  return `${Number(coefficient)} × ${powerOfTen(Number(exponent))}`
}

function analyse({ series }: CrackGrowthData) {
  if (!series.length || new Set(series.map(({ id }) => id)).size !== series.length) return null
  let lowK = Infinity
  let highK = -Infinity
  let lowRate = Infinity
  let highRate = -Infinity
  for (const { points, fitRange, stressRatio } of series) {
    if (points.length < 3 || points[0].deltaK === points[points.length - 1].deltaK ||
      (stressRatio !== undefined && !Number.isFinite(stressRatio)) ||
      (fitRange && (!Number.isFinite(fitRange[1] - fitRange[0]) || fitRange[0] <= 0 || fitRange[1] <= fitRange[0]))) return null
    for (const [index, { deltaK, rateMmPerCycle }] of points.entries()) {
      if (!Number.isFinite(deltaK) || deltaK <= 0 || !Number.isFinite(rateMmPerCycle) || rateMmPerCycle <= 0 ||
        (index > 0 && deltaK < points[index - 1].deltaK)) return null
      lowK = Math.min(lowK, Math.log10(deltaK))
      highK = Math.max(highK, Math.log10(deltaK))
      lowRate = Math.min(lowRate, Math.log10(rateMmPerCycle))
      highRate = Math.max(highRate, Math.log10(rateMmPerCycle))
    }
  }
  const padK = Math.max(.022, (highK - lowK) * .09)
  const padRate = Math.max(.06, (highRate - lowRate) * .08)
  return { deltaK: [lowK - padK, highK + padK] as const, rate: [lowRate - padRate, highRate + padRate] as const }
}

function preferredBounds({ points, fitRange }: CrackGrowthSeries): Domain {
  if (fitRange) {
    const first = points.findIndex(({ deltaK }) => deltaK >= fitRange[0])
    const next = points.findIndex(({ deltaK }) => deltaK > fitRange[1])
    const last = next === -1 ? points.length - 1 : next - 1
    if (first >= 0 && last - first >= 2 && points[first].deltaK < points[last].deltaK) return [first, last]
  }
  return [0, points.length - 1]
}

function regression(points: readonly CrackGrowthPoint[], [first, last]: Domain): Fit | null {
  const values = points.slice(first, last + 1).map(({ deltaK, rateMmPerCycle }) => [Math.log10(deltaK), Math.log10(rateMmPerCycle)])
  const count = values.length
  const meanX = values.reduce((sum, [x]) => sum + x, 0) / count
  const meanY = values.reduce((sum, [, y]) => sum + y, 0) / count
  let xx = 0
  let xy = 0
  let yy = 0
  for (const [x, y] of values) {
    xx += (x - meanX) ** 2
    xy += (x - meanX) * (y - meanY)
    yy += (y - meanY) ** 2
  }
  if (count < 3 || xx === 0) return null
  const exponent = xy / xx
  const logCoefficient = meanY - exponent * meanX
  const coefficient = 10 ** logCoefficient
  if (!Number.isFinite(exponent) || !Number.isFinite(coefficient) || coefficient === 0) return null
  return { coefficient, logCoefficient, exponent, count, rSquared: yy ? Math.max(0, Math.min(1, (xy / xx) * (xy / yy))) : null }
}

function xTicks([min, max]: Domain, width: number) {
  const steps = max - min < 1 ? [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8] : [1, 2, 5]
  const ticks: number[] = []
  let previous = -Infinity
  for (let decade = Math.floor(min); decade <= Math.floor(max); decade++) {
    for (const multiple of steps) {
      const value = decade + Math.log10(multiple)
      if (value >= min && value <= max && (value - previous) / (max - min) * width >= 34) {
        ticks.push(value)
        previous = value
      }
    }
  }
  return ticks.length >= 2 ? ticks : [min, max]
}

function yTicks([min, max]: Domain, height: number) {
  const step = Math.max(1, Math.ceil((max - min) / Math.max(2, Math.floor(height / 34))))
  const ticks: number[] = []
  for (let exponent = Math.ceil(min); exponent <= max; exponent += step) ticks.push(exponent)
  return ticks.length >= 2 ? ticks : [min, (min + max) / 2, max]
}

function CrackPlot({ domains, specimen, bounds, fit, selected, compact, label, choose }: {
  domains: NonNullable<ReturnType<typeof analyse>>
  specimen: CrackGrowthSeries
  bounds: Domain
  fit: Fit | null
  selected: number
  compact: boolean
  label: string
  choose: (index: number) => void
}) {
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 425 : 770, compact ? 173 : 355)
  const left = width < 355 ? 57 : 69
  const right = Math.max(left + 1, width - 24)
  const top = 16
  const bottom = Math.max(top + 1, height - 44)
  const x = (logK: number) => left + (logK - domains.deltaK[0]) / (domains.deltaK[1] - domains.deltaK[0]) * (right - left)
  const y = (logRate: number) => bottom - (logRate - domains.rate[0]) / (domains.rate[1] - domains.rate[0]) * (bottom - top)
  const [first, last] = bounds
  const from = specimen.points[first].deltaK
  const through = specimen.points[last].deltaK
  const firstLog = Math.log10(from)
  const lastLog = Math.log10(through)
  const x1 = x(firstLog)
  const x2 = x(lastLog)
  const active = specimen.points[selected]
  const selectedX = x(Math.log10(active.deltaK))
  const selectedY = y(Math.log10(active.rateMmPerCycle))

  return (
    <div className="crack-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-crack-plot=""
        aria-label={`${label}. ${specimen.label}, crack-growth rate against stress-intensity range on logarithmic axes.`}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        {fit && <rect className="crack-fit-region" x={x1} y={top} width={x2 - x1} height={bottom - top} aria-hidden="true" />}
        <g className="scientific-axis" aria-hidden="true">
          {xTicks(domains.deltaK, right - left).map((value) => (
            <g key={value}>
              <line className="crack-grid" x1={x(value)} x2={x(value)} y1={top} y2={bottom} />
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{precision.format(10 ** value)}</text>
            </g>
          ))}
          {yTicks(domains.rate, bottom - top).map((value) => (
            <g key={value}>
              <line className="crack-grid" x1={left} x2={right} y1={y(value)} y2={y(value)} />
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">
                {Number.isInteger(value) ? powerOfTen(value) : scientific(10 ** value)}
              </text>
            </g>
          ))}
          <rect className="scientific-frame" data-crack-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">
            {compact ? 'ΔK (MPa√m)' : 'Stress-intensity range, ΔK (MPa√m)'}
          </text>
          <text className="scientific-axis-label" textAnchor="middle" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`}>
            {compact ? 'da/dN (mm/cycle)' : 'Crack-growth rate, da/dN (mm/cycle)'}
          </text>
        </g>
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {fit && (
            <>
              <line className="scientific-reference" data-crack-fit-start="" x1={x1} x2={x1} y1={top} y2={bottom} />
              <line className="scientific-reference" data-crack-fit-end="" x1={x2} x2={x2} y1={top} y2={bottom} />
              <path className="crack-fit" data-crack-fit="" data-from={from} data-through={through}
                d={`M${x1} ${y(fit.logCoefficient + fit.exponent * firstLog)}L${x2} ${y(fit.logCoefficient + fit.exponent * lastLog)}`} />
            </>
          )}
          {specimen.points.map(({ deltaK, rateMmPerCycle }, index) => (
            <circle key={index} className="crack-point" data-crack-point="" data-index={index}
              data-delta-k={deltaK} data-rate={rateMmPerCycle} data-in-fit={Boolean(fit && index >= first && index <= last)}
              cx={x(Math.log10(deltaK))} cy={y(Math.log10(rateMmPerCycle))} r={compact ? 2 : 3}
              onClick={compact ? undefined : () => choose(index)} />
          ))}
          {!compact && <circle className="crack-cursor" data-crack-cursor="" data-index={selected} cx={selectedX} cy={selectedY} r={6} />}
        </g>
      </svg>
    </div>
  )
}

function CrackFigure({ data, domains, label, compact = false, source }: CrackGrowthProps & {
  domains: NonNullable<ReturnType<typeof analyse>>
  label: string
}) {
  const [seriesId, setSeriesId] = useState(data.series[0].id)
  const specimen = data.series.find(({ id }) => id === seriesId) ?? data.series[0]
  const [custom, setCustom] = useState<{ series: CrackGrowthSeries; bounds: Domain }>()
  const bounds = custom?.series === specimen ? custom.bounds : preferredBounds(specimen)
  const [selection, select] = useState<{ series: CrackGrowthSeries; index: number }>()
  const active = selection?.series === specimen ? selection.index : Math.round((bounds[0] + bounds[1]) / 2)
  const point = specimen.points[active]
  const fit = useMemo(() => regression(specimen.points, bounds), [specimen, bounds[0], bounds[1]])
  const options = specimen.points.map(({ deltaK, rateMmPerCycle }, index) => ({ index, deltaK, rateMmPerCycle }))

  function choose(index: number) {
    select({ series: specimen, index })
  }

  return (
    <figure className="crack-growth" data-crack-growth="" data-compact={compact}>
      {!compact && data.series.length > 1 && (
        <label className="crack-control">Series
          <select value={specimen.id} onChange={(event) => {
            setSeriesId(event.currentTarget.value)
            setCustom(undefined)
            select(undefined)
          }}>
            {data.series.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      )}
      <CrackPlot domains={domains} specimen={specimen} bounds={bounds} fit={fit} selected={active} compact={compact} label={label} choose={choose} />
      {!compact && (
        <>
          <ul className="crack-key" aria-label="Crack-growth plot key">
            <li className="crack-key-fit-point">Included in fit</li>
            <li className="crack-key-measured">Outside fit</li>
            <li className="crack-key-line">Paris fit</li>
          </ul>
          <div className="crack-controls">
            <label className="crack-control">Fit from
              <select value={bounds[0]} onChange={(event) => setCustom({ series: specimen, bounds: [Number(event.currentTarget.value), bounds[1]] })}>
                {options.slice(0, bounds[1] - 1).filter(({ index, deltaK }) =>
                  deltaK < options[bounds[1]].deltaK && (index === 0 || options[index - 1].deltaK < deltaK)
                ).map(({ index, deltaK }) => (
                  <option key={index} value={index}>{precision.format(deltaK)} MPa√m</option>
                ))}
              </select>
            </label>
            <label className="crack-control">Fit through
              <select value={bounds[1]} onChange={(event) => setCustom({ series: specimen, bounds: [bounds[0], Number(event.currentTarget.value)] })}>
                {options.slice(bounds[0] + 2).filter(({ index, deltaK }) =>
                  deltaK > options[bounds[0]].deltaK && (index === options.length - 1 || options[index + 1].deltaK > deltaK)
                ).map(({ index, deltaK }) => (
                  <option key={index} value={index}>{precision.format(deltaK)} MPa√m</option>
                ))}
              </select>
            </label>
            <label className="crack-control">Measurement
              <select value={active} onChange={(event) => choose(Number(event.currentTarget.value))}>
                {options.map(({ index, deltaK, rateMmPerCycle }) => (
                  <option key={index} value={index}>{precision.format(deltaK)} MPa√m · {scientific(rateMmPerCycle)} mm/cycle</option>
                ))}
              </select>
            </label>
          </div>
          <output className="crack-readout" data-crack-readout="" data-series={specimen.id} data-count={fit?.count}
            data-exponent={fit?.exponent} data-coefficient={fit?.coefficient} data-r-squared={fit?.rSquared ?? undefined}
            data-delta-k={point.deltaK} data-rate={point.rateMmPerCycle}>
            <span>Selected ΔK <strong>{precision.format(point.deltaK)} MPa√m</strong></span>
            <span>Selected da/dN <strong>{scientific(point.rateMmPerCycle)} mm/cycle</strong></span>
            {fit ? (
              <>
                <span>Paris exponent, m <strong>{fit.exponent.toFixed(3)}</strong></span>
                <span>Coefficient, C <strong>{scientific(fit.coefficient)}</strong></span>
                <span>Log-space R² <strong>{fit.rSquared?.toFixed(3) ?? 'Unavailable'}</strong></span>
                <span>Fitted points <strong>{fit.count}</strong></span>
              </>
            ) : <span>Paris fit <strong>Unavailable for this range</strong></span>}
            {specimen.stressRatio !== undefined && <span>Stress ratio, R <strong>{precision.format(specimen.stressRatio)}</strong></span>}
          </output>
          {source && (
            <figcaption className="crack-caption">
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

export function CrackGrowth({ data, label = 'Fatigue crack growth', ...props }: CrackGrowthProps) {
  const domains = useMemo(() => analyse(data), [data])
  if (!domains) return <p className="chart-render-message" role="status">Provide positive crack-growth rates and ordered stress-intensity ranges.</p>
  return <CrackFigure {...props} data={data} domains={domains} label={label} />
}
