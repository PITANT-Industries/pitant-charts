export interface FaultReplaySample {
  time: number
  /** Null marks a missing measurement. */
  value: number | null
}

export interface FaultReplaySignal {
  id: string
  label: string
  unit?: string
  samples: readonly FaultReplaySample[]
  /** Maximum seconds a reading can be held or a trace can connect across. */
  maxAge?: number
}

export interface FaultReplayState {
  id: string
  label: string
  start: number
  /** Exclusive end. Omit for an interval still active at the window's end. */
  end?: number
  detail?: string
}

export type FaultReplayAlarm = FaultReplayState

export interface FaultReplayAction {
  id: string
  label: string
  time: number
  detail?: string
}

export interface FaultReplayData {
  /** Inclusive window bounds, in seconds on the same clock as the records. */
  start: number
  end: number
  signals: readonly FaultReplaySignal[]
  states: readonly FaultReplayState[]
  alarms: readonly FaultReplayAlarm[]
  actions: readonly FaultReplayAction[]
}

export interface PreparedFaultReplaySignal extends FaultReplaySignal {
  segments: readonly (readonly { time: number; value: number }[])[]
}

export interface PreparedFaultReplay extends FaultReplayData {
  signals: readonly PreparedFaultReplaySignal[]
  alarmLanes: readonly (readonly FaultReplayAlarm[])[]
  times: readonly number[]
  eventIndices: readonly number[]
}

export interface FaultReplayReading {
  time: number
  state: FaultReplayState | undefined
  alarms: readonly FaultReplayAlarm[]
  lastActions: readonly FaultReplayAction[]
  signals: readonly { sample: FaultReplaySample | undefined; stale: boolean }[]
}

function hasDistinctIds(records: readonly { id: string; label: string }[]) {
  const ids = new Set<string>()
  for (const { id, label } of records) {
    if (typeof id !== 'string' || !id.trim() || ids.has(id) ||
      typeof label !== 'string' || !label.trim()) return false
    ids.add(id)
  }
  return true
}

function prepareSignal(
  signal: FaultReplaySignal,
  start: number,
  end: number,
): PreparedFaultReplaySignal | null {
  if (signal.maxAge !== undefined && (!Number.isFinite(signal.maxAge) || signal.maxAge < 0)) return null

  const samples = [...signal.samples].sort((left, right) => left.time - right.time)
  const segments: { time: number; value: number }[][] = []
  let segment: { time: number; value: number }[] | undefined
  let previousTime = -Infinity
  const maxAge = signal.maxAge ?? Infinity
  for (const { time, value } of samples) {
    if (!Number.isFinite(time) || time < start || time > end || time === previousTime ||
      (value !== null && !Number.isFinite(value))) return null

    if (value === null) {
      segment = undefined
    } else {
      if (!segment || time - previousTime > maxAge) {
        segment = []
        segments.push(segment)
      }
      segment.push({ time, value })
    }
    previousTime = time
  }
  return { ...signal, samples, segments }
}

export function prepareFaultReplay(data: FaultReplayData): PreparedFaultReplay | null {
  const { start, end } = data
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
    !hasDistinctIds(data.signals) || !hasDistinctIds(data.states) ||
    !hasDistinctIds(data.alarms) || !hasDistinctIds(data.actions)) return null

  const signals: PreparedFaultReplaySignal[] = []
  for (const signal of data.signals) {
    const prepared = prepareSignal(signal, start, end)
    if (!prepared) return null
    signals.push(prepared)
  }

  const states = [...data.states].sort((left, right) => left.start - right.start)
  const alarms = [...data.alarms].sort((left, right) => left.start - right.start)
  const actions = [...data.actions].sort((left, right) => left.time - right.time)
  const eventTimes = new Set<number>()
  for (const event of [...states, ...alarms]) {
    if (!Number.isFinite(event.start) || event.start < start || event.start > end ||
      (event.end !== undefined && (!Number.isFinite(event.end) || event.end <= event.start || event.end > end))) return null
    eventTimes.add(event.start)
    if (event.end !== undefined) eventTimes.add(event.end)
  }

  let stateEnd = start
  for (const state of states) {
    if (state.start < stateEnd) return null
    stateEnd = state.end ?? Infinity
  }

  for (const action of actions) {
    if (!Number.isFinite(action.time) || action.time < start || action.time > end) return null
    eventTimes.add(action.time)
  }

  const alarmLanes: FaultReplayAlarm[][] = []
  for (const alarm of alarms) {
    const lane = alarmLanes.find((candidate) => (candidate.at(-1)?.end ?? Infinity) <= alarm.start)
    if (lane) lane.push(alarm)
    else alarmLanes.push([alarm])
  }

  const playbackTimes = new Set([start, end, ...eventTimes])
  for (const signal of signals) {
    for (const sample of signal.samples) playbackTimes.add(sample.time)
  }
  const times = [...playbackTimes].sort((left, right) => left - right)
  const eventIndices = times.flatMap((time, index) => eventTimes.has(time) ? [index] : [])
  return { start, end, signals, states, alarms, actions, alarmLanes, times, eventIndices }
}

/** Return the index of the first record strictly after the target time. */
function after<T>(records: readonly T[], target: number, timeOf: (record: T) => number) {
  let low = 0
  let high = records.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (timeOf(records[middle]) <= target) low = middle + 1
    else high = middle
  }
  return low
}

export function replayNearestIndex(times: readonly number[], time: number): number {
  const right = after(times, time, (point) => point)
  if (right === 0) return 0
  if (right === times.length) return right - 1
  return time - times[right - 1] <= times[right] - time ? right - 1 : right
}

export function readFaultReplay(replay: PreparedFaultReplay, index: number): FaultReplayReading {
  const time = replay.times[index] ?? replay.start
  const recentState = replay.states[after(replay.states, time, (state) => state.start) - 1]
  const state = recentState && time < (recentState.end ?? Infinity) ? recentState : undefined
  const alarms = replay.alarms.filter((alarm) => alarm.start <= time && time < (alarm.end ?? Infinity))

  const actionEnd = after(replay.actions, time, (action) => action.time)
  const actionTime = replay.actions[actionEnd - 1]?.time
  let actionStart = actionEnd
  while (actionStart > 0 && replay.actions[actionStart - 1].time === actionTime) actionStart--

  const signals = replay.signals.map((signal) => {
    const sample = signal.samples[after(signal.samples, time, (point) => point.time) - 1]
    return {
      sample,
      stale: sample !== undefined && time - sample.time > (signal.maxAge ?? Infinity),
    }
  })

  return {
    time,
    state,
    alarms,
    lastActions: replay.actions.slice(actionStart, actionEnd),
    signals,
  }
}
