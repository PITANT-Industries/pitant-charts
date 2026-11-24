import { usePlotSize } from '../../usePlotSize'
import type { HotellingRun, PreparedHotelling } from './model'

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function tickStep(max: number, count: number) {
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  return magnitude * ([1, 2, 2.5, 5, 10].find((value) => magnitude * value >= raw) ?? 10)
}

function shortLabel(label: string, capacity: number) {
  capacity = Math.max(3, capacity)
  const text = Array.from(label)
  return text.length > capacity ? text.slice(0, capacity - 1).join('') + '…' : label
}

export function HotellingSequence({ study, active, compact, onSelect }: {
  study: PreparedHotelling; active: HotellingRun; compact: boolean; onSelect: (run: string) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(745, compact ? 192 : 255)
  const maxScore = Math.max(study.limit, ...study.runs.map(({ score }) => score))
  const scaled = maxScore > study.limit * 9
  const metric = (score: number) => scaled ? Math.log1p(score) : score
  const max = maxScore <= Number.MAX_VALUE / 1.12 ? maxScore * 1.12 : maxScore
  const left = compact ? 9 : 51
  const right = Math.max(left + 1, width - (compact ? 8 : 21))
  const top = compact ? 10 : 17
  const bottom = Math.max(top + 1, height - (compact ? 9 : 44))
  const x = (index: number) => left + (right - left) * (index + .5) / study.runs.length
  const y = (score: number) => bottom - (bottom - top) * metric(score) / metric(max)
  const rawTicks = scaled
    ? [0, ...Array.from({ length: Math.floor(Math.log10(max)) + 1 }, (_, power) => [1, 3].map((factor) => factor * (10 ** power))).flat()].filter((value) => value <= max)
    : Array.from({ length: Math.floor(max / tickStep(max, 5)) + 1 }, (_, index) => index * tickStep(max, 5))
  const ticks: number[] = []
  for (const tick of rawTicks) {
    if (!ticks.length || Math.abs(y(tick) - y(ticks[ticks.length - 1])) >= 20) ticks.push(tick)
  }
  const skip = Math.max(1, Math.ceil(study.runs.length / (width < 400 ? 5 : 10)))

  return <div ref={plot} className="scientific-plot hotelling-sequence">
    <svg viewBox={`0 0 ${width} ${height}`} data-hotelling-sequence data-scale={scaled ? 'log1p' : 'linear'}
      data-y-max={max} data-plot-bottom={bottom} data-plot-top={top} data-plot-left={left} data-plot-right={right}
      role="img" aria-label="Phase II T-squared scores in monitored run order">
      {!compact && <g className="scientific-axis" aria-hidden="true">
        <path d={`M${left} ${top}V${bottom}H${right}`} className="scientific-tick" fill="none" />
        {ticks.map((tick) => <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="hotelling-grid" />
          <text x={left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">{compactNumber.format(tick)}</text>
        </g>)}
        {study.runs.map(({ id }, index) => index % skip === 0 && <text key={id} x={x(index)} y={bottom + 17} textAnchor="middle">{index + 1}</text>)}
        <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle">Monitored run order</text>
        <text className="scientific-axis-label" transform={`translate(11 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
          {scaled ? 'T² (log(1 + score) scale)' : 'T²'}
        </text>
      </g>}
      <line data-hotelling-limit={study.limit} className="hotelling-limit" x1={left} x2={right} y1={y(study.limit)} y2={y(study.limit)} />
      {!compact && <text x={right} y={y(study.limit) - 7} textAnchor="end" className="hotelling-limit-label">UCL {number.format(study.limit)}</text>}
      {study.runs.map((run, index) => <g key={run.id} className="hotelling-run" data-hotelling-run={run.id}
        data-order={index + 1} data-score={run.score} data-flagged={run.flagged} data-active={run.id === active.id}
        onClick={compact ? undefined : () => onSelect(run.id)}>
        <line className="hotelling-stem" x1={x(index)} x2={x(index)} y1={bottom} y2={y(run.score)} />
        <circle className="hotelling-run-dot" cx={x(index)} cy={y(run.score)} r={compact ? 2.1 : run.id === active.id ? 4.5 : 3.1} />
        {!compact && <circle className="hotelling-target" cx={x(index)} cy={y(run.score)} r={8} fill="transparent" />}
      </g>)}
    </svg>
  </div>
}

export function HotellingProjection({ study, active, axes, compact = false }: {
  study: PreparedHotelling; active: HotellingRun; axes: readonly [number, number]; compact?: boolean
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 138 : 480, compact ? 192 : 340)
  const [i, j] = axes
  const rho = study.correlation[i][j]
  const radius = Math.sqrt(study.limit)
  const extent = Math.max(radius, Math.abs(active.z[i]), Math.abs(active.z[j]),
    ...study.reference.flatMap(({ z }) => [Math.abs(z[i]), Math.abs(z[j])])) * 1.12
  const size = Math.max(1, Math.min(width - (compact ? 13 : 75), height - (compact ? 13 : 61)))
  const left = (width - size + (compact ? 0 : 32)) / 2
  const top = (height - size - (compact ? 0 : 20)) / 2
  const right = left + size
  const bottom = top + size
  const x = (value: number) => left + size * (value + extent) / (2 * extent)
  const y = (value: number) => bottom - size * (value + extent) / (2 * extent)
  const step = tickStep(extent, 3)
  const tickCount = Math.floor(extent / step)
  const ticks = Array.from({ length: 2 * tickCount + 1 }, (_, index) => (index - tickCount) * step)
  const unit = Math.sqrt(Math.max(0, (1 - rho) * (1 + rho)))
  const ellipse = Array.from({ length: 96 }, (_, index) => {
    const theta = index / 96 * Math.PI * 2
    const a = radius * Math.cos(theta)
    const b = radius * (rho * Math.cos(theta) + unit * Math.sin(theta))
    return `${index ? 'L' : 'M'}${x(a)} ${y(b)}`
  }).join('') + 'Z'

  return <div ref={plot} className="scientific-plot hotelling-projection">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projection of the full control boundary with reference points and the selected run"
      data-hotelling-projection data-channel-x={study.channels[i].id} data-channel-y={study.channels[j].id} data-rho={rho}
      data-extent={extent} data-plot-left={left} data-plot-right={right} data-plot-top={top} data-plot-bottom={bottom}>
      {!compact && <g className="scientific-axis" aria-hidden="true">
        {ticks.map((tick) => <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} className={tick === 0 ? 'hotelling-origin' : 'hotelling-grid'} />
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'hotelling-origin' : 'hotelling-grid'} />
          <text x={x(tick)} y={bottom + 16} textAnchor="middle">{number.format(tick)}</text>
          <text x={left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">{number.format(tick)}</text>
        </g>)}
        <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle" aria-label={study.channels[i].label}>
          {shortLabel(study.channels[i].label, Math.floor(size / 6) - 3)} (z)
        </text>
        <text className="scientific-axis-label" transform={`translate(${Math.max(11, left - 34)} ${(top + bottom) / 2}) rotate(-90)`}
          textAnchor="middle" aria-label={study.channels[j].label}>{shortLabel(study.channels[j].label, Math.floor(size / 6) - 3)} (z)</text>
      </g>}
      <path data-hotelling-boundary={study.limit} className="hotelling-boundary" d={ellipse} />
      {study.reference.map(({ id, z }) => <circle key={id} data-hotelling-reference={id} data-zx={z[i]} data-zy={z[j]}
        className="hotelling-reference" cx={x(z[i])} cy={y(z[j])} r={compact ? 1.7 : 2.55} />)}
      <line className="hotelling-vector" x1={x(0)} x2={x(active.z[i])} y1={y(0)} y2={y(active.z[j])} />
      <circle data-hotelling-projected-run={active.id} data-zx={active.z[i]} data-zy={active.z[j]} data-flagged={active.flagged}
        className="hotelling-projected-run" cx={x(active.z[i])} cy={y(active.z[j])} r={compact ? 3 : 5.2} />
    </svg>
  </div>
}
