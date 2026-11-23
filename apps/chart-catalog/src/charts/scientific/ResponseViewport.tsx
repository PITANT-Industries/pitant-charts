import { useEffect, useId, useMemo, useRef } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import type { ResponseBounds, ResponsePosition, ResponseSurfaceData, ResponseTriangle, ResponseTrial, ResponseVertex } from './response-surface-model'

export type SurfaceCamera = { yaw: number; pitch: number }
export const responsePitch = (pitch: number) => Math.max(.08, Math.min(1.48, pitch))
type ScreenPoint = { x: number; y: number; depth: number }
const colors = [[38, 63, 113], [45, 107, 149], [69, 151, 148], [162, 188, 107], [247, 215, 131]] as const
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })

function responseColor(value: number, [min, max]: readonly [number, number]) {
  const index = max === min ? 2 : Math.min(4, Math.max(0, (value - min) / (max - min) * 4))
  const start = Math.min(3, Math.floor(index))
  const rgb = colors[start].map((channel, channelIndex) =>
    Math.round(channel + ((colors[start + 1][channelIndex] - channel) * (index - start))))
  return `rgb(${rgb.join(',')})`
}

function projectSurface(bounds: ResponseBounds, mesh: readonly ResponseTriangle[], trials: readonly ResponseTrial[],
  width: number, height: number, camera: SurfaceCamera, compact: boolean) {
  const cy = Math.cos(camera.yaw)
  const sy = Math.sin(camera.yaw)
  const cp = Math.cos(camera.pitch)
  const sp = Math.sin(camera.pitch)
  const plotWidth = Math.max(1, width - 72)
  const normalize = (value: number, axis: 0 | 1 | 2) => (value - bounds[axis][0]) / (bounds[axis][1] - bounds[axis][0]) - .5
  function normalized([x, y, z]: ResponseVertex): ScreenPoint {
    const i = normalize(x, 0) * 1.45
    const j = normalize(y, 1) * 1.45
    const k = normalize(z, 2) * .88
    const horizontalDepth = sy * i + cy * j
    return { x: cy * i - sy * j, y: cp * k - sp * horizontalDepth, depth: cp * horizontalDepth + sp * k }
  }
  const nearX = sy >= 0 ? bounds[0][1] : bounds[0][0]
  const nearY = cy >= 0 ? bounds[1][1] : bounds[1][0]
  const leftX = cy >= 0 ? bounds[0][0] : bounds[0][1]
  const leftY = sy >= 0 ? bounds[1][1] : bounds[1][0]
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  function extend(point: ResponseVertex) {
    const projected = normalized(point)
    minX = Math.min(minX, projected.x)
    maxX = Math.max(maxX, projected.x)
    minY = Math.min(minY, projected.y)
    maxY = Math.max(maxY, projected.y)
  }
  for (const triangle of mesh) triangle.forEach(extend)
  if (!compact) {
    for (const x of bounds[0]) for (const y of bounds[1]) extend([x, y, bounds[2][0]])
    extend([leftX, leftY, bounds[2][1]])
    for (const trial of trials) extend([trial.x, trial.y, trial.response])
  }
  const left = compact ? 11 : 39
  const right = compact ? 11 : 15
  const top = compact ? 9 : 18
  const bottom = compact ? 9 : 38
  const fitWidth = Math.max(1, plotWidth - left - right)
  const fitHeight = Math.max(1, height - top - bottom)
  const scale = Math.min(fitWidth / (maxX - minX), fitHeight / (maxY - minY))
  const originX = left + fitWidth / 2 - (minX + maxX) / 2 * scale
  const originY = top + fitHeight / 2 + (minY + maxY) / 2 * scale
  return {
    nearX, nearY, leftX, leftY,
    point(source: ResponseVertex): ScreenPoint {
      const point = normalized(source)
      return { x: originX + point.x * scale, y: originY - point.y * scale, depth: point.depth }
    },
  }
}

function ResponseScale({ range, unit }: { range: readonly [number, number]; unit?: string }) {
  const id = useId()
  const [min, max] = range
  return (
    <svg className="response-scale" data-response-scale="" data-min={min} data-max={max}
      viewBox="0 0 64 150" role="img" aria-label={`Fitted response from ${numberFormat.format(min)} to ${numberFormat.format(max)} ${unit ?? ''}`}>
      <defs><linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
        {colors.map((color, index) => <stop key={index} offset={index / (colors.length - 1)} stopColor={`rgb(${color.join(',')})`} />)}
      </linearGradient></defs>
      <g className="scientific-axis">
        <text x="4" y="11">{unit || 'Fit'}</text>
        <rect x="5" y="24" width="9" height="106" fill={`url(#${id})`} />
        <rect x="5" y="24" width="9" height="106" className="scientific-frame" />
        {[[max, 24], [(min + max) / 2, 77], [min, 130]].map(([value, y]) =>
          <g key={y}><line className="scientific-tick" x1="14" x2="18" y1={y} y2={y} /><text x="21" y={y + 4}>{numberFormat.format(value)}</text></g>)}
      </g>
    </svg>
  )
}

