export type ResponsePosition = readonly [x: number, y: number]
export type ResponseVertex = readonly [x: number, y: number, response: number]
export type ResponseTriangle = readonly [ResponseVertex, ResponseVertex, ResponseVertex]
export type ResponseBounds = readonly [readonly [number, number], readonly [number, number], readonly [number, number]]
export type ResponseAxis = { label: string; unit?: string }
export type ResponseFactor = 'x' | 'y'

export interface ResponseTrial {
  id: string
  x: number
  y: number
  response: number
}

export interface ResponseSurfaceData {
  xAxis: ResponseAxis
  yAxis: ResponseAxis
  responseAxis: ResponseAxis
  domain?: readonly ResponsePosition[]
  trials: readonly ResponseTrial[]
  evaluate: (x: number, y: number) => number
  initialPosition?: ResponsePosition
  sectionAxis?: ResponseFactor
}

export function responseTurn([ax, ay]: ResponsePosition, [bx, by]: ResponsePosition, [x, y]: ResponsePosition) {
  return (bx - ax) * (y - ay) - (by - ay) * (x - ax)
}

function responseHull(points: readonly ResponsePosition[]) {
  const ordered = [...points].sort(([ax, ay], [bx, by]) => ax - bx || ay - by)
  function chain(vertices: readonly ResponsePosition[]) {
    const current: ResponsePosition[] = []
    for (const vertex of vertices) {
      while (current.length >= 2 && responseTurn(current[current.length - 2], current[current.length - 1], vertex) <= 0) current.pop()
      current.push(vertex)
    }
    return current.slice(0, -1)
  }
  return [...chain(ordered), ...chain(ordered.reverse())]
}

export function responseContains(hull: readonly ResponsePosition[], point: ResponsePosition) {
  return hull.every((a, index) => {
    const b = hull[(index + 1) % hull.length]
    const xSize = Math.max(Math.abs(a[0]), Math.abs(b[0]), Math.abs(point[0]))
    const ySize = Math.max(Math.abs(a[1]), Math.abs(b[1]), Math.abs(point[1]))
    const tolerance = Number.EPSILON * 128 * (Math.abs(b[0] - a[0]) * ySize + Math.abs(b[1] - a[1]) * xSize)
    return responseTurn(a, b, point) >= -tolerance
  })
}

function domainCenter(hull: readonly ResponsePosition[]): ResponsePosition {
  return [
    hull.reduce((sum, point) => sum + point[0] / hull.length, 0),
    hull.reduce((sum, point) => sum + point[1] / hull.length, 0),
  ]
}

function responseMesh(hull: readonly ResponsePosition[], center: ResponsePosition, evaluate: ResponseSurfaceData['evaluate']) {
  const resolution = 13
  const mesh: ResponseTriangle[] = []
  for (const [index, a] of hull.entries()) {
    const b = hull[(index + 1) % hull.length]
    const fan: ResponseVertex[][] = []
    for (let i = 0; i <= resolution; i++) {
      const row: ResponseVertex[] = []
      for (let j = 0; j <= resolution - i; j++) {
        const x = center[0] + (a[0] - center[0]) * i / resolution + (b[0] - center[0]) * j / resolution
        const y = center[1] + (a[1] - center[1]) * i / resolution + (b[1] - center[1]) * j / resolution
        row.push([x, y, evaluate(x, y)])
      }
      fan.push(row)
    }
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution - i; j++) {
        mesh.push([fan[i][j], fan[i + 1][j], fan[i][j + 1]])
        if (j < resolution - i - 1) mesh.push([fan[i + 1][j], fan[i + 1][j + 1], fan[i][j + 1]])
      }
    }
  }
  return mesh
}

export function responseSection(hull: readonly ResponsePosition[], fixed: ResponseFactor, value: number) {
  const axis = fixed === 'x' ? 0 : 1
  const other = axis === 0 ? 1 : 0
  const intersections: number[] = []
  for (const [index, a] of hull.entries()) {
    const b = hull[(index + 1) % hull.length]
    if (a[axis] === value) intersections.push(a[other])
    if ((a[axis] < value && value < b[axis]) || (b[axis] < value && value < a[axis])) {
      const fraction = (value - a[axis]) / (b[axis] - a[axis])
      intersections.push(a[other] + fraction * (b[other] - a[other]))
    }
  }
  if (!intersections.length) return undefined
  return [Math.min(...intersections), Math.max(...intersections)] as const
}

export function responsePosition(fixed: ResponseFactor, position: number, varying: number): ResponsePosition {
  return fixed === 'x' ? [position, varying] : [varying, position]
}

export function responseAxisLabel({ label, unit }: ResponseAxis) {
  return unit ? `${label} (${unit})` : label
}

export function analyseResponseSurface(data: ResponseSurfaceData) {
  const { trials, domain, evaluate, initialPosition, sectionAxis = 'x' } = data
  const ids = new Set<string>()
  for (const { id, x, y, response } of trials) {
    if (!id || ids.has(id) || ![x, y, response].every(Number.isFinite)) return null
    ids.add(id)
  }
  const points = domain ?? trials.map(({ x, y }) => [x, y] as const)
  if (points.length < 3 || !points.every((point) => point.length === 2 && point.every(Number.isFinite)) ||
    (sectionAxis !== 'x' && sectionAxis !== 'y') || typeof evaluate !== 'function') return null
  const hull = responseHull(points)
  if (hull.length < 3 || !trials.every(({ x, y }) => responseContains(hull, [x, y]))) return null
  const center = domainCenter(hull)
  const mesh = responseMesh(hull, center, evaluate)
  let fitMin = Infinity
  let fitMax = -Infinity
  for (const triangle of mesh) {
    for (const vertex of triangle) {
      if (!Number.isFinite(vertex[2])) return null
      fitMin = Math.min(fitMin, vertex[2])
      fitMax = Math.max(fitMax, vertex[2])
    }
  }
  let observedMin = fitMin
  let observedMax = fitMax
  for (const trial of trials) {
    const fitted = evaluate(trial.x, trial.y)
    if (!Number.isFinite(fitted)) return null
    observedMin = Math.min(observedMin, trial.response, fitted)
    observedMax = Math.max(observedMax, trial.response, fitted)
  }
  const headroom = (observedMax - observedMin) * .09 || Math.max(.1, Math.abs(observedMax) * .05)
  const bounds: ResponseBounds = [
    [Math.min(...hull.map(([x]) => x)), Math.max(...hull.map(([x]) => x))],
    [Math.min(...hull.map(([, y]) => y)), Math.max(...hull.map(([, y]) => y))],
    [observedMin - headroom, observedMax + headroom],
  ]
  const initial = initialPosition?.every(Number.isFinite) && responseContains(hull, initialPosition) ? initialPosition : center
  return { hull, mesh, bounds, initial, fitRange: [fitMin, fitMax] as const, sectionAxis }
}
