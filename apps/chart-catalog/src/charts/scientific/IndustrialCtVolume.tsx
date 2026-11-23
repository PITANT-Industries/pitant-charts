import { useEffect, useMemo, useRef } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import type { CtCoordinate, CtFace, IndustrialCtData } from './industrial-ct-model'

export type CtAngle = { yaw: number; pitch: number }
type Projection = { x: number; y: number; depth: number }
type ProjectedFace = { pore: number; points: readonly Projection[]; depth: number; light: number }

const boxEdges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]] as const
const faceCorners = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]] as const

function projectScene(data: IndustrialCtData, faces: readonly CtFace[], width: number, height: number, { yaw, pitch }: CtAngle) {
  const lengths = data.dimensions.map((count, axis) => count * data.spacingUm[axis])
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)

  function rotate(x: number, y: number, z: number): CtCoordinate {
    const lateral = sy * x + cy * y
    return [cy * x - sy * y, cp * z - sp * lateral, cp * lateral + sp * z]
  }

  function world([x, y, z]: CtCoordinate): CtCoordinate {
    return rotate((x + .5) * data.spacingUm[0] - lengths[0] / 2,
      (y + .5) * data.spacingUm[1] - lengths[1] / 2, (z + .5) * data.spacingUm[2] - lengths[2] / 2)
  }

  const boxWorld = Array.from({ length: 8 }, (_, i) => world([
    i & 1 ? data.dimensions[0] - .5 : -.5,
    i & 2 ? data.dimensions[1] - .5 : -.5,
    i & 4 ? data.dimensions[2] - .5 : -.5,
  ]))
  const boxWidth = 2 * Math.max(...boxWorld.map(([x]) => Math.abs(x)))
  const boxHeight = 2 * Math.max(...boxWorld.map(([, y]) => Math.abs(y)))
  const scale = Math.min(Math.max(1, width - 38) / boxWidth, Math.max(1, height - 34) / boxHeight)
  function screen([u, v, depth]: CtCoordinate): Projection {
    return { x: width / 2 + u * scale, y: height / 2 - v * scale, depth }
  }

  const box = boxWorld.map(screen)
  const projected: ProjectedFace[] = []
  for (const face of faces) {
    const normal: [number, number, number] = [0, 0, 0]
    normal[face.axis] = face.sign
    const apparent = rotate(...normal)[2]
    if (apparent <= 0) continue
    const first = (face.axis + 1) % 3
    const second = (face.axis + 2) % 3
    const corners = faceCorners.map(([a, b]) => {
      const position: [number, number, number] = [...face.center]
      position[face.axis] += .5 * face.sign
      position[first] += a
      position[second] += b
      return screen(world(position))
    })
    projected.push({
      pore: face.pore,
      points: corners,
      depth: corners.reduce((sum, vertex) => sum + vertex.depth, 0) / 4,
      light: .58 + apparent * .42,
    })
  }
  projected.sort((a, b) => a.depth - b.depth)
  return { box, faces: projected }
}

function covers(points: readonly Projection[], x: number, y: number) {
  let orientation = 0
  for (const [index, a] of points.entries()) {
    const b = points[(index + 1) % points.length]
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
    const side = Math.sign(cross)
    if (side && orientation && side !== orientation) return false
    orientation ||= side
  }
  return orientation !== 0
}

export function IndustrialCtVolume({ data, faces, selected, angle, rotate, pick }: {
  data: IndustrialCtData
  faces: readonly CtFace[]
  selected?: number
  angle: CtAngle
  rotate: (angle: CtAngle) => void
  pick: (id: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(350, 285)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; angle: CtAngle; moved: boolean } | undefined>(undefined)
  const scene = useMemo(() => projectScene(data, faces, width, height, angle), [data, faces, width, height, angle])

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const resolution = Math.min(2, globalThis.devicePixelRatio || 1)
    element.width = Math.round(width * resolution)
    element.height = Math.round(height * resolution)
    const ctx = element.getContext('2d')
    if (!ctx) return
    ctx.scale(resolution, resolution)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#829099'
    ctx.lineWidth = .8
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    for (const [a, b] of boxEdges) {
      ctx.moveTo(scene.box[a].x, scene.box[a].y)
      ctx.lineTo(scene.box[b].x, scene.box[b].y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    for (const { pore, points, light } of scene.faces) {
      const [red, green, blue] = pore === selected ? [185, 80, 48] : [70, 120, 151]
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(({ x, y }) => ctx.lineTo(x, y))
      ctx.closePath()
      ctx.fillStyle = `rgb(${Math.round(red * light)}, ${Math.round(green * light)}, ${Math.round(blue * light)})`
      ctx.fill()
      ctx.strokeStyle = ctx.fillStyle
      ctx.lineWidth = .45
      ctx.stroke()
    }
    ctx.fillStyle = '#334550'
    ctx.font = '11px Arial, sans-serif'
    const corner = scene.box[0]
    for (const [axis, end] of [['X', 1], ['Y', 2], ['Z', 4]] as const) {
      const endpoint = scene.box[end]
      const dx = endpoint.x - corner.x
      const dy = endpoint.y - corner.y
      const length = Math.hypot(dx, dy) || 1
      ctx.fillText(axis, endpoint.x + dx / length * 8 - 3, endpoint.y + dy / length * 8 + 4)
    }
  }, [scene, width, height, selected])

  function down(event: PointerEvent<HTMLCanvasElement>) {
    drag.current = { x: event.clientX, y: event.clientY, angle, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = drag.current
    if (!active) return
    const dx = event.clientX - active.x
    const dy = event.clientY - active.y
    if (!active.moved && Math.hypot(dx, dy) < 3) return
    active.moved = true
    rotate({ yaw: active.angle.yaw + dx * .012, pitch: Math.max(-1.48, Math.min(1.48, active.angle.pitch + dy * .012)) })
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    const active = drag.current
    drag.current = undefined
    if (!active || active.moved) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * width / rect.width
    const y = (event.clientY - rect.top) * height / rect.height
    for (let index = scene.faces.length - 1; index >= 0; index--) {
      const face = scene.faces[index]
      if (covers(face.points, x, y)) {
        pick(face.pore)
        return
      }
    }
  }

  return (
    <div className="ct-volume-panel scientific-plot">
      <p className="ct-volume-title">Pore surfaces</p>
      <div className="ct-volume-canvas" ref={plot}>
        <canvas ref={canvas} data-ct-volume-render="" data-yaw={angle.yaw} data-pitch={angle.pitch}
          data-face-count={scene.faces.length} data-pore={selected} role="img" aria-label="Orthographic view of segmented pore surfaces"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = undefined }} />
      </div>
      <div className="ct-rotation">
        <button type="button" onClick={() => rotate({ ...angle, yaw: angle.yaw - Math.PI / 12 })}>Rotate left</button>
        <button type="button" onClick={() => rotate({ ...angle, yaw: angle.yaw + Math.PI / 12 })}>Rotate right</button>
      </div>
    </div>
  )
}