function pickTriangle(point: ScreenPoint, corners: readonly ScreenPoint[]) {
  const [a, b, c] = corners
  const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(d) < 1e-8) return undefined
  const x = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / d
  const y = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / d
  const z = 1 - x - y
  return x >= -1e-8 && y >= -1e-8 && z >= -1e-8 ? [x, y, z] as const : undefined
}

export function ResponseViewport({ data, mesh, bounds, range, camera, section, selected, trial, compact, rotate, choose, chooseTrial }: {
  data: ResponseSurfaceData
  mesh: readonly ResponseTriangle[]
  bounds: ResponseBounds
  range: readonly [number, number]
  camera: SurfaceCamera
  section: readonly ResponseVertex[]
  selected: ResponseVertex
  trial?: ResponseTrial
  compact: boolean
  rotate: (next: SurfaceCamera) => void
  choose: (position: ResponsePosition) => void
  chooseTrial: (id: string) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 440 : 760, compact ? 245 : 416)
  const canvas = useRef<HTMLCanvasElement>(null)
  const gesture = useRef<{ pointer: number; x: number; y: number; camera: SurfaceCamera; moved: boolean } | undefined>(undefined)
  const projection = useMemo(() => projectSurface(bounds, mesh, data.trials, width, height, camera, compact),
    [bounds, mesh, data.trials, width, height, camera, compact])
  const scene = useMemo(() => {
    const faces = mesh.map((triangle) => {
      const corners = triangle.map(projection.point)
      return { triangle, corners, color: responseColor((triangle[0][2] + triangle[1][2] + triangle[2][2]) / 3, range),
        depth: (corners[0].depth + corners[1].depth + corners[2].depth) / 3 }
    }).sort((a, b) => a.depth - b.depth)
    const trials = compact ? [] : data.trials.map(({ id, x, y, response }) => ({
      id, measured: projection.point([x, y, response]), fitted: projection.point([x, y, data.evaluate(x, y)]),
    })).sort((a, b) => a.measured.depth - b.measured.depth)
    return { faces, trials }
  }, [mesh, projection, range, compact, data])
  const selectedPoint = projection.point(selected)
  const active = scene.trials.find(({ id }) => id === trial?.id)

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    const context = element.getContext('2d')
    if (!context) return
    const ctx = context
    ctx.scale(ratio, ratio)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    function line(a: ScreenPoint, b: ScreenPoint, color: string, weight = 1) {
      ctx.strokeStyle = color
      ctx.lineWidth = weight
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    function dot(point: ScreenPoint, radius: number, fill: string, border: string) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = border
      ctx.lineWidth = 1
      ctx.stroke()
    }
    const [xb, yb, zb] = bounds
    const floor = zb[0]
    if (!compact) {
      for (let index = 0; index <= 4; index++) {
        const x = xb[0] + (xb[1] - xb[0]) * index / 4
        const y = yb[0] + (yb[1] - yb[0]) * index / 4
        line(projection.point([x, yb[0], floor]), projection.point([x, yb[1], floor]), '#dbe2e6', .7)
        line(projection.point([xb[0], y, floor]), projection.point([xb[1], y, floor]), '#dbe2e6', .7)
      }
    }
    let sample = 0
    function drawTrial({ measured, fitted }: typeof scene.trials[number]) {
      line(measured, fitted, '#293a49', 1.05)
      dot(measured, 2.9, '#fff', '#203242')
    }
    for (const face of scene.faces) {
      while (sample < scene.trials.length && scene.trials[sample].measured.depth < face.depth) drawTrial(scene.trials[sample++])
      const [a, b, c] = face.corners
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(c.x, c.y)
      ctx.closePath()
      ctx.fillStyle = face.color
      ctx.fill()
      ctx.strokeStyle = face.color
      ctx.lineWidth = .65
      ctx.stroke()
    }
    while (sample < scene.trials.length) drawTrial(scene.trials[sample++])
    if (!compact) {
      const points = section.map(projection.point)
      for (let index = 1; index < points.length; index++) {
        line(points[index - 1], points[index], '#f9fbfe', 2.6)
        line(points[index - 1], points[index], '#183951', 1.25)
      }
      dot(selectedPoint, 4.4, '#fff', '#183951')
      if (active) {
        line(active.fitted, active.measured, '#25384c', 1.7)
        dot(active.measured, 4.5, '#a44d31', '#fff')
      }
      const { nearX, nearY, leftX, leftY } = projection
      const xAt = (x: number) => projection.point([x, nearY, floor])
      const yAt = (y: number) => projection.point([nearX, y, floor])
      const zAt = (z: number) => projection.point([leftX, leftY, z])
      const axisLine = '#526370'
      ctx.fillStyle = '#293946'
      ctx.font = '11px Arial, sans-serif'
      ctx.textAlign = 'center'
      line(xAt(xb[0]), xAt(xb[1]), axisLine)
      line(yAt(yb[0]), yAt(yb[1]), axisLine)
      line(zAt(zb[0]), zAt(zb[1]), axisLine)
      for (const index of [0, 1, 2]) {
        const fraction = index / 2
        const x = xb[0] + (xb[1] - xb[0]) * fraction
        const y = yb[0] + (yb[1] - yb[0]) * fraction
        const xx = xAt(x)
        const yy = yAt(y)
        line(xx, { ...xx, y: xx.y + 4 }, axisLine)
        line(yy, { ...yy, y: yy.y + 4 }, axisLine)
        ctx.fillText(numberFormat.format(x), xx.x, xx.y + 15)
        if (y !== nearY) ctx.fillText(numberFormat.format(y), yy.x, yy.y + 15)
      }
      const zRough = (zb[1] - zb[0]) / (width >= 350 ? 4 : 2)
      const zPower = 10 ** Math.floor(Math.log10(zRough))
      const zStep = ([1, 2, 2.5, 5, 10].find((value) => value * zPower >= zRough) ?? 10) * zPower
      ctx.textAlign = 'right'
      for (let index = Math.ceil(zb[0] / zStep); index <= Math.floor(zb[1] / zStep); index++) {
        const zz = zAt(index * zStep)
        line(zz, { ...zz, x: zz.x - 4 }, axisLine)
        ctx.fillText(numberFormat.format(index * zStep), zz.x - 7, zz.y + 3)
      }
      ctx.textAlign = 'center'
      const xTitle = xAt((xb[0] + xb[1]) / 2)
      const yTitle = yAt((yb[0] + yb[1]) / 2)
      const zTitle = zAt(zb[1])
      ctx.font = 'italic 13px Georgia, serif'
      ctx.fillText('X', xTitle.x, xTitle.y + 29)
      ctx.fillText('Y', yTitle.x, yTitle.y + 29)
      ctx.fillText('Z', zTitle.x, zTitle.y - 8)
    }
  }, [scene, projection, bounds, section, active, compact, selectedPoint.x, selectedPoint.y, selectedPoint.depth, width, height])

  function cancel(event: PointerEvent<HTMLCanvasElement>) {
    if (gesture.current?.pointer === event.pointerId) gesture.current = undefined
  }

  function release(event: PointerEvent<HTMLCanvasElement>) {
    const down = gesture.current
    if (down?.pointer !== event.pointerId) return
    gesture.current = undefined
    if (down.moved) return
    const rect = event.currentTarget.getBoundingClientRect()
    const clicked = { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height, depth: 0 }
    const trialHit = [...scene.trials].reverse().find(({ measured }) => Math.hypot(measured.x - clicked.x, measured.y - clicked.y) <= 6)
    if (trialHit) {
      chooseTrial(trialHit.id)
      return
    }
    let nearest = -Infinity
    let picked: ResponsePosition | undefined
    for (const { triangle, corners } of scene.faces) {
      const weight = pickTriangle(clicked, corners)
      if (!weight) continue
      const depth = weight.reduce((sum, value, index) => sum + value * corners[index].depth, 0)
      if (depth > nearest) {
        nearest = depth
        picked = [
          weight.reduce((sum, value, index) => sum + value * triangle[index][0], 0),
          weight.reduce((sum, value, index) => sum + value * triangle[index][1], 0),
        ]
      }
    }
    if (picked) choose(picked)
  }

  return (
    <div className="response-viewport scientific-plot" ref={plot}>
      <canvas data-response-viewport="" ref={canvas} data-yaw={camera.yaw} data-pitch={camera.pitch}
        data-face-count={scene.faces.length} data-trial-count={scene.trials.length} data-selected-trial={trial?.id}
        data-selected-x={selectedPoint.x} data-selected-y={selectedPoint.y} data-trial-x={active?.measured.x} data-trial-y={active?.measured.y}
        role="img" aria-label="Three-dimensional fitted response surface with observed trials" tabIndex={compact ? undefined : 0}
        aria-keyshortcuts={compact ? undefined : 'ArrowUp ArrowDown'}
        onKeyDown={compact ? undefined : (event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          rotate({ yaw: camera.yaw, pitch: responsePitch(camera.pitch + (event.key === 'ArrowUp' ? .18 : -.18)) })
        }}
        onPointerDown={compact ? undefined : (event) => {
          if (!event.isPrimary || event.button !== 0) return
          gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, camera, moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={compact ? undefined : (event) => {
          const down = gesture.current
          if (down?.pointer !== event.pointerId) return
          const dx = event.clientX - down.x
          const dy = event.clientY - down.y
          if (!down.moved && Math.hypot(dx, dy) < 3) return
          down.moved = true
          rotate({ yaw: down.camera.yaw + dx * .012, pitch: responsePitch(down.camera.pitch + dy * .012) })
        }}
        onPointerUp={compact ? undefined : release} onPointerCancel={cancel} onLostPointerCapture={cancel} />
      <ResponseScale range={range} unit={data.responseAxis.unit} />
    </div>
  )
}
