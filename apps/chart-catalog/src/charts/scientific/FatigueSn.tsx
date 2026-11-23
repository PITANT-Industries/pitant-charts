import { useMemo, useState } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './fatigue-sn.css'

export interface FatigueTest {
  id: string
  stressMpa: number
  cycles: number
  outcome: 'failure' | 'runout'
}

export interface FatigueSeries {
  id: string
  label: string
  stressRatio?: number
  tests: readonly FatigueTest[]
}

export interface FatigueSnData {
  stressLabel?: string
  series: readonly FatigueSeries[]
}

export interface FatigueSnProps {
  data: FatigueSnData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Domain = readonly [number, number]
type Observation = FatigueTest & { series: FatigueSeries; key: string; color: string }
type Filter = 'all' | FatigueTest['outcome']
const colors = ['#285f86', '#99452d', '#386d50', '#664d83']
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const cyclesFormat = new Intl.NumberFormat('en-US')

function powerOfTen(exponent: number) {
  return `10${String(exponent).replace('-', '⁻').replace(/\d/g, (digit) => superscripts[Number(digit)])}`
}

function analyse({ series }: FatigueSnData) {
  if (!series.length || new Set(series.map(({ id }) => id)).size !== series.length) return null
  const observations: Observation[] = []
  let first = Infinity
  let last = -Infinity
  let minimum = Infinity
  let maximum = -Infinity
  for (const [index, campaign] of series.entries()) {
    const { tests, stressRatio } = campaign
    if (!tests.length || new Set(tests.map(({ id }) => id)).size !== tests.length ||
        (stressRatio !== undefined && !Number.isFinite(stressRatio))) return null
    for (const test of tests) {
      if (!Number.isSafeInteger(test.cycles) || test.cycles <= 0 || !Number.isFinite(test.stressMpa) || test.stressMpa <= 0 ||
          (test.outcome !== 'failure' && test.outcome !== 'runout')) return null
      const log = Math.log10(test.cycles)
      first = Math.min(first, log)
      last = Math.max(last, log)
      minimum = Math.min(minimum, test.stressMpa)
      maximum = Math.max(maximum, test.stressMpa)
      observations.push({ ...test, series: campaign, key: JSON.stringify([campaign.id, test.id]), color: colors[index % colors.length] })
    }
  }
  const xPadding = Math.max(.08, (last - first) * .1)
  const yPadding = Math.max(1, (maximum - minimum || minimum * .15) * .12)
  const stress = [Math.max(0, minimum - yPadding), maximum + yPadding] as const
  if (!Number.isFinite(stress[1] - stress[0])) return null
  return {
    cycles: [Math.min(Math.floor(first), first - xPadding * .45), Math.max(Math.ceil(last), last + xPadding)] as const,
    stress, observations,
  }
}

function stressTicks([min, max]: Domain, target: number) {
  const approximate = (max - min) / target
  const base = 10 ** Math.floor(Math.log10(approximate))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= approximate) ?? 10)
  if (!Number.isFinite(step) || step <= 0) return [min, max]
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  return last > first ? Array.from({ length: Math.min(10, last - first + 1) }, (_, index) => (first + index) * step) : [min, max]
}

function cycleTicks([min, max]: Domain, available: number) {
  const first = Math.ceil(min)
  const last = Math.floor(max)
  const stride = Math.max(1, Math.ceil((last - first) / Math.max(2, Math.floor(available / 32))))
  return Array.from({ length: Math.floor((last - first) / stride) + 1 }, (_, index) => first + index * stride)
}

