import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { FaultReplayTimeline, formatReplayElapsed } from './FaultReplayTimeline'
import { prepareFaultReplay, readFaultReplay, replayNearestIndex } from './model'
import type { FaultReplayData, FaultReplayReading, PreparedFaultReplay } from './model'
import './fault-replay.css'

export interface FaultReplayProps {
  data: FaultReplayData
  title?: string
  initialTime?: number
  caption?: ReactNode
  compact?: boolean
}

const valueLabel = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const speeds = [1, 10, 60, 300, 600]

function ReplaySnapshot({ replay, reading }: { replay: PreparedFaultReplay; reading: FaultReplayReading }) {
  const { time, signals, state, alarms, lastActions } = reading
  return <section className="fault-replay-evidence" aria-label="Evidence at the cursor" data-replay-snapshot
    data-time={time} data-state={state?.id} data-alarm-count={alarms.length}>
    <h3>At the cursor</h3>
    <dl className="fault-replay-measurements">
      {signals.map(({ sample, stale }, i) => {
        const signal = replay.signals[i]
        const value = sample?.value
        const status = !sample ? 'absent' : value === null ? 'missing' : stale ? 'stale' : 'recorded'
        return <div key={signal.id} data-replay-reading={signal.id} data-status={status} data-sample-time={sample?.time}
          data-value={status === 'recorded' ? value ?? undefined : undefined}>
          <dt>{signal.label}</dt>
          <dd className="fault-replay-value">{status === 'recorded' && value != null
            ? <>{valueLabel.format(value)} <span>{signal.unit}</span></>
            : { absent: 'No earlier reading', missing: 'Missing reading', stale: 'Stale reading', recorded: '' }[status]}</dd>
          {sample && <dd className="fault-replay-reading-time">Recorded {formatReplayElapsed(sample.time - replay.start)}
            {time !== sample.time && <> ({valueLabel.format(time - sample.time)} s earlier)</>}</dd>}
        </div>
      })}
    </dl>
    <dl className="fault-replay-state-summary">
      <div><dt>Machine state</dt><dd>{state ? state.label : 'No state recorded'}</dd></div>
      <div><dt>Active alarms</dt><dd>{alarms.length ? <ul>{alarms.map((alarm) =>
        <li key={alarm.id} data-replay-active-alarm={alarm.id}>{alarm.label}</li>)}</ul> : 'None'}</dd></div>
      <div><dt>Last operator action</dt><dd>{lastActions.length ? <ul>{lastActions.map((action) =>
        <li key={action.id} data-replay-last-action={action.id}>{action.label} <time>{formatReplayElapsed(action.time - replay.start)}</time></li>)}
      </ul> : 'None before the cursor'}</dd></div>
    </dl>
  </section>
}

function ReplayLedger({ replay, time, seek }: {
  replay: PreparedFaultReplay
  time: number
  seek: (time: number) => void
}) {
  const entries = useMemo(() => [
    ...replay.states.map((state) => ({
      ...state, key: `state:${state.id}`, time: state.start, kind: 'State',
    })),
    ...replay.states.filter(({ end }) => end !== undefined && !replay.states.some(({ start }) => start === end))
      .map((state) => ({
        ...state, key: `state-end:${state.id}`, time: state.end ?? replay.end, kind: 'State ended',
      })),
    ...replay.alarms.flatMap((alarm) => [
      { ...alarm, key: `raised:${alarm.id}`, time: alarm.start, kind: 'Alarm raised' },
      ...(alarm.end === undefined ? [] : [{ ...alarm, key: `cleared:${alarm.id}`, time: alarm.end, kind: 'Alarm cleared' }]),
    ]),
    ...replay.actions.map((action) => ({ ...action, key: `action:${action.id}`, kind: 'Operator action' })),
  ].sort((a, b) => a.time - b.time), [replay])

  if (!entries.length) return null
  return <section className="fault-replay-ledger" aria-label="Incident event log">
    <h3>Event log</h3>
    <ol>
      {entries.map((entry) => <li key={entry.key}>
        <button type="button" data-replay-event={entry.key} data-time={entry.time}
          data-kind={entry.kind} aria-current={entry.time === time ? 'time' : undefined}
          onClick={() => seek(entry.time)}>
          <time>{formatReplayElapsed(entry.time - replay.start)}</time>
          <span><span className="fault-replay-event-kind">{entry.kind}</span>
            <strong>{entry.label}</strong>
            {entry.detail && <span className="fault-replay-event-detail">{entry.detail}</span>}
          </span>
        </button>
      </li>)}
    </ol>
  </section>
}

