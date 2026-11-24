export interface ReliabilityObservation {
  id: string
  time: number
  status: 'failed' | 'censored'
}

export interface ReliabilityCohort {
  id: string
  label: string
  observations: readonly ReliabilityObservation[]
}

export interface ReliabilityData {
  timeUnit: string
  cohorts: readonly ReliabilityCohort[]
}

export type ReliabilityConfidence = readonly [lower: number, upper: number]

export interface ReliabilitySnapshot {
  time: number
  /** Units under observation immediately before this time's exits. */
  atRisk: number
  atRiskAfter: number
  failedIds: readonly string[]
  censoredIds: readonly string[]
  /** Right-continuous survival, available through the last observed time. */
  survival?: number
  /** Pointwise Greenwood log-log 95% interval, defined for 0 < survival < 1. */
  confidence?: ReliabilityConfidence
}

export interface ReliabilityStep extends ReliabilitySnapshot {
  survivalBefore: number
  survival: number
}

export interface PreparedReliabilityCohort extends ReliabilityCohort {
  /** Stable chronological order preserves input order among tied observations. */
  observations: readonly ReliabilityObservation[]
  steps: readonly ReliabilityStep[]
  followUp: number
  /** Earliest observed time at which the estimated survival is at most 50%. */
  median: number | undefined
  failures: number
  censored: number
}

export interface PreparedReliability {
  timeUnit: string
  cohorts: readonly PreparedReliabilityCohort[]
  /** Distinct observed failure and censor times across all cohorts, in chronological order. */
  eventTimes: readonly number[]
  followUp: number
}

const normal95 = 1.959963984540054

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validTime(time: number): boolean {
  return Number.isFinite(time) && time >= 0
}

function greenwoodInterval(survival: number, greenwood: number): ReliabilityConfidence | undefined {
  if (survival <= 0 || survival >= 1) return undefined
  const hazard = -Math.log(survival)
  const center = Math.log(hazard)
  const offset = normal95 * Math.sqrt(greenwood) / hazard
  return [Math.exp(-Math.exp(center + offset)), Math.exp(-Math.exp(center - offset))]
}

function compareWithHalf(survival: number, steps: readonly ReliabilityStep[], atRisk: number, afterFailures: number) {
  const difference = survival - 0.5
  if (Math.abs(difference) > Number.EPSILON * (steps.length + 1)) return difference

  // Near 50%, rounding a product such as (8/10)(6/8)(5/6) can move the median to a later event.
  let numerator = BigInt(afterFailures)
  let denominator = BigInt(atRisk)
  for (const step of steps) {
    if (!step.failedIds.length) continue
    numerator *= BigInt(step.atRisk - step.failedIds.length)
    denominator *= BigInt(step.atRisk)
  }
  const comparison = 2n * numerator - denominator
  return comparison < 0n ? -1 : comparison > 0n ? 1 : 0
}

function prepareCohort(cohort: ReliabilityCohort): PreparedReliabilityCohort | null {
  if (!cohort || !nonblank(cohort.id) || !nonblank(cohort.label) ||
      !Array.isArray(cohort.observations) || !cohort.observations.length) return null

  const ids = new Set<string>()
  for (const observation of cohort.observations) {
    if (!observation || !nonblank(observation.id) || ids.has(observation.id) || !validTime(observation.time) ||
        (observation.status !== 'failed' && observation.status !== 'censored')) return null
    ids.add(observation.id)
  }

  const observations = [...cohort.observations].sort((left, right) => left.time - right.time)
  const steps: ReliabilityStep[] = []
  let survival = 1
  let greenwood = 0
  let failures = 0
  let median: number | undefined

  for (let index = 0; index < observations.length;) {
    const { time } = observations[index]
    const atRisk = observations.length - index
    const failedIds: string[] = []
    const censoredIds: string[] = []
    while (index < observations.length && observations[index].time === time) {
      const observation = observations[index++]
      if (observation.status === 'failed') failedIds.push(observation.id)
      else censoredIds.push(observation.id)
    }

    const survivalBefore = survival
    // Tied censors are still in the risk set for the failure step.
    const failed = failedIds.length
    const afterFailures = atRisk - failed
    survival *= afterFailures / atRisk
    if (failed > 0 && afterFailures > 0) {
      greenwood += failed / (atRisk * afterFailures)
    }
    if (median === undefined && failed > 0) {
      const threshold = compareWithHalf(survival, steps, atRisk, afterFailures)
      if (threshold <= 0) median = time
      if (threshold === 0) survival = 0.5
    }
    failures += failed

    steps.push({
      time,
      atRisk,
      atRiskAfter: observations.length - index,
      failedIds,
      censoredIds,
      survivalBefore,
      survival,
      confidence: greenwoodInterval(survival, greenwood),
    })
  }

  return {
    id: cohort.id,
    label: cohort.label,
    observations,
    steps,
    followUp: steps[steps.length - 1].time,
    median,
    failures,
    censored: observations.length - failures,
  }
}

/** Fit cohorts whose units all enter at time zero, with one failure or right censor per unit. */
export function prepareReliability(data: ReliabilityData): PreparedReliability | null {
  if (!data || !nonblank(data.timeUnit) || !Array.isArray(data.cohorts) || !data.cohorts.length) return null

  const cohorts: PreparedReliabilityCohort[] = []
  const ids = new Set<string>()
  const times = new Set<number>()
  let followUp = 0
  for (const cohort of data.cohorts) {
    const prepared = prepareCohort(cohort)
    if (!prepared || ids.has(prepared.id)) return null
    ids.add(prepared.id)
    cohorts.push(prepared)
    followUp = Math.max(followUp, prepared.followUp)
    for (const { time } of prepared.steps) times.add(time)
  }

  return { timeUnit: data.timeUnit, cohorts, eventTimes: [...times].sort((left, right) => left - right), followUp }
}

/** Inspect the risk set and survival at an observation time or between observed times. */
export function reliabilityAtTime(cohort: PreparedReliabilityCohort, time: number): ReliabilitySnapshot | null {
  if (!validTime(time)) return null
  if (time > cohort.followUp) {
    return { time, atRisk: 0, atRiskAfter: 0, failedIds: [], censoredIds: [] }
  }

  let left = 0
  let right = cohort.steps.length
  while (left < right) {
    const index = Math.floor((left + right) / 2)
    if (cohort.steps[index].time <= time) left = index + 1
    else right = index
  }

  const prior = cohort.steps[left - 1]
  if (prior?.time === time) return prior
  const remaining = prior?.atRiskAfter ?? cohort.observations.length
  return {
    time,
    atRisk: remaining,
    atRiskAfter: remaining,
    failedIds: [],
    censoredIds: [],
    survival: prior?.survival ?? 1,
    confidence: prior?.confidence,
  }
}
