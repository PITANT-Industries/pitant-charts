export type ChromaticityPoint = readonly [number, number]
export type ChromaticitySpace = 'xy' | 'uv'

export interface CieSpectralSample {
  wavelengthNm: number
  xy: ChromaticityPoint
}

export interface CieGamut {
  id: string
  label: string
  primaries: readonly ChromaticityPoint[]
  white?: ChromaticityPoint
}

export interface CieColorSample {
  id: string
  label: string
  xy: ChromaticityPoint
}

export interface CieChromaticityData {
  locus: readonly CieSpectralSample[]
  gamuts: readonly CieGamut[]
  samples?: readonly CieColorSample[]
  initialGamuts?: readonly [string, string]
  initialPoint?: ChromaticityPoint
}

const epsilon = 1e-12

function turn([ax, ay]: ChromaticityPoint, [bx, by]: ChromaticityPoint, [x, y]: ChromaticityPoint) {
  return (bx - ax) * (y - ay) - (by - ay) * (x - ax)
}

export function cieUv([x, y]: ChromaticityPoint): ChromaticityPoint {
  const divisor = -2 * x + 12 * y + 3
  return [4 * x / divisor, 9 * y / divisor]
}

export function cieXy([u, v]: ChromaticityPoint): ChromaticityPoint {
  const divisor = 6 * u - 16 * v + 12
  return [9 * u / divisor, 4 * v / divisor]
}

function isXy(point: ChromaticityPoint) {
  const [x, y] = point
  return point.length === 2 && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x + y <= 1.000001
}

export function cieContains(polygon: readonly ChromaticityPoint[], point: ChromaticityPoint) {
  const [x, y] = point
  let inside = false
  for (const [index, a] of polygon.entries()) {
    const b = polygon[(index + 1) % polygon.length]
    const edge = turn(a, b, point)
    if (Math.abs(edge) <= epsilon && x >= Math.min(a[0], b[0]) - epsilon && x <= Math.max(a[0], b[0]) + epsilon &&
      y >= Math.min(a[1], b[1]) - epsilon && y <= Math.max(a[1], b[1]) + epsilon) return true
    if ((a[1] > y) !== (b[1] > y) && x < a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])) inside = !inside
  }
  return inside
}

function convexHull(points: readonly ChromaticityPoint[]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  function chain(vertices: readonly ChromaticityPoint[]) {
    const result: ChromaticityPoint[] = []
    for (const vertex of vertices) {
      while (result.length >= 2 && turn(result[result.length - 2], result[result.length - 1], vertex) <= epsilon) result.pop()
      result.push(vertex)
    }
    return result.slice(0, -1)
  }
  return [...chain(sorted), ...chain(sorted.reverse())]
}

export function cieArea(polygon: readonly ChromaticityPoint[]) {
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + point[0] * next[1] - point[1] * next[0]
  }, 0)) / 2
}

export function cieIntersect(subject: readonly ChromaticityPoint[], mask: readonly ChromaticityPoint[]) {
  let previous = [...subject]
  for (const [index, a] of mask.entries()) {
    if (!previous.length) break
    const b = mask[(index + 1) % mask.length]
    const clipped: ChromaticityPoint[] = []
    let from = previous[previous.length - 1]
    let before = turn(a, b, from)
    for (const to of previous) {
      const after = turn(a, b, to)
      if ((before >= -epsilon) !== (after >= -epsilon)) {
        const weight = Math.max(0, Math.min(1, before / (before - after)))
        clipped.push([from[0] + (to[0] - from[0]) * weight, from[1] + (to[1] - from[1]) * weight])
      }
      if (after >= -epsilon) clipped.push(to)
      from = to
      before = after
    }
    previous = clipped
  }
  return previous
}

export function cieDomain(points: readonly ChromaticityPoint[], space: ChromaticitySpace): ChromaticityPoint {
  return points.reduce<ChromaticityPoint>(([xmax, ymax], [x, y]) => [
    Math.max(xmax, Math.ceil(x * 20) / 20),
    Math.max(ymax, Math.ceil(y * 20) / 20),
  ], space === 'xy' ? [.8, .9] : [.65, .65])
}

export function analyseCieChromaticity(data: CieChromaticityData) {
  if (data.locus.length < 3 || !data.gamuts.length) return null
  const locus = data.locus.map(({ xy }) => xy)
  if (!data.locus.every(({ wavelengthNm, xy }, index) => Number.isFinite(wavelengthNm) && wavelengthNm > 0 &&
    (index === 0 || wavelengthNm > data.locus[index - 1].wavelengthNm) && isXy(xy)) || cieArea(locus) <= epsilon) return null
  const gamuts = new Map<string, CieGamut & { hull: ChromaticityPoint[] }>()
  for (const gamut of data.gamuts) {
    if (!gamut.id || !gamut.label || gamuts.has(gamut.id) || gamut.primaries.length < 3 || !gamut.primaries.every(isXy) ||
      (gamut.white && !isXy(gamut.white))) return null
    const hull = convexHull(gamut.primaries)
    if (cieArea(hull) <= epsilon || (gamut.white && !cieContains(hull, gamut.white))) return null
    gamuts.set(gamut.id, { ...gamut, hull })
  }
  const samples = new Map<string, CieColorSample>()
  for (const sample of data.samples ?? []) {
    if (!sample.id || !sample.label || samples.has(sample.id) || !isXy(sample.xy) || !cieContains(locus, sample.xy)) return null
    samples.set(sample.id, sample)
  }
  const reference = gamuts.get(data.initialGamuts?.[0] ?? '') ?? gamuts.get(data.gamuts[0].id)!
  const comparison = gamuts.get(data.initialGamuts?.[1] ?? '') ?? gamuts.get((data.gamuts[1] ?? data.gamuts[0]).id)!
  const start = data.initialPoint ?? reference.white
  const initialPoint = start && isXy(start) && cieContains(locus, start) ? start : locus[Math.floor(locus.length / 2)]
  return { locus, gamuts, samples, reference, comparison, initialPoint }
}

export function cieCompare(reference: readonly ChromaticityPoint[], comparison: readonly ChromaticityPoint[]) {
  const intersection = cieIntersect(reference, comparison)
  const referenceArea = cieArea(reference)
  const comparisonArea = cieArea(comparison)
  const intersectionArea = Math.min(referenceArea, comparisonArea, cieArea(intersection))
  return {
    intersection, referenceArea, comparisonArea, intersectionArea,
    coverage: intersectionArea / referenceArea,
    comparisonCoverage: intersectionArea / comparisonArea,
  }
}