function FatiguePlot({ cycles, stress, observations, selected, stressLabel, compact, label, pick }: {
  cycles: Domain
  stress: Domain
  observations: readonly Observation[]
  selected?: Observation
  stressLabel: string
  compact: boolean
  label: string
  pick: (key: string) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 435 : 760, compact ? 170 : 340)
  const left = width < 355 ? 52 : 57
  const right = Math.max(left + 1, width - 19)
  const top = 15
  const bottom = Math.max(top + 1, height - 44)
  const x = (value: number) => left + (value - cycles[0]) / (cycles[1] - cycles[0]) * (right - left)
  const y = (value: number) => bottom - (value - stress[0]) / (stress[1] - stress[0]) * (bottom - top)
  const decades = cycleTicks(cycles, right - left)
  const minorTicks = (right - left) / (cycles[1] - cycles[0]) >= 38
    ? Array.from({ length: Math.ceil(cycles[1]) - Math.floor(cycles[0]) }, (_, index) => Math.floor(cycles[0]) + index)
      .flatMap((decade) => [decade + Math.log10(2), decade + Math.log10(5)])
      .filter((position) => position > cycles[0] && position < cycles[1])
    : []

  return (
    <div className="fatigue-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-fatigue-plot=""
        aria-label={`${label}. ${stressLabel} versus cycles on a logarithmic scale. Right arrows indicate run-outs.`}>
        <g className="scientific-axis" aria-hidden="true">
          {minorTicks.map((value) => <line className="scientific-tick" key={value} x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 2} />)}
          {decades.map((value) => (
            <g key={value}>
              <line className="fatigue-grid" x1={x(value)} x2={x(value)} y1={top} y2={bottom} />
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{powerOfTen(value)}</text>
            </g>
          ))}
          {stressTicks(stress, compact ? 4 : 5).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          <rect className="scientific-frame" data-fatigue-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Cycles, N (log scale)</text>
          <text className="scientific-axis-label fatigue-y-label" textAnchor="middle"
            transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`}>{stressLabel} (MPa)</text>
        </g>
        {observations.map((test) => {
          const cx = x(Math.log10(test.cycles))
          const cy = y(test.stressMpa)
          const size = compact ? 2.7 : 3.5
          const arrowLength = Math.max(6, Math.min(compact ? 9 : 12, right - cx - 1))
          return (
            <g key={test.key} data-fatigue-test="" data-specimen={test.id} data-cycles={test.cycles}
              data-stress={test.stressMpa} data-outcome={test.outcome} data-series={test.series.id}
              className={compact ? undefined : 'fatigue-test-pick'} onClick={compact ? undefined : () => pick(test.key)} aria-hidden="true">
              {!compact && <circle className="fatigue-test-target" cx={cx} cy={cy} r={8} />}
              {test.outcome === 'failure' ? (
                <circle className="fatigue-failure" data-fatigue-failure="" cx={cx} cy={cy} r={size} fill={test.color} />
              ) : (
                <>
                  <circle className="fatigue-runout-node" cx={cx} cy={cy} r={size} stroke={test.color} />
                  <path className="fatigue-runout" data-fatigue-runout="" stroke={test.color}
                    d={`M${cx + size} ${cy}H${cx + arrowLength}m-3-3 3 3-3 3`} />
                </>
              )}
            </g>
          )
        })}
        {selected && !compact && (
          <circle className="fatigue-cursor" data-fatigue-cursor="" data-specimen={selected.id} data-series={selected.series.id}
            cx={x(Math.log10(selected.cycles))} cy={y(selected.stressMpa)} r={7} aria-hidden="true" />
        )}
      </svg>
    </div>
  )
}

function FatigueFigure({ data, setup, compact = false, label, source }: FatigueSnProps & {
  setup: NonNullable<ReturnType<typeof analyse>>
  label: string
}) {
  const [seriesId, setSeriesId] = useState('')
  const [outcome, setOutcome] = useState<Filter>('all')
  const [specimen, setSpecimen] = useState(setup.observations[0].key)
  const shown = setup.observations.filter((test) => (!seriesId || test.series.id === seriesId) && (outcome === 'all' || test.outcome === outcome))
  const active = shown.find(({ key }) => key === specimen) ?? shown[0]
  const isRunout = active?.outcome === 'runout'
  const stressLabel = data.stressLabel ?? 'Stress amplitude, σₐ'
  const duplicates = active ? shown.filter((test) => test.cycles === active.cycles && test.stressMpa === active.stressMpa).length : 0

  return (
    <figure className="fatigue-sn" data-fatigue-sn="" data-compact={compact}>
      {!compact && (
        <div className="fatigue-controls">
          {data.series.length > 1 && (
            <label>Series
              <select value={seriesId} onChange={(event) => setSeriesId(event.currentTarget.value)}>
                <option value="">All series</option>
                {data.series.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          )}
          <label>Outcome
            <select value={outcome} onChange={(event) => setOutcome(event.currentTarget.value as Filter)}>
              <option value="all">All tests</option>
              <option value="failure">Failures</option>
              <option value="runout">Run-outs</option>
            </select>
          </label>
          <label>Specimen
            <select value={active?.key ?? ''} disabled={!active} onChange={(event) => setSpecimen(event.currentTarget.value)}>
              {!active && <option value="">No matching tests</option>}
              {shown.map((test) => <option key={test.key} value={test.key}>
                {data.series.length > 1 ? `${test.series.label} · ` : ''}{test.id}
              </option>)}
            </select>
          </label>
        </div>
      )}
      <FatiguePlot cycles={setup.cycles} stress={setup.stress} observations={compact ? setup.observations : shown} selected={active}
        stressLabel={stressLabel} compact={compact} label={label} pick={setSpecimen} />
      {!compact && (
        <>
          <ul className="fatigue-key" aria-label="Fatigue plot key">
            {data.series.length > 1 && data.series.map(({ id, label }, index) => (
              <li key={id}><span className="fatigue-key-series" style={{ background: colors[index % colors.length] }} />{label}</li>
            ))}
            <li className="fatigue-key-failure">Failure</li>
            <li className="fatigue-key-runout">Run-out</li>
          </ul>
          {active ? (
            <output className="fatigue-readout" data-fatigue-readout="" data-specimen={active.id} data-cycles={active.cycles}
              data-stress={active.stressMpa} data-outcome={active.outcome} data-series={active.series.id}>
              <span>Specimen <strong>{active.id}</strong></span>
              <span>Outcome <strong>{isRunout ? 'Run-out' : 'Failure'}</strong></span>
              <span>{isRunout ? 'Cycles survived' : 'Cycles to failure'} <strong>{cyclesFormat.format(active.cycles)}</strong></span>
              <span>{data.stressLabel ?? 'Stress amplitude'} <strong>{format.format(active.stressMpa)} MPa</strong></span>
              {active.series.stressRatio !== undefined && <span>Stress ratio, R <strong>{format.format(active.series.stressRatio)}</strong></span>}
              {duplicates > 1 && <span>Tests at this coordinate <strong>{duplicates}</strong></span>}
            </output>
          ) : <p className="fatigue-empty" role="status">No tests match the selected filters.</p>}
          {source && (
            <figcaption className="fatigue-caption">
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

export function FatigueSn({ data, label = 'Fatigue S–N plot', ...props }: FatigueSnProps) {
  const setup = useMemo(() => analyse(data), [data])
  if (!setup) return <p className="chart-render-message" role="status">Provide specimen stress amplitudes, positive cycle counts, and recorded outcomes.</p>
  return <FatigueFigure {...props} data={data} setup={setup} label={label} />
}