function ReplayFigure({ replay, title, initialTime, caption, compact = false }:
  Omit<FaultReplayProps, 'data'> & { replay: PreparedFaultReplay }) {
  const [position, setPosition] = useState<number>()
  const [clock, setClock] = useState<{ time: number; wall: number }>()
  const [speed, setSpeed] = useState(60)
  const requested = position ?? initialTime ?? replay.start
  const index = replayNearestIndex(replay.times, Number.isFinite(requested) ? requested : replay.start)
  const reading = readFaultReplay(replay, index)
  const previousEvent = replay.eventIndices.filter((event) => event < index).at(-1)
  const nextEvent = replay.eventIndices.find((event) => event > index)
  const elapsed = formatReplayElapsed(reading.time - replay.start)
  const duration = formatReplayElapsed(replay.end - replay.start)
  const liveClock = compact ? undefined : clock

  useEffect(() => {
    if (!liveClock) return
    let frame: number
    function tick(wall: number) {
      if (!liveClock) return
      const target = Math.min(replay.end, liveClock.time + Math.max(0, wall - liveClock.wall) / 1000 * speed)
      const nearest = replayNearestIndex(replay.times, target)
      const current = replay.times[nearest] <= target ? nearest : Math.max(0, nearest - 1)
      setPosition(replay.times[current])
      if (target === replay.end) setClock(undefined)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [liveClock, speed, replay])

  function seek(time: number) {
    setClock(undefined)
    setPosition(replay.times[replayNearestIndex(replay.times, time)])
  }

  function togglePlayback() {
    if (clock) {
      setClock(undefined)
      return
    }
    const time = reading.time === replay.end ? replay.start : reading.time
    setPosition(time)
    setClock({ time, wall: performance.now() })
  }

  return <figure className="fault-replay" data-fault-replay data-compact={compact} data-playing={!!liveClock}
    aria-label={title}>
    {!compact && <section className="fault-replay-transport" aria-label="Replay controls">
      <div className="fault-replay-controls">
        <div className="fault-replay-buttons">
          <button type="button" aria-label="Previous event" disabled={previousEvent === undefined}
            onClick={() => previousEvent !== undefined && seek(replay.times[previousEvent])}>Previous event</button>
          <button type="button" className="fault-replay-play" onClick={togglePlayback}>
            {liveClock ? 'Pause replay' : 'Play replay'}
          </button>
          <button type="button" aria-label="Next event" disabled={nextEvent === undefined}
            onClick={() => nextEvent !== undefined && seek(replay.times[nextEvent])}>Next event</button>
        </div>
        <label className="fault-replay-speed">Speed
          <select aria-label="Speed" value={speed} onChange={(event) => {
            setSpeed(Number(event.currentTarget.value))
            if (clock) setClock({ time: reading.time, wall: performance.now() })
          }}>
            {speeds.map((value) => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
      </div>
      <label className="fault-replay-scrub">
        <span>Elapsed time <output aria-live="off" data-replay-clock>{elapsed} / {duration}</output></span>
        <input type="range" min="0" max={replay.times.length - 1} value={index} step="1"
          aria-label="Replay time" aria-valuetext={`${elapsed} of ${duration}`}
          onChange={(event) => seek(replay.times[Number(event.currentTarget.value)])} />
      </label>
    </section>}
    <FaultReplayTimeline replay={replay} reading={reading} compact={compact} seek={compact ? undefined : seek} />
    {!compact && <>
      <ReplaySnapshot replay={replay} reading={reading} />
      <ReplayLedger replay={replay} time={reading.time} seek={seek} />
      {caption && <figcaption>{caption}</figcaption>}
    </>}
  </figure>
}

export function FaultReplay({ data, title = 'Fault-event replay', ...props }: FaultReplayProps) {
  const replay = useMemo(() => prepareFaultReplay(data), [data])
  if (!replay) return <p role="status">Provide a valid replay window, unique source records, and non-overlapping machine states.</p>
  return <ReplayFigure {...props} title={title} replay={replay} />
}
