export interface GaugeReading {
  part: string
  operator: string
  trial: string
  value: number
}

export interface GaugeRRData {
  unit: string
  readings: readonly GaugeReading[]
}

export interface GaugePart {
  id: string
  mean: number
}

export interface GaugeOperator {
  id: string
  mean: number
}

export interface GaugeCell {
  part: string
  operator: string
  partMean: number
  mean: number
  min: number
  max: number
  range: number
  readings: readonly GaugeReading[]
  /** Reading minus the mean of all readings on the same part, in trial order. */
  residuals: readonly number[]
}

export type GaugeTerm = 'part' | 'operator' | 'interaction' | 'repeatability'

export interface GaugeAnovaRow {
  term: GaugeTerm
  ss: number
  df: number
  ms: number
}

export interface GaugeVarianceComponent {
  term: GaugeTerm
  rawVariance: number
  variance: number
  stdDev: number
  /** Share of total variance, expressed as a ratio between 0 and 1. */
  fraction: number | null
}

export interface PreparedGaugeRR extends GaugeRRData {
  parts: readonly GaugePart[]
  operators: readonly GaugeOperator[]
  trials: readonly string[]
  /** Rows are operators and columns are parts. Both follow first appearance. */
  cells: readonly (readonly GaugeCell[])[]
  grandMean: number
  absoluteDomain: readonly [number, number]
  residualDomain: readonly [number, number]
  anova: readonly GaugeAnovaRow[]
  totalSS: number
  totalDF: number
  components: Readonly<Record<GaugeTerm, GaugeVarianceComponent>>
  measurementVariance: number
  reproducibilityVariance: number
  totalVariance: number
  measurementFraction: number | null
}

type ReadingsByTrial = Map<string, GaugeReading>

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function fitAnova(
  cellMeans: readonly (readonly number[])[],
  partMeans: readonly number[],
  operatorMeans: readonly number[],
  grandMean: number,
  trialCount: number,
  withinSS: number,
) {
  const partCount = partMeans.length
  const operatorCount = operatorMeans.length
  const partSS = partMeans.reduce((sum, mean) => sum + (mean - grandMean) ** 2, 0) * operatorCount * trialCount
  const operatorSS = operatorMeans.reduce((sum, mean) => sum + (mean - grandMean) ** 2, 0) * partCount * trialCount
  let interactionSS = 0
  for (const [operator, row] of cellMeans.entries()) {
    for (const [part, mean] of row.entries()) {
      interactionSS += (mean - partMeans[part] - operatorMeans[operator] + grandMean) ** 2
    }
  }
  interactionSS *= trialCount

  function row(term: GaugeTerm, ss: number, df: number): GaugeAnovaRow {
    return { term, ss, df, ms: ss / df }
  }

  const part = row('part', partSS, partCount - 1)
  const operator = row('operator', operatorSS, operatorCount - 1)
  const interaction = row('interaction', interactionSS, (partCount - 1) * (operatorCount - 1))
  const repeatability = row('repeatability', withinSS, partCount * operatorCount * (trialCount - 1))
  const anova = [part, operator, interaction, repeatability]

  // Method of moments for a balanced random-effects crossed study with interaction retained.
  const raw = {
    part: (part.ms - interaction.ms) / operatorCount / trialCount,
    operator: (operator.ms - interaction.ms) / partCount / trialCount,
    interaction: (interaction.ms - repeatability.ms) / trialCount,
    repeatability: repeatability.ms,
  }
  const reproducibilityVariance = Math.max(0, raw.operator) + Math.max(0, raw.interaction)
  const measurementVariance = reproducibilityVariance + Math.max(0, raw.repeatability)
  const totalVariance = measurementVariance + Math.max(0, raw.part)
  const totalSS = anova.reduce((sum, term) => sum + term.ss, 0)
  if (!Number.isFinite(totalVariance) || !Number.isFinite(totalSS)) return null

  function component(term: GaugeTerm): GaugeVarianceComponent {
    const rawVariance = raw[term]
    const variance = Math.max(0, rawVariance)
    return { term, rawVariance, variance, stdDev: Math.sqrt(variance), fraction: totalVariance === 0 ? null : variance / totalVariance }
  }

  return {
    anova,
    totalSS,
    totalDF: partCount * operatorCount * trialCount - 1,
    components: {
      part: component('part'),
      operator: component('operator'),
      interaction: component('interaction'),
      repeatability: component('repeatability'),
    },
    measurementVariance,
    reproducibilityVariance,
    totalVariance,
    measurementFraction: totalVariance === 0 ? null : measurementVariance / totalVariance,
  }
}

