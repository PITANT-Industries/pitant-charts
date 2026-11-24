export interface EnergyReading {
  /** Seconds on the run's clock. Null marks a missing power sample. */
  time: number
  watts: number | null
}

export interface EnergyRun {
  id: string
  label: string
  speed: number
  load: number
  /** Output quantity measured over the integration window. */
  units: number
  start: number
  end: number
  /** Largest interval eligible for interpolation, in seconds. */
  maxGap: number
  readings: readonly EnergyReading[]
}

export interface EnergyAxis {
  label: string
  unit: string
}

export interface EnergyOperatingMapData {
  /** Output unit for the Wh-per-unit comparison. */
  unit: string
  speed: EnergyAxis
  load: EnergyAxis
  runs: readonly EnergyRun[]
}

export interface EnergyTracePoint {
  time: number
  watts: number
}

export interface PreparedEnergyRun extends EnergyRun {
  segments: readonly (readonly EnergyTracePoint[])[]
  /** The integral over the observed portions of the window, in watt-hours. */
  observedWh: number
  coveredSeconds: number
  /** Watt-hours per output unit, available only with complete trace coverage. */
  energyPerUnit: number | null
}

export interface EnergyOperatingGroup {
  speed: number
  load: number
  runs: readonly PreparedEnergyRun[]
  /** The median Wh per unit of the fully covered runs at this exact setting. */
  median: number | null
}

export interface PreparedEnergyMap extends Omit<EnergyOperatingMapData, 'runs'> {
  runs: readonly PreparedEnergyRun[]
  groups: readonly EnergyOperatingGroup[]
  /** The range of group medians used by the map's color scale. */
  extent: readonly [number, number] | null
}

function isLabel(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function powerAt(time: number, left: EnergyTracePoint, right: EnergyTracePoint): number {
  const duration = right.time - left.time
  const offset = time - left.time
  if (offset <= duration / 2) {
    return left.watts + (right.watts - left.watts) * (offset / duration)
  }
  return right.watts + (left.watts - right.watts) * ((right.time - time) / duration)
}

function prepareRun(run: EnergyRun): PreparedEnergyRun | null {
  const { start, end, units, maxGap } = run
  if (!isLabel(run.id) || !isLabel(run.label) || !Number.isFinite(run.speed) ||
    !Number.isFinite(run.load) || !Number.isFinite(units) || units <= 0 ||
    !Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
    !Number.isFinite(end - start) || !Number.isFinite(maxGap) || maxGap <= 0) return null

  const readings = [...run.readings].sort((a, b) => a.time - b.time)
  const segments: EnergyTracePoint[][] = []
  let previousTime = -Infinity
  let previous: EnergyTracePoint | undefined
  let observedWh = 0
  let correction = 0
  for (const { time, watts } of readings) {
    if (!Number.isFinite(time) || time <= previousTime ||
      (watts !== null && (!Number.isFinite(watts) || watts < 0))) return null
    previousTime = time
    if (watts === null) {
      previous = undefined
      continue
    }

    const current = { time, watts }
    const left = previous
    previous = current
    if (!left || time - left.time > maxGap) continue

    const from = Math.max(start, left.time)
    const to = Math.min(end, time)
    if (from >= to) continue

    const first = { time: from, watts: powerAt(from, left, current) }
    const last = { time: to, watts: powerAt(to, left, current) }
    const segment = segments.at(-1)
    if (segment && segment[segment.length - 1].time === from) segment.push(last)
    else segments.push([first, last])

    const averageWatts = first.watts + (last.watts - first.watts) / 2
    const seconds = to - from
    const wattHours = seconds < 1 ? averageWatts * seconds / 3600 : averageWatts * (seconds / 3600)
    const adjusted = wattHours - correction
    const sum = observedWh + adjusted
    if (!Number.isFinite(sum)) return null
    correction = (sum - observedWh) - adjusted
    observedWh = sum
  }

  const coveredSeconds = Math.min(end - start, segments.reduce((total, segment) =>
    total + (segment[segment.length - 1].time - segment[0].time), 0))
  // Duration totals can round to the full window even when a small gap remains.
  const onlySegment = segments.length === 1 ? segments[0] : undefined
  const complete = onlySegment?.[0].time === start && onlySegment[onlySegment.length - 1].time === end
  const energyPerUnit = complete ? observedWh / units : null
  if (energyPerUnit !== null && !Number.isFinite(energyPerUnit)) return null
  return { ...run, readings, segments, observedWh, coveredSeconds, energyPerUnit }
}

export function prepareEnergyOperatingMap(data: EnergyOperatingMapData): PreparedEnergyMap | null {
  const { unit, speed, load } = data
  if (!isLabel(unit) || !isLabel(speed.label) || !isLabel(load.label) ||
    typeof speed.unit !== 'string' || typeof load.unit !== 'string' || !data.runs.length) return null

  const runs: PreparedEnergyRun[] = []
  const ids = new Set<string>()
  const pairs = new Map<string, PreparedEnergyRun[]>()
  for (const run of data.runs) {
    if (ids.has(run.id)) return null
    const prepared = prepareRun(run)
    if (!prepared) return null
    ids.add(run.id)
    runs.push(prepared)

    const key = `${run.speed}:${run.load}`
    const group = pairs.get(key)
    if (group) group.push(prepared)
    else pairs.set(key, [prepared])
  }

  let lower = Infinity
  let upper = -Infinity
  const groups: EnergyOperatingGroup[] = []
  for (const members of pairs.values()) {
    const values = members.flatMap(({ energyPerUnit }) => energyPerUnit === null ? [] : [energyPerUnit]).sort((a, b) => a - b)
    const middle = Math.floor(values.length / 2)
    let median: number | null = null
    if (values.length) {
      const high = values[middle]
      median = values.length % 2 ? high : high - (high - values[middle - 1]) / 2
      lower = Math.min(lower, median)
      upper = Math.max(upper, median)
    }
    groups.push({ speed: members[0].speed, load: members[0].load, runs: members, median })
  }
  groups.sort((a, b) => a.speed - b.speed || a.load - b.load)
  return { unit, speed, load, runs, groups, extent: lower === Infinity ? null : [lower, upper] }
}
