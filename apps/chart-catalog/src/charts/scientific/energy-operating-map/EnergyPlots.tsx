import type { PreparedEnergyMap, PreparedEnergyRun } from './model'

const label = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })

function scale(values: readonly number[], low: number, high: number) {
  let minimum = Infinity
  let maximum = -Infinity
  for (const value of values) {
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
  return (value: number) => minimum === maximum
    ? (low + high) / 2
    : low + (value - minimum) / (maximum - minimum) * (high - low)
}

function tickValues(values: readonly number[], count: number) {
  const distinct = [...new Set(values)].sort((a, b) => a - b)
  if (distinct.length <= count) return distinct
  return Array.from({ length: count }, (_, i) => distinct[Math.round(i * (distinct.length - 1) / (count - 1))])
}

export function EnergyMapPlot({ study, selected, width, compact, select }: {
  study: PreparedEnergyMap
  selected: number
  width: number
  compact: boolean
  select?: (index: number) => void
}) {
  const height = compact ? 116 : 276
  const left = compact ? 6 : 53
  const right = width - (compact ? 6 : 14)
  const top = compact ? 7 : 17
  const bottom = height - (compact ? 5 : 43)
  const xs = study.groups.map(({ speed }) => speed)
  const ys = study.groups.map(({ load }) => load)
  const x = scale(xs, left + 12, right - 12)
  const y = scale(ys, bottom - 12, top + 12)
  const widthCount = width < 480 ? 4 : 6
  const [min, max] = study.extent ?? [0, 0]

  return <svg data-energy-map viewBox={`0 0 ${width} ${height}`} width={width} height={height}
    role="img" aria-label="Energy per produced unit at recorded operating settings">
    {!compact && <>
      {tickValues(xs, widthCount).map((value) => <g key={value} className="energy-grid">
        <line x1={x(value)} x2={x(value)} y1={top} y2={bottom} />
        <text x={x(value)} y={bottom + 17} textAnchor="middle">{label.format(value)}</text>
      </g>)}
      {tickValues(ys, 5).map((value) => <g key={value} className="energy-grid">
        <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
        <text x={left - 7} y={y(value) + 3} textAnchor="end">{label.format(value)}</text>
      </g>)}
      <text x={(left + right) / 2} y={height - 6} textAnchor="middle">{study.speed.label} ({study.speed.unit})</text>
      <text textAnchor="middle" transform={`translate(11 ${(top + bottom) / 2}) rotate(-90)`}>
        {study.load.label} ({study.load.unit})
      </text>
    </>}
    <path className="energy-axis" d={`M${left},${top}V${bottom}H${right}`} />
    {study.groups.map(({ speed, load, median, runs }, index) => {
      const cx = x(speed)
      const cy = y(load)
      const active = index === selected
      const radius = compact ? 4.5 : 6.6
      const fraction = median === null || max === min ? .5 : (median - min) / (max - min)
      return <g key={index} data-energy-group={index} data-speed={speed} data-load={load} data-median={median ?? 'unavailable'}
        data-count={runs.length} data-selected={active}
        onClick={select ? () => select(index) : undefined}>
        {median === null
          ? <path data-energy-mark className="energy-no-value" d={`M${cx - radius},${cy - radius}l${2 * radius},${2 * radius}
              M${cx + radius},${cy - radius}l-${2 * radius},${2 * radius}`} />
          : <circle data-energy-mark className="energy-map-value" cx={cx} cy={cy} r={radius}
              fill={`color-mix(in oklab, var(--energy-low), var(--energy-high) ${fraction * 100}%)`} />}
        {active && <circle className="energy-selection-ring" cx={cx} cy={cy} r={radius + 3} />}
        {!compact && <>
          <title>{label.format(speed)} {study.speed.unit} · {label.format(load)} {study.load.unit} · {runs.length} trials
            {median !== null && ` · ${label.format(median)} Wh / ${study.unit}`}</title>
          <circle className="energy-map-hit" cx={cx} cy={cy} r={radius + 4.5} />
        </>}
      </g>
    })}
  </svg>
}

export function MeterTrace({ run, width, compact }: { run: PreparedEnergyRun; width: number; compact: boolean }) {
  const height = compact ? 87 : 191
  const left = compact ? 6 : 53
  const right = width - (compact ? 6 : 14)
  const top = compact ? 4 : 12
  const bottom = height - (compact ? 5 : 37)
  const span = run.end - run.start
  let capacity = 1
  for (const segment of run.segments) {
    for (const { watts } of segment) capacity = Math.max(capacity, watts)
  }
  const divisor = capacity >= 1000 ? 1000 : 1
  const x = (time: number) => left + (time - run.start) / span * (right - left)
  const y = (watts: number) => bottom - watts / capacity * (bottom - top)

  return <svg data-energy-trace data-run={run.id} viewBox={`0 0 ${width} ${height}`} width={width} height={height}
    aria-label="Recorded power over the energy integration interval" role="img"
    data-start={run.start} data-end={run.end} data-left={left} data-right={right} data-bottom={bottom} data-capacity={capacity}>
    {!compact && <>
      {[0, .5, 1].map((fraction) => <g key={fraction} className="energy-grid">
        <line x1={left} x2={right} y1={y(capacity * fraction)} y2={y(capacity * fraction)} />
        <text x={left - 7} y={y(capacity * fraction) + 3} textAnchor="end">{label.format(capacity * fraction / divisor)}</text>
      </g>)}
      {(width < 480 ? [0, .5, 1] : [0, .25, .5, .75, 1]).map((fraction) => <text key={fraction}
        x={left + (right - left) * fraction} y={bottom + 16} textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>
        {label.format(span * fraction)}
      </text>)}
      <text textAnchor="middle" transform={`translate(11 ${(top + bottom) / 2}) rotate(-90)`}>Power ({divisor === 1000 ? 'kW' : 'W'})</text>
      <text x={(left + right) / 2} y={height - 3} textAnchor="middle">Elapsed time (s)</text>
    </>}
    <path className="energy-axis" d={`M${left},${top}V${bottom}H${right}`} />
    {run.segments.map((segment) => {
      const point = segment[0]
      const last = segment[segment.length - 1]
      const path = segment.map(({ time, watts }, i) => `${i ? 'L' : 'M'}${x(time).toFixed(3)},${y(watts).toFixed(3)}`).join(' ')
      return <g key={point.time} data-energy-power-segment data-start={point.time} data-end={last.time}>
        <path className="energy-power-area" d={`${path}L${x(last.time)},${bottom}L${x(point.time)},${bottom}Z`} />
        <path className="energy-power-line" d={path} />
      </g>
    })}
  </svg>
}
