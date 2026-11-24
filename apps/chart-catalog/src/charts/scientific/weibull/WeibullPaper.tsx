import { useId } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { weibullProbabilityCoordinate, weibullQuantile } from './model'
import type { PreparedWeibull, PreparedWeibullCohort, WeibullFailureMark } from './model'

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const concise = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })
const paperProbabilities = [.0001, .0005, .001, .005, .01, .02, .05, .1, .2, .3, .5, .6321205588, .8, .9, .95, .98, .99, .995, .999, .9999]

export function weibullColor(index: number) {
  return `var(--weibull-series-${index % 4})`
}

function timeTicks(min: number, max: number) {
  if (max - min >= Math.log(35)) {
    const step = Math.max(1, Math.ceil((max - min) / (7 * Math.LN10)))
    const first = Math.ceil(min / Math.LN10)
    const last = Math.floor(max / Math.LN10)
    return Array.from({ length: Math.max(0, Math.floor((last - first) / step) + 1) },
      (_, i) => (first + i * step) * Math.LN10)
  }
  const lo = Math.exp(min)
  const hi = Math.exp(max)
  const rough = (hi - lo) / 7
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = magnitude * ([1, 2, 2.5, 5, 10].find((value) => magnitude * value >= rough) ?? 10)
  const first = Math.ceil(lo / step)
  const count = Math.min(12, Math.max(0, Math.floor(hi / step) - first + 1))
  return Array.from({ length: count }, (_, index) => Math.log((first + index) * step))
}

function spaced(candidates: readonly number[], position: (value: number) => number, gap: number) {
  const picked: number[] = []
  for (const value of candidates) {
    if (!picked.length || Math.abs(position(value) - position(picked[picked.length - 1])) >= gap) picked.push(value)
  }
  return picked
}

function PointMark({ index, x, y, size }: { index: number; x: number; y: number; size: number }) {
  if (index % 3 === 1) return <rect className="weibull-dot" x={x - size} y={y - size} width={2 * size} height={2 * size} />
  if (index % 3 === 2) return <path className="weibull-dot" d={`M${x} ${y - size * 1.3}l${size * 1.05} ${size * 1.3}l${-size * 1.05} ${size * 1.3}l${-size * 1.05} ${-size * 1.3}Z`} />
  return <circle className="weibull-dot" cx={x} cy={y} r={size} />
}

