import { prepareReliability } from '../kaplan-meier/model'
import type { PreparedReliabilityCohort, ReliabilityData, ReliabilityObservation } from '../kaplan-meier/model'

export interface WeibullFit {
  shape: number
  scale: number
  logScale: number
  b10: number | undefined
  b50: number | undefined
  /** Largest observed terminal time and relative log scale keep ratios accurate near tied times. */
  referenceTime: number
  logScaleOffset: number
}

export interface WeibullFailureMark {
  id: string
  time: number
  probability: number
  atRisk: number
  failuresAtTime: number
  fittedTime?: number
  /** Natural log of recorded time divided by fitted time at this plotting position. */
  logResidual?: number
}

export interface PreparedWeibullCohort {
  id: string
  label: string
  observations: readonly ReliabilityObservation[]
  failures: number
  censored: number
  fit?: WeibullFit
  marks: readonly WeibullFailureMark[]
  censors: readonly ReliabilityObservation[]
}

export interface PreparedWeibull {
  timeUnit: string
  minTime: number
  maxTime: number
  cohorts: readonly PreparedWeibullCohort[]
}

/** The linear Weibull-paper ordinate for a cumulative failure probability. */
export function weibullProbabilityCoordinate(probability: number): number {
  return Math.log(-Math.log1p(-probability))
}

function logTimeRatio(time: number, reference: number): number {
  if (time >= reference / 2 && time / reference <= 2) return Math.log1p((time - reference) / reference)
  return Math.log(time) - Math.log(reference)
}

function finiteTime(reference: number, logRatio: number): number | undefined {
  const multiplier = Math.exp(logRatio)
  // A log-space fallback avoids intermediate overflow or subnormal rounding in the multiplier.
  const value = multiplier >= 2 ** -1022 && Number.isFinite(multiplier)
    ? reference * multiplier
    : Math.exp(Math.log(reference) + logRatio)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Evaluate the fitted line without first rounding a tail probability to 0 or 1. */
export function weibullFittedCoordinate(fit: WeibullFit, time: number): number {
  return fit.shape * (logTimeRatio(time, fit.referenceTime) - fit.logScaleOffset)
}

export function weibullCDF(fit: WeibullFit, time: number): number {
  return time <= 0 ? 0 : -Math.expm1(-Math.exp(weibullFittedCoordinate(fit, time)))
}

export function weibullQuantile(fit: WeibullFit, probability: number): number | undefined {
  if (probability === 0) return 0
  if (!(probability > 0 && probability < 1)) return undefined
  return finiteTime(fit.referenceTime, fit.logScaleOffset + weibullProbabilityCoordinate(probability) / fit.shape)
}

function fitWeibull(cohort: PreparedReliabilityCohort): WeibullFit | undefined {
  if (!cohort.failures) return undefined
  const referenceTime = cohort.followUp
  const offsets = cohort.observations.map(({ time }) => logTimeRatio(time, referenceTime))
  const failureGap = -cohort.observations.reduce((sum, observation, index) => (
    observation.status === 'failed' ? sum + offsets[index] : sum
  ), 0) / cohort.failures
  // If every failure is at the largest observed time, the likelihood has no finite shape maximum.
  if (!(failureGap > 0)) return undefined

  // Work relative to the longest exposure. The normalized average failure log time is -1.
  const normalized = offsets.map((offset) => offset / failureGap)
  let low = 1
  // The weighted mean of -normalized is at most log(n) / scaledShape (by entropy).
  let high = 2 + Math.log(offsets.length)
  for (let iteration = 0; iteration < 64; iteration++) {
    const scaledShape = (low + high) * 0.5
    let sum = 0
    let weighted = 0
    for (const offset of normalized) {
      const weight = Math.exp(scaledShape * offset)
      sum += weight
      weighted += offset * weight
    }
    const score = 1 / scaledShape - 1 - weighted / sum
    if (score > 0) low = scaledShape
    else high = scaledShape
  }
  const scaledShape = (low + high) * 0.5
  const shape = scaledShape / failureGap
  // Censored observations enter the exposure term but only failures enter the event count.
  const exposureSum = normalized.reduce((sum, offset) => sum + Math.exp(scaledShape * offset), 0)
  const logScaleOffset = (Math.log(exposureSum) - Math.log(cohort.failures)) / shape
  const scale = finiteTime(referenceTime, logScaleOffset)
  if (!scale || !Number.isFinite(shape) || !(shape > 0)) return undefined

  const fit: WeibullFit = {
    shape,
    scale,
    logScale: Math.log(referenceTime) + logScaleOffset,
    referenceTime,
    logScaleOffset,
    b10: undefined,
    b50: undefined,
  }
  return { ...fit, b10: weibullQuantile(fit, 0.1), b50: weibullQuantile(fit, 0.5) }
}

/** Plot each failure at the midpoint of its Kaplan–Meier failure step. */
export function prepareWeibull(data: ReliabilityData): PreparedWeibull | null {
  const reliability = prepareReliability(data)
  if (!reliability || reliability.eventTimes[0] <= 0) return null

  const cohorts = reliability.cohorts.map((cohort): PreparedWeibullCohort => {
    const fit = fitWeibull(cohort)
    const marks: WeibullFailureMark[] = []
    for (const step of cohort.steps) {
      if (!step.failedIds.length) continue
      const probability = 1 - (step.survivalBefore + step.survival) * 0.5
      const fittedTime = fit ? weibullQuantile(fit, probability) : undefined
      const logResidual = fit && fittedTime !== undefined
        ? (weibullFittedCoordinate(fit, step.time) - weibullProbabilityCoordinate(probability)) / fit.shape
        : undefined
      for (const id of step.failedIds) {
        marks.push({
          id,
          time: step.time,
          probability,
          atRisk: step.atRisk,
          failuresAtTime: step.failedIds.length,
          fittedTime,
          logResidual,
        })
      }
    }
    return {
      id: cohort.id,
      label: cohort.label,
      observations: cohort.observations,
      failures: cohort.failures,
      censored: cohort.censored,
      fit,
      marks,
      censors: cohort.observations.filter(({ status }) => status === 'censored'),
    }
  })
  return {
    timeUnit: reliability.timeUnit,
    minTime: reliability.eventTimes[0],
    maxTime: reliability.followUp,
    cohorts,
  }
}
