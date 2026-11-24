import { responseTurn } from './response-surface-model'
import type { ResponsePosition, ResponseTriangle, ResponseVertex } from './response-surface-model'

type ContourBand = { min: number; max: number; polygons: ResponsePosition[][] }
type ContourSegment = readonly [ResponsePosition, ResponsePosition]
type ContourLine = { level: number; segments: ContourSegment[] }

function interiorLevels(min: number, max: number) {
  const target = (max - min) / 6
  const power = 10 ** Math.floor(Math.log10(target))
  if (!(power > 0) || !Number.isFinite(power)) return []
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power)
    .reduce((best, candidate) => Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best)
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  const margin = step * .15
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return []
  const levels: number[] = []
  for (let index = first; index <= last; index++) {
    const level = index * step
    if (level > min + margin && level < max - margin) levels.push(level)
  }
  return levels
}

function onEdge(a: ResponseVertex, b: ResponseVertex, level: number): ResponsePosition {
  const [low, high] = a[2] < b[2] ? [a, b] : [b, a]
  const fraction = (level - low[2]) / (high[2] - low[2])
  return [
    low[0] * (1 - fraction) + high[0] * fraction,
    low[1] * (1 - fraction) + high[1] * fraction,
  ]
}

function clipTriangle(triangle: ResponseTriangle, min: number, max: number) {
  const result: ResponsePosition[] = []
  for (const [index, a] of triangle.entries()) {
    const b = triangle[(index + 1) % 3]
    if (a[2] >= min && a[2] <= max) result.push([a[0], a[1]])
    const lower = Math.min(a[2], b[2])
    const upper = Math.max(a[2], b[2])
    const thresholds = min === max ? [min] : a[2] < b[2] ? [min, max] : [max, min]
    for (const level of thresholds) {
      if (lower < level && level < upper) result.push(onEdge(a, b, level))
    }
  }
  return result
}

function hasArea(points: readonly ResponsePosition[]) {
  return points.slice(2).some((point, index) => responseTurn(points[0], points[index + 1], point) !== 0)
}

export function buildResponseContours(mesh: readonly ResponseTriangle[], [min, max]: readonly [number, number]) {
  const bands: ContourBand[] = []
  const contours: ContourLine[] = []
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return { bands, contours }

  const levels = interiorLevels(min, max)
  const edges = [min, ...levels, max]
  for (let index = 1; index < edges.length; index++) {
    bands.push({ min: edges[index - 1], max: edges[index], polygons: [] })
  }
  const seen = levels.map(() => new Set<string>())
  for (const level of levels) contours.push({ level, segments: [] })

  for (const triangle of mesh) {
    const [a, b, c] = triangle
    if (!triangle.every((vertex) => vertex.every(Number.isFinite)) ||
      responseTurn([a[0], a[1]], [b[0], b[1]], [c[0], c[1]]) === 0) continue
    const low = Math.min(a[2], b[2], c[2])
    const high = Math.max(a[2], b[2], c[2])
    for (const [index, band] of bands.entries()) {
      const lastBand = index === bands.length - 1
      if (high < band.min || low > band.max || (!lastBand && low === band.max)) continue
      const polygon = clipTriangle(triangle, band.min, band.max)
      if (hasArea(polygon)) band.polygons.push(polygon)
    }
    if (low === high) continue
    for (const [index, contour] of contours.entries()) {
      if (contour.level < low || contour.level > high) continue
      const points = clipTriangle(triangle, contour.level, contour.level)
      if (points.length !== 2) continue
      const [start, end] = points
      const first = start.join(',')
      const last = end.join(',')
      if (first === last) continue
      const key = first < last ? `${first};${last}` : `${last};${first}`
      if (seen[index].has(key)) continue
      seen[index].add(key)
      contour.segments.push([start, end])
    }
  }
  return { bands, contours }
}
