import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { reliabilityAtTime } from './model'
import type { PreparedReliability, PreparedReliabilityCohort, ReliabilityObservation } from './model'

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7 })
const dash = [undefined, '7 3', '2 2.8', '11 3 2 3']

function shortLabel(label: string, capacity: number) {
  const characters = Array.from(label)
  return characters.length > capacity ? characters.slice(0, capacity - 1).join('') + '…' : label
}

export function reliabilityColor(index: number) {
  return `var(--km-series-${index % 4})`
}

function axisTimes(max: number, target: number) {
  const rough = max / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = magnitude * ([1, 2, 2.5, 5, 10].find((value) => magnitude * value >= rough) ?? 10)
  return Array.from({ length: Math.min(11, Math.floor(max / step) + 1) }, (_, index) => Number((index * step).toPrecision(13)))
}

export function ReliabilityPlot({ study, active, time, timeChoices, compact, onSelect }: {
  study: PreparedReliability
  active: PreparedReliabilityCohort
  time: number
  timeChoices: readonly number[]
  compact: boolean
  onSelect: (time: number) => void
}) {
  const blockSize = 307 + study.cohorts.length * 24
  const { plot, width, height } = usePlotSize<HTMLDivElement>(750, compact ? 200 : blockSize)
  const maximum = study.followUp || 1
  const left = compact ? 10 : width < 380 ? 57 : 81
  const right = Math.max(left + 1, width - (compact ? 8 : 21))
  const top = compact ? 12 : 15
  const bottom = Math.max(top + 1, height - (compact ? 12 : 67 + study.cohorts.length * 24))
  const x = (hour: number) => left + (right - left) * (hour / maximum)
  const y = (reliability: number) => bottom - (bottom - top) * reliability
  const ticks = axisTimes(maximum, width < 380 ? 4 : 7)

  function selectTime(event: MouseEvent<SVGRectElement>) {
    const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM()
    if (!matrix) return
    const hit = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const value = (hit.x - left) / (right - left) * maximum
    onSelect(timeChoices.reduce((nearest, next) => Math.abs(next - value) < Math.abs(nearest - value) ? next : nearest))
  }

  return <div ref={plot} className="scientific-plot km-main-plot" style={compact ? undefined : { blockSize }}>
    <svg viewBox={`0 0 ${width} ${height}`} data-km-plot data-time-max={maximum}
      data-plot-left={left} data-plot-right={right} data-plot-top={top} data-plot-bottom={bottom}
      role="img" aria-label="Kaplan–Meier reliability estimates with censor marks and aligned risk counts">
      {!compact && <g className="scientific-axis km-axes" aria-hidden="true">
        <path className="scientific-tick" fill="none" d={`M${left} ${top}V${bottom}H${right}`} />
        {[0, .25, .5, .75, 1].map((value) => <g key={value}>
          <line x1={left} x2={right} y1={y(value)} y2={y(value)} className="km-rule" />
          <text x={left - 7} y={y(value)} textAnchor="end" dominantBaseline="middle">{Math.round(value * 100)}</text>
        </g>)}
        {ticks.map((tick) => <g key={tick}>
          <line className="scientific-tick" x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 4} />
          <text x={x(tick)} y={bottom + 17} textAnchor="middle">{number.format(tick)}</text>
        </g>)}
        <text className="scientific-axis-label" transform={`translate(${left - 38} ${(top + bottom) / 2}) rotate(-90)`}
          textAnchor="middle">Reliability (%)</text>
        <text x={(left + right) / 2} y={bottom + 37} className="scientific-axis-label" textAnchor="middle">
          Test time ({study.timeUnit})
        </text>
      </g>}
      {study.cohorts.map((cohort, index) => {
        const color = reliabilityColor(index)
        let previous = 1
        const curve = [`M${x(0)} ${y(1)}`]
        for (const step of cohort.steps) {
          curve.push(`H${x(step.time)}`)
          if (step.survival !== previous) curve.push(`V${y(step.survival)}`)
          previous = step.survival
        }
        const selection = !compact ? reliabilityAtTime(cohort, time) : null
        return <g key={cohort.id} data-km-cohort={cohort.id} style={{ color }}>
          {!compact && cohort.id === active.id && cohort.steps.slice(0, -1).map((step, i) => {
            if (!step.confidence) return null
            const [lower, upper] = step.confidence
            const nextTime = cohort.steps[i + 1].time
            return <rect key={step.time} data-km-confidence={step.time} data-lower={lower} data-upper={upper}
              x={x(step.time)} y={y(upper)} width={x(nextTime) - x(step.time)} height={y(lower) - y(upper)} className="km-confidence" />
          })}
          <path data-km-curve data-cohort-end={cohort.followUp} className="km-curve" d={curve.join('')} strokeDasharray={dash[index % 4]} />
          {cohort.steps.filter((step) => step.censoredIds.length).map((step) => <path key={step.time}
            data-km-censor={step.time} data-count={step.censoredIds.length} data-survival={step.survival} className="km-censor-mark"
            d={`M${x(step.time)} ${y(step.survival) - 4}V${y(step.survival) + 4}M${x(step.time) - 3} ${y(step.survival)}H${x(step.time) + 3}`} />)}
          {selection?.survival !== undefined &&
            <circle data-km-selected-survival={selection.survival} cx={x(time)} cy={y(selection.survival)} r={3.3} className="km-selection-point" />}
        </g>
      })}
      {!compact && <>
        <line x1={x(time)} x2={x(time)} y1={top} y2={bottom} className="km-time-rule" data-km-cursor={time} />
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="transparent"
          className="km-plot-hit" data-km-hit onClick={selectTime} />
        <g className="scientific-axis km-risk-table" aria-label="Units at risk immediately before the labeled times">
          <line x1={0} x2={right} y1={bottom + 48} y2={bottom + 48} className="km-rule" />
          <text x={3} y={bottom + 63} className="km-risk-heading">At risk</text>
          {study.cohorts.map((cohort, index) => <g key={cohort.id} style={{ color: reliabilityColor(index) }}>
            <text x={3} y={bottom + 82 + index * 23} className="km-risk-label" aria-label={cohort.label}>{shortLabel(cohort.label, Math.floor((left - 9) / 6))}</text>
            {ticks.map((tick) => {
              const state = reliabilityAtTime(cohort, tick)
              return <text key={tick} x={x(tick)} y={bottom + 82 + index * 23} textAnchor="middle"
                data-km-risk-at={tick} data-cohort={cohort.id} data-at-risk={state?.atRisk}>{state?.atRisk ?? '—'}</text>
            })}
          </g>)}
        </g>
      </>}
    </svg>
  </div>
}

