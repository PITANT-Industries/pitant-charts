export interface HotellingChannel {
  id: string
  label: string
  unit?: string
}

export interface HotellingRow {
  id: string
  values: readonly number[]
}

export interface HotellingData {
  channels: readonly HotellingChannel[]
  reference: readonly HotellingRow[]
  runs: readonly HotellingRow[]
  alpha?: number
}

export interface PreparedHotellingChannel extends HotellingChannel {
  mean: number
  sd: number
}

export interface StandardizedHotellingRow extends HotellingRow {
  z: readonly number[]
}

export interface HotellingRun extends StandardizedHotellingRow {
  score: number
  /** Signed terms z[j] × (C⁻¹z)[j], in channel order. Their sum is T². */
  contributions: readonly number[]
  flagged: boolean
}

export interface PreparedHotelling {
  channels: readonly PreparedHotellingChannel[]
  reference: readonly StandardizedHotellingRow[]
  runs: readonly HotellingRun[]
  correlation: readonly (readonly number[])[]
  alpha: number
  limit: number
}

interface Scaling {
  origin: number
  spread: number
  offset: number
  deviation: number
  mean: number
  sd: number
}

const lanczos = [
  676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
]

function logGamma(value: number): number {
  const z = value - 1
  let coefficient = 0.9999999999998099
  for (let i = 0; i < lanczos.length; i++) coefficient += lanczos[i] / (z + i + 1)
  const base = z + 7.5
  return 0.9189385332046727 + (z + 0.5) * Math.log(base) - base + Math.log(coefficient)
}

// Evaluate the beta continued fraction with the modified Lentz algorithm.
function betaFraction(a: number, b: number, x: number): number {
  const floor = 1e-300
  const awayFromZero = (value: number) => Math.abs(value) < floor ? (value < 0 ? -floor : floor) : value
  let c = 1
  let d = 1 / awayFromZero(1 - (a + b) * x / (a + 1))
  let product = d
  for (let m = 1; m <= 512; m++) {
    const offset = 2 * m
    const even = m * (b - m) * x / ((a + offset - 1) * (a + offset))
    d = 1 / awayFromZero(1 + even * d)
    c = awayFromZero(1 + even / c)
    product *= d * c
    const odd = -(a + m) * (a + b + m) * x / ((a + offset) * (a + offset + 1))
    d = 1 / awayFromZero(1 + odd * d)
    c = awayFromZero(1 + odd / c)
    const correction = d * c
    product *= correction
    if (Math.abs(correction - 1) < 8 * Number.EPSILON) return product
  }
  return NaN
}

function logBetaProbability(logit: number, a: number, b: number, logBeta: number): number {
  const softplus = Math.log1p(Math.exp(-Math.abs(logit)))
  const logX = Math.min(logit, 0) - softplus
  const logComplement = Math.min(-logit, 0) - softplus
  const factor = a * logX + b * logComplement - logBeta

  if (logit < Math.log((a + 1) / (b + 1))) {
    return Math.min(0, factor + Math.log(betaFraction(a, b, Math.exp(logX))) - Math.log(a))
  }

  const complement = factor + Math.log(betaFraction(b, a, Math.exp(logComplement))) - Math.log(b)
  return Math.log(-Math.expm1(Math.min(0, complement)))
}

function phaseTwoLimit(channels: number, referenceSize: number, alpha: number): number {
  const residualDegrees = referenceSize - channels
  const upperTail = alpha <= 0.5
  const a = (upperTail ? residualDegrees : channels) / 2
  const b = (upperTail ? channels : residualDegrees) / 2
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b)
  const target = Math.log(upperTail ? alpha : 1 - alpha)
  const logDegreeRatio = Math.log(channels / residualDegrees)
  // The F CDF is a regularized beta. Inverting its smaller tail on a log
  // scale avoids subtracting alpha from one at practical small values.
  const belowQuantile = (logF: number): boolean | undefined => {
    const logit = (logF + logDegreeRatio) * (upperTail ? -1 : 1)
    const probability = logBetaProbability(logit, a, b, logBeta)
    if (Number.isNaN(probability)) return undefined
    return upperTail ? probability > target : probability < target
  }

  let low = Math.log(Number.MIN_VALUE)
  let high = Math.log(Number.MAX_VALUE)
  if (belowQuantile(low) !== true || belowQuantile(high) !== false) return NaN
  for (let i = 0; i < 80 && high - low > 1e-13; i++) {
    const middle = (low + high) / 2
    const below = belowQuantile(middle)
    if (below === undefined) return NaN
    if (below) low = middle
    else high = middle
  }
  const multiplier = (channels / residualDegrees) * (referenceSize - 1) * (1 + 1 / referenceSize)
  return Math.exp((low + high) / 2 + Math.log(multiplier))
}

function compensatedSum(count: number, term: (index: number) => number): number {
  let sum = 0
  let correction = 0
  for (let i = 0; i < count; i++) {
    const value = term(i) - correction
    const next = sum + value
    correction = (next - sum) - value
    sum = next
  }
  return sum
}

