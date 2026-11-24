import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { FaultReplayReading, PreparedFaultReplay } from './model'

const quantity = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })

export function formatReplayElapsed(seconds: number, precision = 3) {
  const factor = 10 ** precision
  const ticks = Math.round(seconds * factor)
  const whole = Math.floor(ticks / factor)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor(whole / 60) % 60
  const tail = String(whole % 60).padStart(2, '0')
  const fraction = ticks % factor
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${tail}${fraction ? `.${String(fraction).padStart(precision, '0')}` : ''}`
}

export function FaultReplayTimeline({ replay, reading, compact, seek }: {
  replay: PreparedFaultReplay
  reading: FaultReplayReading
  compact: boolean
  seek?: (time: number) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const activePointer = useRef<number>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const container = host.current
    if (!container) return
    const resize = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    resize.observe(container)
    return () => resize.disconnect()
  }, [])

  const count = compact ? Math.min(3, replay.signals.length) : replay.signals.length
  const traces = useMemo(() => replay.signals.slice(0, count).map((signal) => {
    let minimum = Infinity
    let maximum = -Infinity
    for (const segment of signal.segments) {
      for (const { value } of segment) {
        minimum = Math.min(minimum, value)
        maximum = Math.max(maximum, value)
      }
    }
    if (minimum === Infinity) return { signal, minimum: 0, maximum: 1 }
    return { signal, minimum, maximum }
  }), [replay, count])

  const left = compact ? 5 : 50
  const right = Math.max(left + 1, width - (compact ? 5 : 10))
  const strip = compact ? 54 : 106
  const lane = compact ? 12 : 24
  const rowStart = compact ? 6 : 11
  const stateTop = rowStart + traces.length * strip + 4
  const alarmTop = stateTop + lane
  const alarmCount = Math.max(1, replay.alarmLanes.length)
  const actionTop = alarmTop + alarmCount * lane
  const bottom = actionTop + lane
  const height = bottom + (compact ? 4 : 42)
  const duration = replay.end - replay.start
  const x = (time: number) => left + (time - replay.start) / duration * (right - left)
  const cursor = x(reading.time)
  const fractions = width < 450 ? [0, .5, 1] : [0, .25, .5, .75, 1]

  function seekPointer(event: PointerEvent<SVGSVGElement>) {
    const transform = event.currentTarget.getScreenCTM()
    if (!seek || !transform) return
    const { x: position } = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
    const fraction = Math.max(0, Math.min(1, (position - left) / (right - left)))
    seek(replay.start + fraction * duration)
  }

  return <div ref={host} className="fault-replay-timeline">
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
      aria-label="Aligned process signals, machine states, alarms, and operator actions"
      data-replay-timeline data-left={left} data-right={right} data-start={replay.start} data-end={replay.end}
      onPointerDown={seek ? (event) => {
        if (event.button !== 0 || !event.isPrimary) return
        activePointer.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        seekPointer(event)
      } : undefined}
      onPointerMove={seek ? (event) => {
        if (activePointer.current === event.pointerId) seekPointer(event)
      } : undefined}
      onLostPointerCapture={seek ? () => { activePointer.current = null } : undefined}>
      {!compact && fractions.map((fraction) => {
        const position = x(replay.start + duration * fraction)
        return <g key={fraction} className="fault-replay-grid">
          <line x1={position} x2={position} y1={rowStart + 24} y2={bottom} />
          <text x={position} y={bottom + 15} textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>
            {formatReplayElapsed(duration * fraction, duration < 10 ? 1 : 0)}
          </text>
        </g>
      })}
      {traces.map(({ signal, minimum, maximum }, index) => {
        const top = rowStart + strip * index + (compact ? 2 : 24)
        const base = rowStart + strip * (index + 1) - 5
        const same = minimum === maximum
        const y = (value: number) => same ? (top + base) / 2 : base - 3 - (value - minimum) / (maximum - minimum) * (base - top - 6)
        const current = reading.signals[index]
        return <g key={signal.id} data-replay-signal={signal.id} data-series={index % 3}>
          {!compact && <>
            <text className="fault-replay-plot-label" x={left} y={top - 10}>{signal.label}{signal.unit ? ` (${signal.unit})` : ''}</text>
            {same
              ? <text className="fault-replay-axis" x={left - 6} y={(top + base) / 2 + 4} textAnchor="end">{quantity.format(minimum)}</text>
              : <>
                <text className="fault-replay-axis" x={left - 6} y={top + 5} textAnchor="end">{quantity.format(maximum)}</text>
                <text className="fault-replay-axis" x={left - 6} y={base} textAnchor="end">{quantity.format(minimum)}</text>
              </>}
          </>}
          <path className="fault-replay-axis-line" d={`M${left},${top}V${base}H${right}`} />
          {signal.segments.map((segment) => segment.length === 1
            ? <circle key={segment[0].time} data-replay-trace cx={x(segment[0].time)} cy={y(segment[0].value)} r="2" />
            : <path key={segment[0].time} data-replay-trace d={segment.map(({ time, value }, i) => `${i ? 'L' : 'M'}${x(time).toFixed(3)},${y(value).toFixed(3)}`).join(' ')} />)}
          <path className="fault-replay-cursor" d={`M${cursor},${top}V${base}`} />
          {current.sample?.value != null && !current.stale && <circle className="fault-replay-reading-marker"
            cx={x(current.sample.time)} cy={y(current.sample.value)} r={compact ? 2.5 : 3} />}
        </g>
      })}
      {!compact && <>
        <text className="fault-replay-axis" x={left - 7} y={stateTop + 16} textAnchor="end">State</text>
        <text className="fault-replay-axis" x={left - 7} y={alarmTop + 16} textAnchor="end">Alarms</text>
        <text className="fault-replay-axis" x={left - 7} y={actionTop + 16} textAnchor="end">Actions</text>
        <text className="fault-replay-axis" x={(left + right) / 2} y={bottom + 33} textAnchor="middle">Elapsed time</text>
      </>}
      {[stateTop, alarmTop, actionTop, bottom].map((position) =>
        <line key={position} className="fault-replay-lane-line" x1={left} x2={right} y1={position} y2={position} />)}
      {replay.states.map((state, i) => {
        const start = x(state.start)
        const length = x(state.end ?? replay.end) - start
        return <g key={state.id} data-replay-state-mark={state.id} data-phase={i % 2}>
          <rect x={start} width={length} y={stateTop + 2} height={lane - 4} />
          {!compact && length >= state.label.length * 6 + 10 &&
            <text x={start + 5} y={stateTop + 16}>{state.label}</text>}
        </g>
      })}
      {replay.alarmLanes.flatMap((alarms, index) => alarms.map((alarm) =>
        <rect key={alarm.id} className="fault-replay-alarm-mark" data-replay-alarm-mark={alarm.id}
          x={x(alarm.start)} width={x(alarm.end ?? replay.end) - x(alarm.start)}
          y={alarmTop + lane * index + 3} height={lane - 6} />
      ))}
      {replay.actions.map((action) => {
        const center = actionTop + lane / 2
        const radius = compact ? 2.5 : 4
        const position = x(action.time)
        return <path key={action.id} data-replay-action-mark={action.id}
          d={`M${position},${center - radius}l${radius},${radius}l-${radius},${radius}l-${radius},-${radius}Z`} />
      })}
      <line className="fault-replay-cursor" x1={cursor} x2={cursor} y1={stateTop} y2={bottom}
        data-replay-cursor data-time={reading.time} />
    </svg>
  </div>
}
