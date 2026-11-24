export interface PcaVariable {
  id: string
  label: string
  shortLabel?: string
  unit?: string
}

export interface PcaObservation {
  id: string
  label?: string
  group?: string
  values: readonly number[]
}

export interface PcaBiplotData {
  variables: readonly PcaVariable[]
  observations: readonly PcaObservation[]
}

export type PcaPoint = readonly [number, number]
export type PcaScaling = 'scores' | 'balanced' | 'loadings'

export interface PcaAnalysis {
  variance: PcaPoint
  singularValues: PcaPoint
  scores: readonly PcaPoint[]
  coefficients: readonly PcaPoint[]
  means: readonly number[]
  standardDeviations: readonly number[]
}

function uniqueIds(items: readonly { id: string }[]): boolean {
  const ids = new Set<string>()
  for (const item of items) {
    if (typeof item?.id !== 'string' || !item.id.trim() || ids.has(item.id)) return false
    ids.add(item.id)
  }
  return true
}

function standardize(observations: readonly PcaObservation[], index: number) {
  const origin = observations[0].values[index]
  let magnitude = 0
  for (const { values } of observations) magnitude = Math.max(magnitude, Math.abs(values[index]))

  const column = new Float64Array(observations.length)
  if (magnitude === 0) return { column, mean: 0, sd: 0 }

  // Subtract the first observation before scaling to retain variation in columns with a large offset.
  const scaledOrigin = origin / magnitude
  let sum = 0
  let correction = 0
  for (const [row, { values }] of observations.entries()) {
    const value = values[index]
    const difference = value - origin
    column[row] = Number.isFinite(difference) ? difference / magnitude : value / magnitude - scaledOrigin
    const summand = column[row] - correction
    const next = sum + summand
    correction = (next - sum) - summand
    sum = next
  }

  const offset = sum / column.length
  let squared = 0
  for (let row = 0; row < column.length; row++) {
    column[row] -= offset
    squared += column[row] ** 2
  }

  const scaledSd = Math.sqrt(squared / (column.length - 1))
  if (scaledSd === 0) return { column, mean: origin, sd: 0 }

  const sd = scaledSd * magnitude
  const meanShift = offset * magnitude
  const mean = Number.isFinite(meanShift) ? origin + meanShift : (scaledOrigin + offset) * magnitude
  if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd === 0) return null

  for (let row = 0; row < column.length; row++) column[row] /= scaledSd
  return { column, mean, sd }
}

function correlationMatrix(columns: readonly Float64Array[]) {
  const matrix = columns.map(() => new Float64Array(columns.length))
  for (let first = 0; first < columns.length; first++) {
    for (let second = first; second < columns.length; second++) {
      const a = columns[first]
      const b = columns[second]
      let sum = 0
      let correction = 0
      for (let row = 0; row < a.length; row++) {
        const summand = a[row] * b[row] - correction
        const next = sum + summand
        correction = (next - sum) - summand
        sum = next
      }
      matrix[first][second] = matrix[second][first] = sum / (a.length - 1)
    }
  }
  return matrix
}

/** Cyclic Jacobi diagonalization. Each rotation zeros one symmetric off-diagonal pair. */
function symmetricEigenvectors(matrix: Float64Array[]): Float64Array[] | null {
  const size = matrix.length
  const vectors = matrix.map((_, axis) => {
    const row = new Float64Array(size)
    row[axis] = 1
    return row
  })
  const threshold = Number.EPSILON * size

  for (let sweep = 0; sweep < 64; sweep++) {
    let rotated = false
    for (let first = 0; first < size - 1; first++) {
      for (let second = first + 1; second < size; second++) {
        const cross = matrix[first][second]
        if (Math.abs(cross) <= threshold) continue

        const gap = (matrix[second][second] - matrix[first][first]) / (2 * cross)
        const tangent = (gap < 0 ? -1 : 1) / (Math.abs(gap) + Math.hypot(1, gap))
        const cosine = 1 / Math.hypot(1, tangent)
        const sine = tangent * cosine

        matrix[first][first] -= tangent * cross
        matrix[second][second] += tangent * cross
        matrix[first][second] = matrix[second][first] = 0
        for (let row = 0; row < size; row++) {
          if (row !== first && row !== second) {
            const a = matrix[row][first]
            const b = matrix[row][second]
            matrix[row][first] = matrix[first][row] = cosine * a - sine * b
            matrix[row][second] = matrix[second][row] = sine * a + cosine * b
          }
          const a = vectors[row][first]
          const b = vectors[row][second]
          vectors[row][first] = cosine * a - sine * b
          vectors[row][second] = sine * a + cosine * b
        }
        rotated = true
      }
    }
    if (!rotated) return vectors
  }
  return null
}

