export type CadCoordinate = readonly [number, number, number]
export type CadAxis = 'x' | 'y' | 'z'
export type CadTriangle = readonly [number, number, number]
export type CadSegment = readonly [CadCoordinate, CadCoordinate]

export interface CadNominalMesh {
  vertices: readonly CadCoordinate[]
  triangles: readonly CadTriangle[]
}

export interface CadScanPoint {
  point: CadCoordinate
  closest: CadCoordinate
  deviationMm: number
}

export interface CadScanDeviationData {
  nominal: CadNominalMesh
  scan: readonly CadScanPoint[]
  sectionAxis?: CadAxis
  colorLimitMm?: number
  toleranceMm?: number
}

type Range = readonly [number, number]
export type CadBounds = readonly [Range, Range, Range]
export const cadAxes = ['X', 'Y', 'Z'] as const
export const cadIndices = [0, 1, 2] as const
export const cadSection = {
  x: { fixed: 0, horizontal: 1, vertical: 2 },
  y: { fixed: 1, horizontal: 0, vertical: 2 },
  z: { fixed: 2, horizontal: 0, vertical: 1 },
} as const

const colors = [
  [31, 79, 134], [92, 151, 192], [210, 220, 224], [220, 117, 82], [133, 39, 37],
] as const
export const cadPalette = colors.map((color) => `rgb(${color.join(',')})`)

export function cadColor(value: number, limit: number) {
  const scale = (Math.min(1, Math.max(-1, value / limit)) + 1) * (colors.length - 1) / 2
  const stop = Math.min(colors.length - 2, Math.floor(scale))
  const rgb = colors[stop].map((channel, index) => Math.round(channel + (colors[stop + 1][index] - channel) * (scale - stop)))
  return `rgb(${rgb.join(',')})`
}

function validVertex(value: CadCoordinate) {
  return value.length === 3 && value.every(Number.isFinite)
}

export function cadDelta([x, y, z]: CadCoordinate, [a, b, c]: CadCoordinate): CadCoordinate {
  return [x - a, y - b, z - c]
}

export function cadCross([a, b, c]: CadCoordinate, [x, y, z]: CadCoordinate): CadCoordinate {
  return [b * z - c * y, c * x - a * z, a * y - b * x]
}

export function analyseCadScan(data: CadScanDeviationData) {
  const { nominal: { vertices, triangles }, scan, sectionAxis = 'z', colorLimitMm, toleranceMm } = data
  if (vertices.length < 3 || !vertices.every(validVertex) || !triangles.length || !scan.length || !Object.hasOwn(cadSection, sectionAxis) ||
    (colorLimitMm !== undefined && (!Number.isFinite(colorLimitMm) || colorLimitMm <= 0)) ||
    (toleranceMm !== undefined && (!Number.isFinite(toleranceMm) || toleranceMm < 0)) ||
    !scan.every(({ point, closest, deviationMm }) => validVertex(point) && validVertex(closest) && Number.isFinite(deviationMm))) return null
  for (const triangle of triangles) {
    if (triangle.length !== 3 || !triangle.every((index) => Number.isSafeInteger(index) && index >= 0 && index < vertices.length) ||
        new Set(triangle).size !== 3) return null
    const [a, b, c] = triangle.map((index) => vertices[index])
    if (!(Math.hypot(...cadCross(cadDelta(b, a), cadDelta(c, a))) > 0)) return null
  }
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  const extend = (point: CadCoordinate) => {
    for (const axis of cadIndices) {
      lo[axis] = Math.min(lo[axis], point[axis])
      hi[axis] = Math.max(hi[axis], point[axis])
    }
  }
  vertices.forEach(extend)
  let largest = 0
  for (const sample of scan) {
    extend(sample.point)
    extend(sample.closest)
    largest = Math.max(largest, Math.abs(sample.deviationMm))
  }
  if (hi.some((value, index) => !(value > lo[index]) || !Number.isFinite(value - lo[index]))) return null
  const bounds = [[lo[0], hi[0]], [lo[1], hi[1]], [lo[2], hi[2]]] as const
  const { fixed } = cadSection[sectionAxis]
  const span = bounds[fixed][1] - bounds[fixed][0]
  const center = bounds[fixed][0] + span / 2
  const halfSlab = span * .0175
  let initial = 0
  let best = Infinity
  for (const [index, sample] of scan.entries()) {
    const distance = Math.max(0, Math.abs(sample.point[fixed] - center) - halfSlab)
    if (distance < best || (distance === best && Math.abs(sample.deviationMm) > Math.abs(scan[initial].deviationMm))) {
      initial = index
      best = distance
    }
  }
  const colorLimit = colorLimitMm ?? (largest || .1)
  return { bounds, sectionAxis, halfSlab, initial, colorLimit, tolerance: toleranceMm ?? colorLimit / 2 }
}

export function cadIntersections(mesh: CadNominalMesh, axis: 0 | 1 | 2, value: number) {
  const tolerance = 1e-8
  const result: CadSegment[] = []
  for (const triangle of mesh.triangles) {
    const vertices = triangle.map((index) => mesh.vertices[index])
    const distances = vertices.map((point) => point[axis] - value)
    if (distances.every((distance) => Math.abs(distance) < tolerance)) continue
    const points: CadCoordinate[] = []
    const add = (point: CadCoordinate) => {
      if (!points.some((existing) => Math.hypot(...cadDelta(existing, point)) < tolerance)) points.push(point)
    }
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3
      const a = vertices[i]
      const b = vertices[j]
      const from = distances[i]
      const to = distances[j]
      if (Math.abs(from) < tolerance) add(a)
      else if (from * to < 0 && Math.abs(to) >= tolerance) {
        const weight = from / (from - to)
        add([a[0] + (b[0] - a[0]) * weight, a[1] + (b[1] - a[1]) * weight, a[2] + (b[2] - a[2]) * weight])
      }
    }
    if (points.length === 2) result.push([points[0], points[1]])
  }
  return result
}
