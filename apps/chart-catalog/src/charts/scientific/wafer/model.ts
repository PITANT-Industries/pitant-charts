export type DieStatus = 'missing' | 'untested' | 'pass' | 'fail'

export interface WaferDie {
  row: number
  column: number
  status: DieStatus
  bin?: string
}

export interface DefectBin {
  id: string
  label: string
}

export interface WaferGeometry {
  unit: string
  pitchX: number
  pitchY: number
  originX?: number
  originY?: number
  rowDirection?: 'up' | 'down'
  radius?: number
  notch?: { angleDeg: number; widthDeg: number; depth: number }
}

export interface DefectWafer {
  id: string
  label?: string
  batch: string
  geometry: WaferGeometry
  dies: readonly WaferDie[]
  pattern?: string
}

export interface SpatialDefectData {
  wafers: readonly DefectWafer[]
  bins: readonly DefectBin[]
}

export interface PreparedDie extends WaferDie {
  key: string
  x: number
  y: number
  cluster?: string
}

type Bounds = { minX: number; maxX: number; minY: number; maxY: number }

export interface PreparedWafer {
  source: DefectWafer
  dies: readonly PreparedDie[]
  byKey: ReadonlyMap<string, PreparedDie>
  bounds: Bounds
  clusters: ReadonlyMap<string, readonly PreparedDie[]>
}

export interface PreparedDefectData {
  wafers: readonly PreparedWafer[]
  byId: ReadonlyMap<string, PreparedWafer>
  binsById: ReadonlyMap<string, DefectBin>
}

export type DieOutlineSegment = readonly [x1: number, y1: number, x2: number, y2: number]

type Point = readonly [number, number]
const statuses = new Set<DieStatus>(['missing', 'untested', 'pass', 'fail'])
const neighbors = [[-1, 0], [0, -1], [0, 1], [1, 0]] as const

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0
}

function validGeometry(geometry: WaferGeometry) {
  if (!geometry || !nonblank(geometry.unit) || !positive(geometry.pitchX) || !positive(geometry.pitchY) ||
    (geometry.originX !== undefined && !Number.isFinite(geometry.originX)) ||
    (geometry.originY !== undefined && !Number.isFinite(geometry.originY)) ||
    (geometry.rowDirection !== undefined && geometry.rowDirection !== 'up' && geometry.rowDirection !== 'down') ||
    (geometry.radius !== undefined && !positive(geometry.radius))) return false

  const { notch, radius } = geometry
  return notch === undefined || (
    !!notch && radius !== undefined && Number.isFinite(notch.angleDeg) &&
    positive(notch.widthDeg) && notch.widthDeg < 180 &&
    positive(notch.depth) && notch.depth < radius
  )
}

function dieKey(row: number, column: number) {
  return `${row},${column}`
}

function physicalRow(row: number, geometry: WaferGeometry) {
  return geometry.rowDirection === 'down' ? -row : row
}

function footprint({ column, row }: WaferDie, geometry: WaferGeometry): Bounds {
  const { pitchX, pitchY, originX = 0, originY = 0 } = geometry
  const vertical = physicalRow(row, geometry)
  // Shared corners must be computed from the same half-integer lattice coordinates.
  return {
    minX: originX + (column - .5) * pitchX,
    maxX: originX + (column + .5) * pitchX,
    minY: originY + (vertical - .5) * pitchY,
    maxY: originY + (vertical + .5) * pitchY,
  }
}

function clipHalfPlane(points: readonly Point[], signedDistance: (point: Point) => number): Point[] {
  const result: Point[] = []
  for (let index = 0; index < points.length; index++) {
    const current = points[index]
    const previous = points[(index + points.length - 1) % points.length]
    const now = signedDistance(current)
    const before = signedDistance(previous)
    if ((now <= 0) !== (before <= 0)) {
      const part = before / (before - now)
      result.push([previous[0] + (current[0] - previous[0]) * part, previous[1] + (current[1] - previous[1]) * part])
    }
    if (now <= 0) result.push(current)
  }
  return result
}

function nearestDistance([x, y]: Point, [nextX, nextY]: Point) {
  const dx = nextX - x
  const dy = nextY - y
  const length = dx * dx + dy * dy
  const weight = length === 0 ? 0 : Math.max(0, Math.min(1, -(x * dx + y * dy) / length))
  return Math.hypot(x + weight * dx, y + weight * dy)
}

function aperture(geometry: WaferGeometry): (box: Bounds) => boolean {
  const { radius, notch } = geometry
  if (radius === undefined) return () => true

  const margin = 8 * Number.EPSILON
  const onDisk = ([x, y]: Point) => Math.hypot(x, y) <= 1 + margin
  const closest = ({ minX, maxX, minY, maxY }: Bounds): Point => [
    Math.max(minX, Math.min(0, maxX)) / radius,
    Math.max(minY, Math.min(0, maxY)) / radius,
  ]
  if (notch === undefined) return box => onDisk(closest(box))

  const angle = (notch.angleDeg % 360) * Math.PI / 180
  const halfWidth = notch.widthDeg * Math.PI / 360
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const tip = 1 - notch.depth / radius
  const rise = Math.sin(halfWidth)
  const run = Math.cos(halfWidth) - tip
  const orient = (x: number, y: number): Point => [x * cosine + y * sine, -x * sine + y * cosine]
  const notchSide = ([u, v]: Point) => (u - tip) * rise - Math.abs(v) * run

  return box => {
    const near = closest(box)
    if (!onDisk(near)) return false
    if (notchSide(orient(...near)) <= margin) return true

    const minX = Math.max(-radius, box.minX) / radius
    const maxX = Math.min(radius, box.maxX) / radius
    const minY = Math.max(-radius, box.minY) / radius
    const maxY = Math.min(radius, box.maxY) / radius
    const corners = [orient(minX, minY), orient(maxX, minY), orient(maxX, maxY), orient(minX, maxY)]

    // Each half of the V leaves a convex region. Test the clipped die edge nearest the disk center.
    for (const sign of [1, -1]) {
      const half = clipHalfPlane(corners, ([, v]) => -sign * v)
      const usable = clipHalfPlane(half, ([u, v]) => (u - tip) * rise - sign * v * run)
      if (usable.some((point, index) => nearestDistance(point, usable[(index + 1) % usable.length]) <= 1 + margin)) return true
    }
    return false
  }
}

