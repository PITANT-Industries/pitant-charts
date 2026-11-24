export interface TaktStation {
  id: string
  label: string
}

export interface TaktTask {
  id: string
  label: string
  shortLabel?: string
  seconds: number
  stationId: string
  predecessors?: readonly string[]
  allowedStations?: readonly string[]
}

export interface TaktBalanceData {
  availableSeconds: number
  demand: number
  /** Station order follows the production line. */
  stations: readonly TaktStation[]
  tasks: readonly TaktTask[]
}

export type TaktAssignment = Readonly<Record<string, string>>

export interface PreparedTaktBalance extends TaktBalanceData {
  takt: number
  /** Work elements in stable topological order. */
  tasks: readonly TaktTask[]
  initial: TaktAssignment
}

function hasLabel(value: string) {
  return typeof value === 'string' && value.trim().length > 0
}

function stationIndices(stations: readonly TaktStation[]) {
  return new Map(stations.map(({ id }, index) => [id, index]))
}

function totalSeconds(tasks: readonly TaktTask[]) {
  let total = 0
  let correction = 0
  // Compensate for rounding when many measured durations share a station.
  for (const { seconds } of tasks) {
    const adjusted = seconds - correction
    const next = total + adjusted
    if (!Number.isFinite(next)) return next
    correction = (next - total) - adjusted
    total = next
  }
  return total
}

export function prepareTaktBalance(data: TaktBalanceData): PreparedTaktBalance | null {
  const { availableSeconds, demand, stations, tasks } = data
  const takt = availableSeconds / demand
  if (!Number.isFinite(availableSeconds) || availableSeconds <= 0 ||
    !Number.isInteger(demand) || demand <= 0 ||
    !Number.isFinite(takt) || takt <= 0 || !stations.length || !tasks.length) return null

  const ranks = stationIndices(stations)
  if (ranks.size !== stations.length || stations.some(({ id, label }) => !hasLabel(id) || !hasLabel(label))) return null

  const taskIndices = new Map<string, number>()
  for (const [index, task] of tasks.entries()) {
    const { id, label, shortLabel, seconds, stationId, allowedStations } = task
    if (!hasLabel(id) || !hasLabel(label) || taskIndices.has(id) ||
      (shortLabel !== undefined && typeof shortLabel !== 'string') ||
      !Number.isFinite(seconds) || seconds < 0 || !ranks.has(stationId)) return null
    if (allowedStations && (new Set(allowedStations).size !== allowedStations.length ||
      allowedStations.some((station) => !ranks.has(station)) || !allowedStations.includes(stationId))) return null
    taskIndices.set(id, index)
  }

  const remaining = tasks.map(({ predecessors }) => predecessors?.length ?? 0)
  const successors: number[][] = tasks.map(() => [])
  for (const [index, task] of tasks.entries()) {
    const predecessors = task.predecessors ?? []
    if (new Set(predecessors).size !== predecessors.length) return null
    for (const id of predecessors) {
      const predecessor = taskIndices.get(id)
      if (predecessor === undefined || ranks.get(tasks[predecessor].stationId)! > ranks.get(task.stationId)!) return null
      successors[predecessor].push(index)
    }
  }

  // Keep ready tasks in descending source order so pop() takes the earliest one.
  const ready = tasks.map((_, index) => index).filter((index) => remaining[index] === 0).reverse()
  const ordered: TaktTask[] = []
  while (ready.length) {
    const index = ready.pop()!
    const task = tasks[index]
    ordered.push(task)
    for (const successor of successors[index]) {
      remaining[successor]--
      if (remaining[successor] !== 0) continue
      const later = ready.findIndex((candidate) => candidate < successor)
      ready.splice(later === -1 ? ready.length : later, 0, successor)
    }
  }
  if (ordered.length !== tasks.length || !Number.isFinite(totalSeconds(ordered))) return null

  const initial = Object.fromEntries(tasks.map(({ id, stationId }) => [id, stationId]))
  return { availableSeconds, demand, takt, stations, tasks: ordered, initial }
}

function assignedRank(ranks: ReadonlyMap<string, number>, assignment: TaktAssignment, task: TaktTask) {
  return ranks.get(assignment[task.id]) ?? ranks.get(task.stationId)!
}

export function getTaktDestinations(study: PreparedTaktBalance, assignment: TaktAssignment, taskId: string): readonly string[] {
  const task = study.tasks.find(({ id }) => id === taskId)
  if (!task) return []

  const ranks = stationIndices(study.stations)
  const predecessors = new Set(task.predecessors)
  let earliest = 0
  let latest = study.stations.length - 1
  for (const other of study.tasks) {
    if (predecessors.has(other.id)) earliest = Math.max(earliest, assignedRank(ranks, assignment, other))
    if (other.predecessors?.includes(taskId)) latest = Math.min(latest, assignedRank(ranks, assignment, other))
  }

  return study.stations
    .slice(earliest, latest + 1)
    .filter(({ id }) => !task.allowedStations || task.allowedStations.includes(id))
    .map(({ id }) => id)
}

export function summarizeTaktBalance(study: PreparedTaktBalance, assignment: TaktAssignment) {
  const ranks = stationIndices(study.stations)
  const assignedTasks: TaktTask[][] = study.stations.map(() => [])
  for (const task of study.tasks) {
    assignedTasks[assignedRank(ranks, assignment, task)].push(task)
  }

  let maxLoad = 0
  let overloaded = 0
  const stations = study.stations.map((station, index) => {
    const tasks: readonly TaktTask[] = assignedTasks[index]
    const load = totalSeconds(tasks)
    maxLoad = Math.max(maxLoad, load)
    const difference = study.takt - load
    // Normalize floating-point noise at a mathematical tie with takt.
    const margin = Math.abs(difference) <= Number.EPSILON * Math.max(study.takt, load) ? 0 : difference
    if (margin < 0) overloaded++
    return { station, tasks, load, margin, overloaded: margin < 0 }
  })
  return { stations, totalWork: totalSeconds(study.tasks), maxLoad, overloaded }
}