function scaling(reference: readonly HotellingRow[], column: number): Scaling | null {
  let origin = reference[0].values[column]
  let spread = 0
  for (const row of reference) spread = Math.max(spread, Math.abs(row.values[column] - origin))
  if (!Number.isFinite(spread)) {
    origin = 0
    spread = 0
    for (const row of reference) spread = Math.max(spread, Math.abs(row.values[column]))
  }
  if (spread === 0) return null

  const shifted = (i: number) => (reference[i].values[column] - origin) / spread
  const offset = compensatedSum(reference.length, shifted) / reference.length
  const deviation = Math.sqrt(compensatedSum(reference.length, (i) => (shifted(i) - offset) ** 2) / (reference.length - 1))
  const mean = origin + offset * spread
  const sd = deviation * spread
  return Number.isFinite(mean) && Number.isFinite(sd) && sd > 0 ? { origin, spread, offset, deviation, mean, sd } : null
}

function standardize(row: HotellingRow, scales: readonly Scaling[]): StandardizedHotellingRow | null {
  const z = scales.map(({ origin, spread, offset, deviation }, i) => {
    const difference = row.values[i] - origin
    const shifted = Number.isFinite(difference) ? difference / spread : row.values[i] / spread - origin / spread
    return (shifted - offset) / deviation
  })
  return z.every(Number.isFinite) ? { id: row.id, values: [...row.values], z } : null
}

function cholesky(matrix: readonly (readonly number[])[]): number[][] | null {
  const factor: number[][] = matrix.map(() => [])
  // Unit-diagonal correlation makes this a relative round-off threshold.
  const roundoff = matrix.length * Number.EPSILON * 8
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j <= i; j++) {
      const remainder = matrix[i][j] - compensatedSum(j, (k) => factor[i][k] * factor[j][k])
      if (i === j) {
        if (remainder <= roundoff || !Number.isFinite(remainder)) return null
        factor[i][j] = Math.sqrt(remainder)
      } else {
        factor[i][j] = remainder / factor[j][j]
      }
    }
  }
  return factor
}

function scoreRun(row: StandardizedHotellingRow, factor: readonly (readonly number[])[], limit: number): HotellingRun | null {
  const size = row.z.length
  const forward: number[] = []
  for (let i = 0; i < size; i++) {
    forward[i] = (row.z[i] - compensatedSum(i, (j) => factor[i][j] * forward[j])) / factor[i][i]
  }
  const solved: number[] = []
  for (let i = size - 1; i >= 0; i--) {
    const preceding = compensatedSum(size - i - 1, (j) => {
      const k = i + j + 1
      return factor[k][i] * solved[k]
    })
    solved[i] = (forward[i] - preceding) / factor[i][i]
  }
  const score = compensatedSum(size, (i) => forward[i] ** 2)
  const contributions = row.z.map((value, i) => value * solved[i])
  if (!Number.isFinite(score) || !contributions.every(Number.isFinite)) return null
  return { ...row, score, contributions, flagged: score > limit }
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validRows(rows: readonly HotellingRow[], columns: number): boolean {
  const ids = new Set<string>()
  for (const row of rows) {
    if (!row || !nonblank(row.id) || ids.has(row.id) || !Array.isArray(row.values) || row.values.length !== columns) return false
    for (const value of row.values) if (!Number.isFinite(value)) return false
    ids.add(row.id)
  }
  return true
}

export function prepareHotelling(data: HotellingData): PreparedHotelling | null {
  if (!data || !Array.isArray(data.channels) || !Array.isArray(data.reference) || !Array.isArray(data.runs) ||
      data.channels.length < 2 || data.reference.length <= data.channels.length || !data.runs.length) return null
  const { channels, reference, runs } = data
  const alpha = data.alpha === undefined ? 0.01 : data.alpha
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) return null

  const ids = new Set<string>()
  for (const channel of channels) {
    if (!channel || !nonblank(channel.id) || ids.has(channel.id) || !nonblank(channel.label) ||
        (channel.unit !== undefined && typeof channel.unit !== 'string')) return null
    ids.add(channel.id)
  }
  if (!validRows(reference, channels.length) || !validRows(runs, channels.length)) return null

  const scales: Scaling[] = []
  const preparedChannels: PreparedHotellingChannel[] = []
  for (const [i, channel] of channels.entries()) {
    const scale = scaling(reference, i)
    if (!scale) return null
    scales.push(scale)
    preparedChannels.push({ ...channel, mean: scale.mean, sd: scale.sd })
  }

  const preparedReference: StandardizedHotellingRow[] = []
  for (const row of reference) {
    const prepared = standardize(row, scales)
    if (!prepared) return null
    preparedReference.push(prepared)
  }

  const correlation: number[][] = channels.map(() => [])
  for (let i = 0; i < channels.length; i++) {
    correlation[i][i] = 1
    for (let j = 0; j < i; j++) {
      const product = compensatedSum(reference.length, (k) => preparedReference[k].z[i] * preparedReference[k].z[j])
      correlation[i][j] = correlation[j][i] = product / (reference.length - 1)
    }
  }
  const factor = cholesky(correlation)
  if (!factor) return null
  const limit = phaseTwoLimit(channels.length, reference.length, alpha)
  if (!Number.isFinite(limit) || limit <= 0) return null

  const preparedRuns: HotellingRun[] = []
  for (const row of runs) {
    const standardized = standardize(row, scales)
    const prepared = standardized && scoreRun(standardized, factor, limit)
    if (!prepared) return null
    preparedRuns.push(prepared)
  }
  return { channels: preparedChannels, reference: preparedReference, runs: preparedRuns, correlation, alpha, limit }
}
