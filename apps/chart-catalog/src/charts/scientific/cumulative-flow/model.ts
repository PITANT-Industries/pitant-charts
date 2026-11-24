export interface FlowStage {
  id: string
  label: string
}

export interface FlowEvent {
  /** Seconds on the chart's clock. Preserve source order for tied timestamps. */
  time: number
  jobId: string
  /** The next stage. Null records completion and closes the job. */
  stage: string | null
}

export interface FlowInitialJob {
  jobId: string
  stage: string
  enteredAt: number
}

export interface CumulativeFlowData {
  start: number
  end: number
  stages: readonly FlowStage[]
  events: readonly FlowEvent[]
  /** Jobs already present at the opening of the observation window. */
  initial?: readonly FlowInitialJob[]
}

export interface FlowPoint {
  time: number
  admitted: number
  completed: number
  /** Arrays follow the order of the declared stages. */
  wip: readonly number[]
  /** Cumulative stage entries and exits since the window opened. */
  entered: readonly number[]
  exited: readonly number[]
}

export interface FlowVisit {
  jobId: string
  stage: string
  enteredAt: number
  exitedAt?: number
}

export interface PreparedCumulativeFlow {
  start: number
  end: number
  stages: readonly FlowStage[]
  points: readonly FlowPoint[]
  visits: readonly FlowVisit[]
}

interface ActiveFlowJob {
  stageIndex: number
  visit: FlowVisit
}

export function prepareCumulativeFlow(data: CumulativeFlowData): PreparedCumulativeFlow | null {
  const { start, end, stages } = data
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
    !Number.isFinite(end - start) || stages.length === 0) return null

  const stageIndices = new Map<string, number>()
  for (const [index, { id, label }] of stages.entries()) {
    if (typeof id !== 'string' || !id.trim() || stageIndices.has(id) ||
      typeof label !== 'string' || !label.trim()) return null
    stageIndices.set(id, index)
  }

  const wip = stages.map(() => 0)
  const entered = stages.map(() => 0)
  const exited = stages.map(() => 0)
  const visits: FlowVisit[] = []
  const active = new Map<string, ActiveFlowJob>()
  const finished = new Set<string>()

  function openVisit(jobId: string, stage: string, stageIndex: number, enteredAt: number) {
    const visit = { jobId, stage, enteredAt }
    visits.push(visit)
    active.set(jobId, { stageIndex, visit })
    wip[stageIndex]++
  }

  for (const { jobId, stage, enteredAt } of data.initial ?? []) {
    const stageIndex = stageIndices.get(stage)
    if (typeof jobId !== 'string' || !jobId.trim() || active.has(jobId) ||
      stageIndex === undefined || !Number.isFinite(enteredAt) || enteredAt > start ||
      !Number.isFinite(end - enteredAt)) return null
    openVisit(jobId, stage, stageIndex, enteredAt)
  }

  let admitted = active.size
  const points: FlowPoint[] = []
  function appendPoint(time: number) {
    points.push({ time, admitted, completed: finished.size, wip: [...wip], entered: [...entered], exited: [...exited] })
  }

  // Stable sorting keeps a job's explicitly supplied sequence at the same timestamp.
  const events = [...data.events].sort((a, b) => a.time - b.time)
  let time = start
  for (const event of events) {
    const { jobId, stage } = event
    if (!Number.isFinite(event.time) || event.time < start || event.time > end ||
      typeof jobId !== 'string' || !jobId.trim() || finished.has(jobId)) return null
    const previous = active.get(jobId)
    const stageIndex = stage === null ? undefined : stageIndices.get(stage)
    if ((stage === null && !previous) || (stage !== null && stageIndex === undefined) ||
      (previous && stageIndex === previous.stageIndex)) return null

    if (event.time !== time) {
      appendPoint(time)
      time = event.time
    }
    if (previous) {
      previous.visit.exitedAt = time
      wip[previous.stageIndex]--
      exited[previous.stageIndex]++
    } else {
      admitted++
    }

    if (stage === null) {
      active.delete(jobId)
      finished.add(jobId)
    } else if (stageIndex !== undefined) {
      openVisit(jobId, stage, stageIndex, time)
      entered[stageIndex]++
    }
  }

  appendPoint(time)
  if (time !== end) appendPoint(end)
  return { start, end, stages, points, visits }
}

export function flowPointIndex(points: readonly FlowPoint[], time: number): number {
  if (!points.length) return -1
  let first = 0
  let last = points.length
  while (first < last) {
    const middle = first + Math.floor((last - first) / 2)
    if (points[middle].time < time) first = middle + 1
    else last = middle
  }
  if (first === 0) return 0
  if (first === points.length) return points.length - 1
  return time - points[first - 1].time <= points[first].time - time ? first - 1 : first
}

export function flowStageJobs(flow: PreparedCumulativeFlow, time: number, stageId: string):
  readonly { jobId: string; enteredAt: number; age: number }[] {
  if (!Number.isFinite(time) || time < flow.start || time > flow.end) return []
  return flow.visits
    .filter(({ stage, enteredAt, exitedAt }) =>
      stage === stageId && enteredAt <= time && (exitedAt === undefined || time < exitedAt))
    .map(({ jobId, enteredAt }) => ({ jobId, enteredAt, age: time - enteredAt }))
    .sort((a, b) => a.enteredAt - b.enteredAt)
}
