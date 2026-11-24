export interface StartupSample {
  /** Seconds on the same clock as the run's event. */
  time: number
  value: number | null
}

export interface StartupSignal {
  id: string
  label: string
  unit?: string
  /** Largest interval eligible for interpolation, in seconds. Defaults to twice the grid step. */
  maxGap?: number
}

export interface StartupRun {
  id: string
  label: string
  eventTime: number
  readyTime?: number
  observedUntil: number
  /** Explicitly recorded failure to start. */
  failed?: boolean
  /** Samples must be in strictly increasing time order within each signal. */
  traces: Readonly<Record<string, readonly StartupSample[]>>
}

export interface StartupOverlayData {
  /** Elapsed seconds relative to the event. Include zero in the window. */
  window: readonly [number, number]
  step: number
  deadline: number
  signals: readonly StartupSignal[]
  runs: readonly StartupRun[]
}

export interface AlignedStartupRun {
  id: string
  label: string
  eventTime: number
  readyAfter?: number
  followup: number
  failed: boolean
  traces: Readonly<Record<string, readonly (number | null)[]>>
  /** Each entry tells whether the preceding grid point shares continuous raw support. */
  links: Readonly<Record<string, readonly boolean[]>>
}

export interface PreparedStartupOverlay extends Omit<StartupOverlayData, 'runs'> {
  runs: readonly AlignedStartupRun[]
  times: readonly number[]
}

export type StartupOutcome = 'on-time' | 'late' | 'not-ready' | 'censored' | 'failed'

export interface StartupQuantiles {
  count: number
  linked: number
  lower: number | null
  median: number | null
  upper: number | null
}

export interface StartupOutcomeGroup {
  outcome: StartupOutcome
  count: number
  traces: Readonly<Record<string, readonly StartupQuantiles[]>>
}

export interface StartupOverlaySummary {
  outcomes: readonly StartupOutcome[]
  groups: readonly StartupOutcomeGroup[]
}

const outcomes: readonly StartupOutcome[] = ['on-time', 'late', 'not-ready', 'censored', 'failed']
const maxGridPoints = 4000

function hasDistinctIds(entries: readonly { id: string; label: string }[]) {
  const ids = new Set<string>()
  for (const { id, label } of entries) {
    if (typeof id !== 'string' || !id.trim() || typeof label !== 'string' || !label.trim() || ids.has(id)) return false
    ids.add(id)
  }
  return true
}

function makeGrid([start, end]: StartupOverlayData['window'], step: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > 0 || end < 0 || start >= end ||
    !Number.isFinite(end - start) || !Number.isFinite(step) || step <= 0) return null

  const first = Math.ceil(start / step)
  const last = Math.floor(end / step)
  if (last - first + 1 > maxGridPoints) return null
  const times = [start === 0 ? 0 : start]
  for (let i = first; i <= last; i++) {
    const time = i === 0 ? 0 : i * step
    // Multiplying the step may round an interior limit onto a window boundary.
    const nearBoundary = Math.max(Math.abs(time), Math.abs(start), Math.abs(end)) * Number.EPSILON
    if (time > start && time < end &&
      (time === 0 || (time - start > nearBoundary && end - time > nearBoundary))) times.push(time)
  }
  times.push(end === 0 ? 0 : end)
  return times.length <= maxGridPoints ? times : null
}

function blend(left: number, right: number, fraction: number) {
  return left === right ? left : (1 - fraction) * left + fraction * right
}

function sameTime(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(Math.abs(left), Math.abs(right)) * Number.EPSILON
}

function gapFits(left: number, right: number, maxGap: number) {
  const gap = right - left
  const rounding = Math.max(Math.abs(left), Math.abs(right)) * Number.EPSILON
  return maxGap > 0 && Number.isFinite(gap) && gap - maxGap <= rounding
}

function alignTrace(samples: readonly StartupSample[], times: readonly number[], run: StartupRun, maxGap: number) {
  const segments: number[] = []
  let previous: StartupSample | undefined
  let segment = 0
  for (const sample of samples) {
    const { time, value } = sample
    if (!Number.isFinite(time) || (previous && time <= previous.time) || time > run.observedUntil ||
      (value !== null && !Number.isFinite(value))) return null
    if (value !== null && (!previous || previous.value === null || !gapFits(previous.time, time, maxGap))) segment++
    segments.push(value === null ? -1 : segment)
    previous = sample
  }

  let next = 0
  function at(target: number): readonly [number | null, number] {
    if (!Number.isFinite(target)) return [null, -1]
    while (next < samples.length && samples[next].time < target) next++
    const right = samples[next]
    const left = samples[next - 1]
    if (right?.time === target) return [right.value, segments[next]]
    // Adding a decimal offset to the event can round just past an exact sample.
    if (left && sameTime(left.time, target) &&
      (!right || target - left.time <= right.time - target)) return [left.value, segments[next - 1]]
    if (right && sameTime(right.time, target)) return [right.value, segments[next]]
    if (!right || !left || segments[next] !== segments[next - 1] ||
      left.value === null || right.value === null) return [null, -1]
    const value = blend(left.value, right.value, (target - left.time) / (right.time - left.time))
    return [value, segments[next]]
  }

  const links: boolean[] = []
  let previousSegment = -1
  const values = times.map((offset) => {
    const [value, segment] = at(run.eventTime + offset)
    links.push(segment >= 0 && segment === previousSegment)
    previousSegment = segment
    return value
  })
  return { values, links }
}