export function SpecimenTimeline({ cohort, study, time, selected, onSelect }: {
  cohort: PreparedReliabilityCohort
  study: PreparedReliability
  time: number
  selected?: ReliabilityObservation
  onSelect: (observation: ReliabilityObservation) => void
}) {
  const blockSize = cohort.observations.length * 20 + 49
  const { plot, width, height } = usePlotSize<HTMLDivElement>(750, blockSize)
  const left = width < 380 ? 57 : 81
  const right = Math.max(left + 1, width - 21)
  const top = 12
  const bottom = height - 32
  const domain = study.followUp || 1
  const x = (t: number) => left + (t / domain) * (right - left)
  const row = (bottom - top) / cohort.observations.length
  const ticks = axisTimes(domain, width < 380 ? 4 : 7)
  const color = reliabilityColor(study.cohorts.indexOf(cohort))
  return <div className="km-specimen-scroll">
    <div ref={plot} className="scientific-plot km-specimen-plot" style={{ blockSize }}>
      <svg data-km-specimens={cohort.id} data-time-max={domain} data-plot-left={left} data-plot-right={right}
        viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Observed specimen lifetimes for ${cohort.label}`} style={{ color }}>
        <line x1={x(time)} x2={x(time)} y1={top} y2={bottom} className="km-time-rule" />
        {cohort.observations.map((item, index) => {
          const y = top + (index + .5) * row
          const end = x(item.time)
          return <g key={item.id} className="km-specimen" data-km-specimen={item.id} data-time={item.time} data-status={item.status}
            data-active={selected?.id === item.id} data-at-risk={item.time >= time} onClick={() => onSelect(item)}>
            <rect x={0} y={y - row / 2} width={width} height={row} className="km-specimen-row" />
            <text x={3} y={y} dominantBaseline="middle" className="scientific-axis km-specimen-id" aria-label={item.id}>{shortLabel(item.id, Math.floor((left - 6) / 6))}</text>
            <line x1={left} x2={end} y1={y} y2={y} className="km-life" />
            {item.status === 'failed'
              ? <circle cx={end} cy={y} r={3.35} data-km-outcome="failed" className="km-failure-mark" />
              : <path data-km-outcome="censored" className="km-censor-mark" d={`M${end} ${y - 4}V${y + 4}M${end - 3} ${y}H${end + 3}`} />}
          </g>
        })}
        <g className="scientific-axis" aria-hidden="true">
          <line x1={left} x2={right} y1={bottom} y2={bottom} className="scientific-tick" />
          {ticks.map((tick) => <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 4} className="scientific-tick" />
            <text x={x(tick)} y={bottom + 17} textAnchor="middle">{number.format(tick)}</text>
          </g>)}
        </g>
      </svg>
    </div>
  </div>
}
