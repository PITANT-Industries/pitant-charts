export type ParetoPoint = readonly [number, number, number]
type Domain = readonly [number, number]
type Axis = 0 | 1 | 2

export interface ParetoObjective {
  label: string
  shortLabel?: string
  unit?: string
  direction: 'minimize' | 'maximize'
}

export interface ParetoTrial {
  id: string
  label?: string
  values: ParetoPoint
  group?: string
  setup?: string
}

export interface ParetoData {
  objectives: readonly [ParetoObjective, ParetoObjective, ParetoObjective]
  trials: readonly ParetoTrial[]
}

export interface PreparedPareto {
  /** Objective coordinates in original units, ordered from better to worse. */
  bounds: readonly [Domain, Domain, Domain]
  /** Unit-cube coordinates with increasing values always worse. */
  positions: readonly ParetoPoint[]
  losses: readonly ParetoPoint[]
}

export interface ParetoCell {
  x0: number
  x1: number
  y0: number
  y1: number
  z: number
}

export interface ParetoFace {
  /** The constant axis. Vertices face outward toward better objective values. */
  axis: Axis
  vertices: readonly [ParetoPoint, ParetoPoint, ParetoPoint, ParetoPoint]
}

export interface ParetoCalculation {
  frontier: ReadonlySet<number>
  cells: readonly ParetoCell[]
  faces: readonly ParetoFace[]
}

function padded(min: number, max: number): Domain {
  const span = max - min
  const magnitude = Math.max(Math.abs(min), Math.abs(max))
  const margin = Number.isFinite(span) ? span * .08 : max * .08 - min * .08
  const flatMargin = span === 0 ? (magnitude === 0 ? 1 : magnitude * .08) : 0
  const pad = Math.max(margin, flatMargin, magnitude * Number.EPSILON, Number.MIN_VALUE)
  return [Math.max(-Number.MAX_VALUE, min - pad), Math.min(Number.MAX_VALUE, max + pad)]
}

function normalized(value: number, [min, max]: Domain) {
  const span = max - min
  return Number.isFinite(span) ? (value - min) / span : (value / 2 - min / 2) / (max / 2 - min / 2)
}

function invert([min, max]: Domain): Domain {
  return [-min, -max]
}

export function preparePareto(data: ParetoData): PreparedPareto | null {
  const { objectives, trials } = data ?? {}
  if (!Array.isArray(objectives) || objectives.length !== 3 || !Array.isArray(trials) || !trials.length) return null

  for (const objective of objectives) {
    if (typeof objective?.label !== 'string' || !objective.label.trim() ||
      (objective.direction !== 'minimize' && objective.direction !== 'maximize')) return null
  }

  const directions = objectives.map(({ direction }) => direction === 'minimize' ? 1 : -1)
  const losses: ParetoPoint[] = []
  const ids = new Set<string>()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const trial of trials) {
    if (typeof trial?.id !== 'string' || !trial.id.trim() || ids.has(trial.id) ||
      !Array.isArray(trial.values) || trial.values.length !== 3) return null
    const [x, y, z] = trial.values
    if (![x, y, z].every(Number.isFinite)) return null

    ids.add(trial.id)
    const point: ParetoPoint = [x * directions[0], y * directions[1], z * directions[2]]
    losses.push(point)
    point.forEach((value, axis) => {
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    })
  }

  const x = padded(min[0], max[0])
  const y = padded(min[1], max[1])
  const z = padded(min[2], max[2])
  return {
    bounds: [directions[0] === 1 ? x : invert(x), directions[1] === 1 ? y : invert(y), directions[2] === 1 ? z : invert(z)],
    positions: losses.map(([a, b, c]) => [normalized(a, x), normalized(b, y), normalized(c, z)]),
    losses,
  }
}

function dominates(a: ParetoPoint, b: ParetoPoint) {
  return a[0] <= b[0] && a[1] <= b[1] && a[2] <= b[2] &&
    (a[0] < b[0] || a[1] < b[1] || a[2] < b[2])
}

function lossDomain(bounds: Domain) {
  return bounds[0] < bounds[1] ? bounds : invert(bounds)
}

function breaks(points: readonly ParetoPoint[], axis: 0 | 1, domain: Domain) {
  return [...new Set([...domain, ...points.map(point => point[axis])])].sort((a, b) => a - b)
}