function orientation(vectors: readonly Float64Array[], component: number): number {
  let anchor = vectors[0][component]
  for (const row of vectors) {
    if (Math.abs(row[component]) > Math.abs(anchor)) anchor = row[component]
  }
  return anchor < 0 ? -1 : 1
}

export function analyzePca(data: PcaBiplotData): PcaAnalysis | null {
  const { variables, observations } = data ?? {}
  if (!Array.isArray(variables) || !Array.isArray(observations)) return null

  const rows = observations.length
  const width = variables.length
  if (rows < 3 || width < 2 || !uniqueIds(variables) || !uniqueIds(observations)) return null
  for (const { values } of observations) {
    if (!Array.isArray(values) || values.length !== width) return null
    for (const value of values) if (!Number.isFinite(value)) return null
  }

  const columns: Float64Array[] = []
  const means: number[] = []
  const standardDeviations: number[] = []
  for (let index = 0; index < width; index++) {
    const result = standardize(observations, index)
    if (!result) return null
    columns.push(result.column)
    means.push(result.mean)
    standardDeviations.push(result.sd)
  }

  const matrix = correlationMatrix(columns)
  const totalVariance = matrix.reduce((sum, row, index) => sum + row[index], 0)
  const vectors = symmetricEigenvectors(matrix)
  if (!vectors) return null

  const order = matrix.map((row, index) => ({ index, eigenvalue: row[index] }))
    .sort((a, b) => b.eigenvalue - a.eigenvalue || a.index - b.index)
  const [first, second] = order
  if (second.eigenvalue <= Number.EPSILON * width * first.eigenvalue) return null

  const firstSign = orientation(vectors, first.index)
  const secondSign = orientation(vectors, second.index)
  const coefficients = vectors.map((row, index): PcaPoint => standardDeviations[index] === 0
    ? [0, 0]
    : [row[first.index] * firstSign, row[second.index] * secondSign])
  const scores = observations.map((_, row): PcaPoint => {
    let firstScore = 0
    let secondScore = 0
    for (let index = 0; index < width; index++) {
      const value = columns[index][row]
      firstScore += value * coefficients[index][0]
      secondScore += value * coefficients[index][1]
    }
    return [firstScore, secondScore]
  })

  return {
    variance: [first.eigenvalue / totalVariance, second.eigenvalue / totalVariance],
    singularValues: [Math.sqrt(first.eigenvalue * (rows - 1)), Math.sqrt(second.eigenvalue * (rows - 1))],
    scores,
    coefficients,
    means,
    standardDeviations,
  }
}

export function scalePca(result: PcaAnalysis, scaling: PcaScaling): {
  points: readonly PcaPoint[]
  vectors: readonly PcaPoint[]
} {
  if (scaling === 'scores') return { points: result.scores, vectors: result.coefficients }

  const [first, second] = result.singularValues
  const factors = scaling === 'balanced' ? [Math.sqrt(first), Math.sqrt(second)] : [first, second]
  return {
    points: result.scores.map(([x, y]) => [x / factors[0], y / factors[1]]),
    vectors: result.coefficients.map(([x, y]) => [x * factors[0], y * factors[1]]),
  }
}
