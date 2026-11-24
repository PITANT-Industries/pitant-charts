import { useMemo } from 'react'
import type { AlignedStartupRun, PreparedStartupOverlay, StartupOutcome, summarizeStartupOverlay } from './model'

export const outcomeLabels: Record<StartupOutcome, string> = {
  'on-time': 'By deadline',
  late: 'After deadline',
  'not-ready': 'Readiness not observed',
  censored: 'Incomplete follow-up',
  failed: 'Recorded failure',
}

const axisNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

type StartupSummary = ReturnType<typeof summarizeStartupOverlay>

function linePath(values: readonly (number | null)[], links: readonly boolean[], x: (index: number) => number, y: (value: number) => number) {
  let path = ''
  let drawing = false
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false
      return
    }
    const point = `${x(index).toFixed(2)},${y(value).toFixed(2)}`
    path += drawing && links[index] ? `L${point}` : `M${point}L${point}`
    drawing = true
  })
  return path
}

function bandPath(trace: StartupSummary['groups'][number]['traces'][string],
  x: (index: number) => number, y: (value: number) => number) {
  const sections: string[] = []
  let top: string[] = []
  let bottom: string[] = []
  function finish() {
    if (top.length > 1) sections.push(`M${top.join('L')}L${bottom.reverse().join('L')}Z`)
    top = []
    bottom = []
  }
  trace.forEach(({ count, linked, lower, upper }, index) => {
    if (count < 2 || lower === null || upper === null) {
      finish()
      return
    }
    if (linked < 2) finish()
    top.push(`${x(index).toFixed(2)},${y(upper).toFixed(2)}`)
    bottom.push(`${x(index).toFixed(2)},${y(lower).toFixed(2)}`)
  })
  finish()
  return sections.join('')
}

export function StartupTraces({ study, summary, selected, deadline, width, compact }: {
  study: PreparedStartupOverlay
  summary: StartupSummary
  selected: AlignedStartupRun
  deadline: number
  width: number
  compact: boolean
}) {
  const [start, end] = study.window
  const signals = compact ? study.signals.slice(0, 2) : study.signals
  const left = compact ? 6 : 45
  const right = width - (compact ? 6 : 11)
  const strip = compact ? 82 : 124
  const height = strip * signals.length + (compact ? 0 : 31)
  const plotBottom = strip * signals.length - 10
  const x = (time: number) => left + (time - start) / (end - start) * (right - left)
  const divisor = end - start >= 360 ? 60 : 1

  const ranges = useMemo(() => study.signals.map((signal) => {
    let low = Infinity
    let high = -Infinity
    for (const { traces } of study.runs) {
      for (const value of traces[signal.id]) {
        if (value !== null) {
          low = Math.min(low, value)
          high = Math.max(high, value)
        }
      }
    }
    return low === Infinity ? [0, 1] : [low, high]
  }), [study])

  return <svg data-startup-traces viewBox={`0 0 ${width} ${height}`} width={width} height={height}
    role="img" aria-label="Sensor readings aligned to the start of each run"
    data-left={left} data-right={right} data-window-start={start} data-window-end={end}>
    {!compact && (width < 470 ? [0, .5, 1] : [0, .25, .5, .75, 1]).map((fraction) => {
      const time = start + (end - start) * fraction
      const position = x(time)
      return <g className="startup-grid" key={fraction}>
        <line x1={position} x2={position} y1={23} y2={plotBottom} />
        <text x={position} y={plotBottom + 15} textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>
          {axisNumber.format(time / divisor)}
        </text>
      </g>
    })}
    {signals.map(({ id, label, unit }, index) => {
      const [low, high] = ranges[index]
      const top = index * strip + (compact ? 4 : 23)
      const bottom = (index + 1) * strip - 10
      const y = (value: number) => high === low ? (top + bottom) / 2
        : bottom - 3 - (value - low) / (high - low) * (bottom - top - 6)
      const timedX = (pointIndex: number) => x(study.times[pointIndex])
      return <g key={id} data-startup-signal={id}>
        {!compact && <>
          <text className="startup-plot-title" x={left} y={top - 9}>{label}{unit ? ` (${unit})` : ''}</text>
          {high === low
            ? <text x={left - 5} y={(top + bottom) / 2} textAnchor="end">{axisNumber.format(low)}</text>
            : <>
              <text x={left - 5} y={top + 6} textAnchor="end">{axisNumber.format(high)}</text>
              <text x={left - 5} y={bottom} textAnchor="end">{axisNumber.format(low)}</text>
            </>}
        </>}
        <path className="startup-axis" d={`M${left},${top}V${bottom}H${right}`} />
        {!compact && study.runs.map((run) => <path key={run.id} data-startup-individual={run.id}
          d={linePath(run.traces[id], run.links[id], timedX, y)} />)}
        {summary.groups.map(({ outcome, traces }) => {
          const band = bandPath(traces[id], timedX, y)
          const median = linePath(traces[id].map((point) => point.median), traces[id].map((point) => point.linked > 0), timedX, y)
          return <g key={outcome} data-startup-outcome={outcome}>
            {band && <path data-startup-band d={band} />}
            {median && <path data-startup-median d={median} />}
          </g>
        })}
        <line className="startup-zero" x1={x(0)} x2={x(0)} y1={top} y2={bottom} data-startup-zero />
        {deadline >= start && deadline <= end &&
          <line className="startup-deadline" x1={x(deadline)} x2={x(deadline)} y1={top} y2={bottom} />}
        <path data-startup-selected={selected.id} d={linePath(selected.traces[id], selected.links[id], timedX, y)} />
      </g>
    })}
    {!compact && <text x={(left + right) / 2} y={plotBottom + 33} textAnchor="middle">
      Time from recorded start ({divisor === 60 ? 'min' : 's'})
    </text>}
  </svg>
}