export function prepareStartupOverlay(data: StartupOverlayData): PreparedStartupOverlay | null {
  const times = makeGrid(data.window, data.step)
  if (!times || !Number.isFinite(data.deadline) || data.deadline < 0 ||
    !data.runs.length || !data.signals.length ||
    !hasDistinctIds(data.runs) || !hasDistinctIds(data.signals)) return null
  for (const { maxGap } of data.signals) {
    if (maxGap !== undefined && (!Number.isFinite(maxGap) || maxGap < 0)) return null
  }

  const runs: AlignedStartupRun[] = []
  for (const run of data.runs) {
    const { id, label, eventTime, readyTime, observedUntil, failed = false } = run
    const followup = observedUntil - eventTime
    const readyAfter = readyTime === undefined ? undefined : readyTime - eventTime
    if (!Number.isFinite(eventTime) || !Number.isFinite(observedUntil) || !Number.isFinite(followup) ||
      followup < 0 || typeof failed !== 'boolean' ||
      (readyAfter !== undefined && (!Number.isFinite(readyAfter) || readyAfter < 0 || readyAfter > followup || failed))) {
      return null
    }

    const traces: [string, readonly (number | null)[]][] = []
    const links: [string, readonly boolean[]][] = []
    for (const signal of data.signals) {
      const samples = Object.hasOwn(run.traces, signal.id) ? run.traces[signal.id] : []
      const aligned = alignTrace(samples, times, run, signal.maxGap ?? data.step * 2)
      if (!aligned) return null
      traces.push([signal.id, aligned.values])
      links.push([signal.id, aligned.links])
    }
    runs.push({
      id, label, eventTime, readyAfter, followup, failed,
      traces: Object.fromEntries(traces), links: Object.fromEntries(links),
    })
  }

  return { window: data.window, step: data.step, deadline: data.deadline, signals: data.signals, runs, times }
}

export function startupOutcome(run: AlignedStartupRun, deadline: number): StartupOutcome {
  if (run.failed) return 'failed'
  // Compare on the recorded clock so a decimal event offset can land exactly on the cutoff.
  const cutoff = run.eventTime + deadline
  if (run.readyAfter !== undefined) return run.eventTime + run.readyAfter <= cutoff ? 'on-time' : 'late'
  return run.eventTime + run.followup >= cutoff ? 'not-ready' : 'censored'
}

function typeSeven(sorted: readonly number[], probability: number) {
  const position = (sorted.length - 1) * probability
  const index = Math.floor(position)
  const fraction = position - index
  return fraction === 0 ? sorted[index] : blend(sorted[index], sorted[index + 1], fraction)
}

export function summarizeStartupOverlay(prepared: PreparedStartupOverlay, deadline = prepared.deadline): StartupOverlaySummary {
  const classifications = prepared.runs.map((run) => startupOutcome(run, deadline))
  const groups: StartupOutcomeGroup[] = []
  for (const outcome of outcomes) {
    const runs = prepared.runs.filter((_, i) => classifications[i] === outcome)
    if (!runs.length) continue

    const traces = prepared.signals.map(({ id }) => [id, prepared.times.map((_, i): StartupQuantiles => {
      const values: number[] = []
      let linked = 0
      for (const run of runs) {
        const value = run.traces[id][i]
        if (value !== null) values.push(value)
        if (run.links[id][i]) linked++
      }
      if (!values.length) return { count: 0, linked, lower: null, median: null, upper: null }
      values.sort((left, right) => left - right)
      return {
        count: values.length,
        linked,
        lower: typeSeven(values, 0.25),
        median: typeSeven(values, 0.5),
        upper: typeSeven(values, 0.75),
      }
    })] as const)
    groups.push({ outcome, count: runs.length, traces: Object.fromEntries(traces) })
  }
  return { outcomes: classifications, groups }
}