export function WeibullPaper({ study, active, selected, guide, compact, onSelect }: {
  study: PreparedWeibull
  active: PreparedWeibullCohort
  selected?: WeibullFailureMark
  guide: number
  compact: boolean
  onSelect: (cohort: string, mark: WeibullFailureMark) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(760, compact ? 192 : 366)
  const clip = useId()
  const censoredCohorts = study.cohorts.filter(({ censors }) => censors.length > 0)
  const hasCensoring = censoredCohorts.length > 0
  const rugRow = compact ? 5 : 11
  const rugRows = compact ? Math.min(4, censoredCohorts.length) : censoredCohorts.length
  const rugDepth = hasCensoring ? rugRow * rugRows + (compact ? 8 : 9) : 0
  const lowObserved = Math.log(study.minTime)
  const highObserved = Math.log(study.maxTime)
  const quantileLogs = !compact ? study.cohorts.flatMap(({ fit }) => {
    const value = fit && weibullQuantile(fit, guide)
    return value === undefined ? [] : [Math.log(value)]
  }) : []
  const fittedLogs = compact ? [] : study.cohorts.flatMap(({ marks }) => marks.flatMap(({ fittedTime }) => (
    fittedTime === undefined ? [] : [Math.log(fittedTime)]
  )))
  const low = Math.min(lowObserved, ...quantileLogs, ...fittedLogs)
  const high = Math.max(highObserved, ...quantileLogs, ...fittedLogs)
  const padding = Math.max((high - low) * .055, .09)
  const minLog = Math.max(Math.log(Number.MIN_VALUE), low - padding)
  const maxLog = Math.min(Math.log(Number.MAX_VALUE), high + padding)
  const firstProbability = Math.min(.008, ...study.cohorts.map(({ marks }) => (marks[0]?.probability ?? .01) * .65))
  const lastProbability = Math.max(.99, ...study.cohorts.map(({ marks }) => marks.at(-1)?.probability ?? .99))
  const yMin = weibullProbabilityCoordinate(firstProbability)
  const yMax = weibullProbabilityCoordinate(lastProbability)
  const left = compact ? 9 : width < 390 ? 56 : 71
  const right = Math.max(left + 1, width - (compact ? 7 : 19))
  const top = compact ? 8 : 14
  const bottom = Math.max(top + 1, height - (compact ? 8 : 49) - rugDepth)
  const xLog = (value: number) => left + (value - minLog) / (maxLog - minLog) * (right - left)
  const x = (time: number) => xLog(Math.log(time))
  const yPaper = (value: number) => bottom - (value - yMin) / (yMax - yMin) * (bottom - top)
  const y = (probability: number) => yPaper(weibullProbabilityCoordinate(probability))
  const xs = spaced(timeTicks(minLog, maxLog), xLog, compact ? 16 : 39)
  const pTicks = paperProbabilities.filter((value) => value >= firstProbability && value <= lastProbability)
  const labeled = new Set(spaced(pTicks, y, 16))
  const rugBase = bottom + (compact ? 4 : 10)
  const residualTime = !compact ? selected?.fittedTime : undefined

  return <div ref={plot} className="scientific-plot weibull-paper" data-censors={hasCensoring}
    style={!compact && rugRows > 3 ? { minBlockSize: 320 + (rugRows - 3) * rugRow } : undefined}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weibull probability paper for observed failure times and fitted distributions"
      data-weibull-paper data-x-min={Math.exp(minLog)} data-x-max={Math.exp(maxLog)}
      data-paper-min={yMin} data-paper-max={yMax} data-plot-left={left} data-plot-right={right}
      data-plot-top={top} data-plot-bottom={bottom}>
      <defs><clipPath id={clip}><rect x={left - 4} y={top - 4} width={right - left + 8} height={bottom - top + 8} /></clipPath></defs>
      <g className="scientific-axis" aria-hidden="true">
        <path className="scientific-tick" fill="none" d={`M${left} ${top}V${bottom}H${right}`} />
        {xs.map((value) => <g key={value}>
          <line x1={xLog(value)} x2={xLog(value)} y1={top} y2={bottom + 4} className="weibull-grid" />
          {!compact && <text x={xLog(value)} y={bottom + rugDepth + 18} data-time-tick={Math.exp(value)} textAnchor="middle">
            {(value >= Math.log(100_000) ? concise : number).format(Math.exp(value))}
          </text>}
        </g>)}
        {pTicks.map((p) => <g key={p}>
          <line x1={left - 4} x2={right} y1={y(p)} y2={y(p)} className={`weibull-grid${labeled.has(p) ? ' weibull-grid-major' : ''}`} />
          {!compact && labeled.has(p) && <text x={left - 8} y={y(p)} textAnchor="end" dominantBaseline="middle"
            data-probability-tick={p}>{percent.format(p)}</text>}
        </g>)}
        {!compact && <>
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 7} textAnchor="middle">Test time ({study.timeUnit}, log scale)</text>
          <text className="scientific-axis-label" transform={`translate(12 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Failure probability</text>
          {hasCensoring && <text x={left - 7} y={rugBase + 4} textAnchor="end" className="weibull-rug-label">Censored</text>}
        </>}
      </g>
      <g clipPath={`url(#${clip})`}>
        {!compact && guide >= firstProbability && guide <= lastProbability &&
          <line data-weibull-guide={guide} x1={left} x2={right} y1={y(guide)} y2={y(guide)} className="weibull-guide" />}
        {study.cohorts.map((cohort, index) => {
          const { fit } = cohort
          const observedMin = Math.log(cohort.observations[0].time)
          const observedMax = Math.log(cohort.observations[cohort.observations.length - 1].time)
          const q = !compact && fit ? weibullQuantile(fit, guide) : undefined
          return <g key={cohort.id} data-weibull-cohort={cohort.id} style={{ color: weibullColor(index) }}>
            {fit && ([
              ['tail', minLog, observedMin], ['observed', observedMin, observedMax], ['tail', observedMax, maxLog],
            ] as const).map(([kind, lower, upper], i) => {
              const a = Math.max(lower, minLog, fit.logScale + yMin / fit.shape)
              const b = Math.min(upper, maxLog, fit.logScale + yMax / fit.shape)
              if (a >= b) return null
              return <line key={i} data-weibull-fit={kind} data-start={Math.exp(a)} data-end={Math.exp(b)}
                x1={xLog(a)} x2={xLog(b)} y1={yPaper(fit.shape * (a - fit.logScale))} y2={yPaper(fit.shape * (b - fit.logScale))}
                className={kind === 'tail' ? 'weibull-fit weibull-fit-tail' : 'weibull-fit'} />
            })}
            {q !== undefined && guide >= firstProbability && guide <= lastProbability &&
              <g data-weibull-quantile={guide} data-time={q}>
                <line x1={x(q)} x2={x(q)} y1={y(guide)} y2={bottom} className="weibull-quantile-rule" />
                <circle cx={x(q)} cy={y(guide)} r={3.3} className="weibull-quantile" />
              </g>}
            {cohort.marks.map((mark) => {
              const picked = !compact && active.id === cohort.id && selected?.id === mark.id
              const cx = x(mark.time)
              const cy = y(mark.probability)
              return <g key={mark.id} data-weibull-mark={mark.id} data-time={mark.time} data-probability={mark.probability}
                data-at-risk={mark.atRisk} data-active={picked} onClick={compact ? undefined : () => onSelect(cohort.id, mark)}>
                <PointMark index={index} x={cx} y={cy} size={compact ? 2 : picked ? 4 : 2.7} />
                {!compact && <circle cx={cx} cy={cy} r={7} fill="transparent" className="weibull-mark-target" />}
              </g>
            })}
          </g>
        })}
        {selected && residualTime !== undefined &&
          <g className="weibull-residual" data-weibull-residual={selected.id} data-observed={selected.time} data-fitted={residualTime}>
            <line x1={x(selected.time)} x2={x(residualTime)} y1={y(selected.probability)} y2={y(selected.probability)} />
            <circle cx={x(residualTime)} cy={y(selected.probability)} r={3.6} />
          </g>}
      </g>
      {censoredCohorts.map(({ id, censors }, index) => {
        const lanes = new Map<number, number>()
        const counts = new Map<number, number>()
        for (const { time } of censors) counts.set(time, (counts.get(time) ?? 0) + 1)
        const cy = rugBase + (compact ? index % rugRows : index) * rugRow
        return <g key={id} data-weibull-censors={id} style={{ color: weibullColor(study.cohorts.findIndex((item) => item.id === id)) }}>
          {censors.map((item) => {
            const lane = lanes.get(item.time) ?? 0
            lanes.set(item.time, lane + 1)
            const count = counts.get(item.time) ?? 1
            const step = (compact ? 4.2 : 7) / count
            const start = cy + lane * step
            return <line key={item.id} data-weibull-censor={item.id} data-time={item.time}
              className="weibull-censor" x1={x(item.time)} x2={x(item.time)} y1={start} y2={start + step * .7} />
          })}
          {!compact && Array.from(counts, ([time, count]) => count > 1 && (
            <text key={time} data-weibull-censor-count={count} x={x(time) + (x(time) > right - 23 ? -4 : 4)}
              textAnchor={x(time) > right - 23 ? 'end' : 'start'} y={cy + 6} className="weibull-rug-count">×{count}</text>
          ))}
        </g>
      })}
    </svg>
  </div>
}