export function prepareGaugeRR(data: GaugeRRData): PreparedGaugeRR | null {
  if (!nonblank(data?.unit) || !Array.isArray(data.readings) || data.readings.length === 0) return null
  const partIds = new Set<string>()
  const trialIds = new Set<string>()
  const byOperator = new Map<string, Map<string, ReadingsByTrial>>()
  let min = Infinity
  let max = -Infinity

  for (const reading of data.readings) {
    if (!reading || !nonblank(reading.part) || !nonblank(reading.operator) || !nonblank(reading.trial) || !Number.isFinite(reading.value)) {
      return null
    }

    partIds.add(reading.part)
    trialIds.add(reading.trial)
    const byPart = byOperator.get(reading.operator) ?? new Map<string, ReadingsByTrial>()
    const byTrial = byPart.get(reading.part) ?? new Map<string, GaugeReading>()
    if (byTrial.has(reading.trial)) return null

    byTrial.set(reading.trial, reading)
    byPart.set(reading.part, byTrial)
    byOperator.set(reading.operator, byPart)
    min = Math.min(min, reading.value)
    max = Math.max(max, reading.value)
  }

  const parts = [...partIds]
  const operators = [...byOperator.keys()]
  const trials = [...trialIds]
  if (parts.length < 2 || operators.length < 2 || trials.length < 2) return null

  // Each triple is unique. The full Cartesian cardinality therefore proves
  // every part/operator cell has every trial before constructing the matrix.
  if (data.readings.length !== parts.length * operators.length * trials.length) return null

  const readingsByCell = operators.map((operator) => parts.map((part) =>
    trials.map((trial) => byOperator.get(operator)!.get(part)!.get(trial)!),
  ))

  // Center calculations to retain small differences between large readings.
  const origin = min
  if (!Number.isFinite(max - origin)) return null
  const cellMeans = readingsByCell.map((row) => row.map((readings) =>
    readings.reduce((sum, reading) => sum + (reading.value - origin) / trials.length, 0),
  ))
  const partMeans = parts.map((_, part) => cellMeans.reduce((sum, row) => sum + row[part] / operators.length, 0))
  const operatorMeans = cellMeans.map((row) => row.reduce((sum, mean) => sum + mean / parts.length, 0))
  const grandMean = partMeans.reduce((sum, mean) => sum + mean / parts.length, 0)

  let withinSS = 0
  let residualMin = Infinity
  let residualMax = -Infinity
  const cells = readingsByCell.map((row, operator) => row.map((readings, part): GaugeCell => {
    const mean = cellMeans[operator][part]
    const partMean = partMeans[part]
    let cellMin = Infinity
    let cellMax = -Infinity
    const residuals = readings.map(({ value }) => {
      const offset = value - origin
      const residual = offset - partMean
      withinSS += (offset - mean) ** 2
      cellMin = Math.min(cellMin, value)
      cellMax = Math.max(cellMax, value)
      residualMin = Math.min(residualMin, residual)
      residualMax = Math.max(residualMax, residual)
      return residual
    })
    return {
      part: parts[part],
      operator: operators[operator],
      partMean: origin + partMean,
      mean: origin + mean,
      min: cellMin,
      max: cellMax,
      range: cellMax - cellMin,
      readings,
      residuals,
    }
  }))
  const statistics = fitAnova(cellMeans, partMeans, operatorMeans, grandMean, trials.length, withinSS)
  if (!statistics || !Number.isFinite(origin + grandMean)) return null

  return {
    unit: data.unit,
    readings: data.readings,
    parts: parts.map((id, index) => ({ id, mean: origin + partMeans[index] })),
    operators: operators.map((id, index) => ({ id, mean: origin + operatorMeans[index] })),
    trials,
    cells,
    grandMean: origin + grandMean,
    absoluteDomain: [min, max],
    residualDomain: [residualMin, residualMax],
    ...statistics,
  }
}