function prefixMin(points: readonly ParetoPoint[], x: readonly number[], y: readonly number[]) {
  const xIndices = new Map(x.map((value, index) => [value, index]))
  const yIndices = new Map(y.map((value, index) => [value, index]))
  const rows = x.map(() => new Float64Array(y.length).fill(Infinity))
  for (const [a, b, c] of points) {
    const row = rows[xIndices.get(a)!]
    const column = yIndices.get(b)!
    row[column] = Math.min(row[column], c)
  }
  // Each threshold is the best third objective among trials meeting the first two targets.
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) {
      rows[i][j] = Math.min(rows[i][j], rows[i - 1]?.[j] ?? Infinity, rows[i][j - 1] ?? Infinity)
    }
  }
  return rows
}

function floorCells(levels: readonly Float64Array[], x: readonly number[], y: readonly number[], zDomain: Domain) {
  const cells: ParetoCell[] = []
  let open = new Map<string, ParetoCell>()
  for (let i = 0; i < x.length - 1; i++) {
    if (x[i] >= x[i + 1]) continue
    const row = levels[i]
    const next = new Map<string, ParetoCell>()
    for (let start = 0; start < y.length - 1;) {
      const height = row[start]
      let end = start + 1
      while (end < y.length - 1 && row[end] === height) end++
      if (Number.isFinite(height) && y[start] < y[end]) {
        const key = `${start}:${end}:${height}`
        const previous = open.get(key)
        next.set(key, previous
          ? { ...previous, x1: x[i + 1] }
          : { x0: x[i], x1: x[i + 1], y0: y[start], y1: y[end], z: normalized(height, zDomain) })
        open.delete(key)
      }
      start = end
    }
    cells.push(...open.values())
    open = next
  }
  cells.push(...open.values())
  return cells
}

function riserFaces(
  axis: 0 | 1,
  levels: readonly Float64Array[],
  across: readonly number[],
  along: readonly number[],
  zDomain: Domain,
): ParetoFace[] {
  const faces: ParetoFace[] = []
  const level = (i: number, j: number) => axis === 0 ? levels[i]?.[j] : levels[j][i]
  for (let i = 0; i < across.length; i++) {
    const at = across[i]
    for (let start = 0; start < along.length - 1;) {
      const lower = level(i, start)!
      const upper = i === 0 ? zDomain[1] : Math.min(zDomain[1], level(i - 1, start)!)
      let end = start + 1
      if (lower < upper) {
        while (end < along.length - 1 && level(i, end) === lower &&
          (i === 0 || Math.min(zDomain[1], level(i - 1, end)!) === upper)) end++
        const a = along[start]
        const b = along[end]
        const z0 = normalized(lower, zDomain)
        const z1 = normalized(upper, zDomain)
        if (a < b && z0 < z1) {
          faces.push({
            axis,
            vertices: axis === 0
              ? [[at, a, z0], [at, a, z1], [at, b, z1], [at, b, z0]]
              : [[a, at, z0], [b, at, z0], [b, at, z1], [a, at, z1]],
          })
        }
      }
      start = end
    }
  }
  return faces
}

export function calculatePareto(prepared: PreparedPareto, indices?: readonly number[]): ParetoCalculation {
  const { bounds, losses } = prepared
  const active = indices
    ? [...new Set(indices.filter(index => Number.isInteger(index) && index >= 0 && index < losses.length))]
    : losses.map((_, index) => index)
  const frontier = new Set(active.filter(index => !active.some(other => dominates(losses[other], losses[index]))))
  if (!frontier.size) return { frontier, cells: [], faces: [] }

  const points = [...frontier].map(index => losses[index])
  const xDomain = lossDomain(bounds[0])
  const yDomain = lossDomain(bounds[1])
  const zDomain = lossDomain(bounds[2])
  const x = breaks(points, 0, xDomain)
  const y = breaks(points, 1, yDomain)
  const levels = prefixMin(points, x, y)
  const normalizedX = x.map(value => normalized(value, xDomain))
  const normalizedY = y.map(value => normalized(value, yDomain))
  const cells = floorCells(levels, normalizedX, normalizedY, zDomain)
  const floors = cells.map(({ x0, x1, y0, y1, z }): ParetoFace => ({
    axis: 2,
    vertices: [[x0, y0, z], [x0, y1, z], [x1, y1, z], [x1, y0, z]],
  }))
  return {
    frontier,
    cells,
    faces: [...floors, ...riserFaces(0, levels, normalizedX, normalizedY, zDomain), ...riserFaces(1, levels, normalizedY, normalizedX, zDomain)],
  }
}