export function StartupReadiness({ study, selected, summary, deadline, width, compact, select }: {
  study: PreparedStartupOverlay
  selected: AlignedStartupRun
  summary: StartupSummary
  deadline: number
  width: number
  compact: boolean
  select?: (id: string) => void
}) {
  const height = compact ? 49 : 116
  const baseline = height - (compact ? 5 : 34)
  const left = compact ? 6 : 45
  const right = width - (compact ? 6 : 11)
  const ordered = study.runs.map((run, i) => ({ run, outcome: summary.outcomes[i], time: run.readyAfter ?? run.followup }))
    .sort((a, b) => a.time - b.time)
  const horizon = Math.max(study.window[1], deadline, ordered.at(-1)?.time ?? 0)
  const x = (time: number) => left + time / horizon * (right - left)
  const scales = compact ? [0, 1] : [0, .25, .5, .75, 1]
  const divisor = horizon >= 360 ? 60 : 1
  const lanes = compact ? 3 : 4
  const placed: number[] = []
  const spacing = compact ? 9 : 14

  return <svg data-startup-readiness viewBox={`0 0 ${width} ${height}`} width={width} height={height}
    role="img" aria-label="Time to readiness by run"
    data-left={left} data-right={right} data-horizon={horizon}>
    <path className="startup-axis" d={`M${left},${baseline}H${right}`} />
    {!compact && scales.map((fraction) => <text key={fraction} x={x(horizon * fraction)} y={baseline + 16}
      textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{axisNumber.format(horizon * fraction / divisor)}</text>)}
    {!compact && <text x={(left + right) / 2} y={baseline + 31} textAnchor="middle">
      Elapsed time ({divisor === 60 ? 'min' : 's'})
    </text>}
    <line x1={x(deadline)} x2={x(deadline)} y1="2" y2={baseline} className="startup-deadline" data-startup-deadline />
    {ordered.map(({ run, outcome, time }, i) => {
      const position = x(time)
      let lane = placed.findIndex((previous) => position - previous >= 12)
      if (lane < 0) lane = placed.length < lanes ? placed.length : i % lanes
      placed[lane] = position
      const center = baseline - 8 - lane * spacing
      const active = run.id === selected.id
      const radius = compact ? 2.3 : 3.6
      return <g key={run.id} data-startup-run={run.id} data-startup-outcome={outcome}
        data-time={time} data-selected={active} data-observed={run.readyAfter !== undefined}
        onClick={select ? () => select(run.id) : undefined}>
        {run.readyAfter !== undefined
          ? <circle className="startup-readiness-mark" cx={position} cy={center} r={radius} />
          : <path className="startup-readiness-mark" d={`M${position},${center - radius}l${radius},${radius}l-${radius},${radius}l-${radius},-${radius}Z`} />}
        {!compact && <title>{run.label} · {axisNumber.format(time / divisor)} {divisor === 60 ? 'min' : 's'} · {outcomeLabels[outcome]}</title>}
        {!compact && <circle className="startup-hit" cx={position} cy={center} r="9" />}
      </g>
    })}
  </svg>
}