function failClusters(dies: readonly PreparedDie[], byKey: ReadonlyMap<string, PreparedDie>) {
  const clusters = new Map<string, readonly PreparedDie[]>()
  for (const first of dies) {
    if (first.status !== 'fail' || first.cluster !== undefined) continue

    const cluster = first.key
    const members = [first]
    first.cluster = cluster
    for (let index = 0; index < members.length; index++) {
      const { row, column } = members[index]
      for (const [dy, dx] of neighbors) {
        const next = byKey.get(dieKey(row + dy, column + dx))
        if (next?.status !== 'fail' || next.bin !== first.bin || next.cluster !== undefined) continue
        next.cluster = cluster
        members.push(next)
      }
    }
    clusters.set(cluster, members)
  }
  return clusters
}

function prepareWafer(source: DefectWafer, bins: ReadonlyMap<string, DefectBin>): PreparedWafer | null {
  if (!nonblank(source?.id) || !nonblank(source.batch) ||
    (source.label !== undefined && typeof source.label !== 'string') ||
    (source.pattern !== undefined && typeof source.pattern !== 'string') ||
    !Array.isArray(source.dies) || !source.dies.length || !validGeometry(source.geometry)) return null

  const geometry = source.geometry
  const { pitchX, pitchY, originX = 0, originY = 0, radius } = geometry
  const inAperture = aperture(geometry)
  const dies: PreparedDie[] = []
  const keys = new Set<string>()
  const bounds: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const die of source.dies) {
    if (!die || !Number.isSafeInteger(die.row) || !Number.isSafeInteger(die.column) || !statuses.has(die.status) ||
      (die.bin !== undefined && (die.status !== 'fail' || !bins.has(die.bin)))) return null

    const key = dieKey(die.row, die.column)
    if (keys.has(key)) return null
    keys.add(key)
    const x = originX + die.column * pitchX
    const y = originY + physicalRow(die.row, geometry) * pitchY
    const rect = footprint(die, geometry)
    if (![rect.minX, rect.maxX, rect.minY, rect.maxY].every(Number.isFinite) ||
      !(rect.minX < x && x < rect.maxX && rect.minY < y && y < rect.maxY) || !inAperture(rect)) return null

    dies.push({ row: die.row, column: die.column, status: die.status, bin: die.bin, key, x, y })
    bounds.minX = Math.min(bounds.minX, rect.minX)
    bounds.maxX = Math.max(bounds.maxX, rect.maxX)
    bounds.minY = Math.min(bounds.minY, rect.minY)
    bounds.maxY = Math.max(bounds.maxY, rect.maxY)
  }

  dies.sort((a, b) => a.row - b.row || a.column - b.column)
  const byKey = new Map(dies.map(die => [die.key, die]))
  return {
    source,
    dies,
    byKey,
    bounds: radius === undefined ? bounds : { minX: -radius, maxX: radius, minY: -radius, maxY: radius },
    clusters: failClusters(dies, byKey),
  }
}

export function prepareDefectData(data: SpatialDefectData): PreparedDefectData | null {
  if (!Array.isArray(data?.wafers) || !data.wafers.length || !Array.isArray(data.bins)) return null

  const binsById = new Map<string, DefectBin>()
  for (const bin of data.bins) {
    if (!nonblank(bin?.id) || !nonblank(bin.label) || binsById.has(bin.id)) return null
    binsById.set(bin.id, bin)
  }

  const wafers: PreparedWafer[] = []
  const byId = new Map<string, PreparedWafer>()
  for (const source of data.wafers) {
    const wafer = prepareWafer(source, binsById)
    if (!wafer || byId.has(source.id)) return null
    wafers.push(wafer)
    byId.set(source.id, wafer)
  }
  return { wafers, byId, binsById }
}

export function summarizeDies(dies: readonly WaferDie[]) {
  const counts = { pass: 0, fail: 0, missing: 0, untested: 0 }
  for (const { status } of dies) counts[status]++
  return { ...counts, total: dies.length, tested: counts.pass + counts.fail }
}

export function dieOutline(dies: readonly WaferDie[], geometry: WaferGeometry): readonly DieOutlineSegment[] {
  const occupied = new Set(dies.map(({ row, column }) => dieKey(row, column)))
  const up = geometry.rowDirection === 'down' ? -1 : 1
  const outline: DieOutlineSegment[] = []
  for (const die of dies) {
    const { row, column } = die
    const { minX, maxX, minY, maxY } = footprint(die, geometry)
    if (!occupied.has(dieKey(row - up, column))) outline.push([minX, minY, maxX, minY])
    if (!occupied.has(dieKey(row, column + 1))) outline.push([maxX, minY, maxX, maxY])
    if (!occupied.has(dieKey(row + up, column))) outline.push([maxX, maxY, minX, maxY])
    if (!occupied.has(dieKey(row, column - 1))) outline.push([minX, maxY, minX, minY])
  }
  return outline
}
