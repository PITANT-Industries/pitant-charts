import { useEffect, useId, useMemo, useRef } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import { cadColor, cadCross, cadDelta, cadIndices, cadPalette } from './cad-scan-model'
import type { CadBounds, CadCoordinate, CadScanDeviationData, CadSegment } from './cad-scan-model'

export type CadCamera = { yaw: number; pitch: number }
type Screen = { x: number; y: number; depth: number }
const format = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
const clampPitch = (pitch: number) => Math.max(-1.5, Math.min(1.5, pitch))
const pointRadius = 1.45

function project(bounds: CadBounds, width: number, height: number, { yaw, pitch }: CadCamera) {
  const center = bounds.map(([min, max]) => (min + max) / 2)
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  const horizontalArea = Math.max(1, width - 79)

  function rotate(x: number, y: number, z: number): CadCoordinate {
    const behind = sinYaw * x + cosYaw * y
    return [cosYaw * x - sinYaw * y, cosPitch * z - sinPitch * behind, sinPitch * z + cosPitch * behind]
  }
  function raw([x, y, z]: CadCoordinate) {
    return rotate(x - center[0], y - center[1], z - center[2])
  }
  const extent = Array.from({ length: 8 }, (_, index) => raw([
    bounds[0][index & 1 ? 1 : 0], bounds[1][index & 2 ? 1 : 0], bounds[2][index & 4 ? 1 : 0],
  ]))
  const spanX = 2 * Math.max(...extent.map(([x]) => Math.abs(x)))
  const spanY = 2 * Math.max(...extent.map(([, y]) => Math.abs(y)))
  const scale = Math.min(Math.max(1, horizontalArea - 24) / spanX, Math.max(1, height - 48) / spanY)
  function point(source: CadCoordinate): Screen {
    const [x, y, depth] = raw(source)
    return { x: horizontalArea / 2 + x * scale, y: height / 2 - y * scale, depth }
  }
  return { point, rotate, scale }
}

function DeviationScale({ limit }: { limit: number }) {
  const gradient = useId()
  return (
    <svg className="cad-deviation-scale" data-cad-colorbar="" data-min={-limit} data-max={limit}
      viewBox="0 0 72 170" role="img" aria-label={`Signed deviation from minus ${limit} to plus ${limit} millimeters`}>
      <defs>
        <linearGradient id={gradient} x1="0%" y1="100%" x2="0%" y2="0%">
          {cadPalette.map((color, index) => <stop offset={index / (cadPalette.length - 1)} stopColor={color} key={color} />)}
        </linearGradient>
      </defs>
      <g className="scientific-axis">
        <text x="6" y="12">Δ (mm)</text>
        <rect x="7" y="24" width="10" height="128" fill={`url(#${gradient})`} />
        <rect x="7" y="24" width="10" height="128" className="scientific-frame" />
        {[[limit, 24], [0, 88], [-limit, 152]].map(([value, y]) => (
          <g key={value}>
            <line className="scientific-tick" x1="17" x2="21" y1={y} y2={y} />
            <text x="24" y={y + 4}>{value > 0 ? '+' : ''}{format.format(value).replace('-', '−')}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

export function CadScanViewport({ data, bounds, camera, visible, selected, nominal, limit, section, compact, rotate, pick }: {
  data: CadScanDeviationData
  bounds: CadBounds
  camera: CadCamera
  visible: readonly number[]
  selected?: number
  nominal: boolean
  limit: number
  section: readonly CadSegment[]
  compact: boolean
  rotate: (camera: CadCamera) => void
  pick: (index: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 432 : 780, compact ? 178 : 390)
  const canvas = useRef<HTMLCanvasElement>(null)
  const gesture = useRef<{ x: number; y: number; camera: CadCamera; moved: boolean } | undefined>(undefined)
  const projection = useMemo(() => project(bounds, width, height, camera), [bounds, width, height, camera])
  const scene = useMemo(() => {
    const points = visible.map((index) => ({ index, ...projection.point(data.scan[index].point) })).sort((a, b) => a.depth - b.depth)
    const vertices = data.nominal.vertices.map(projection.point)
    const faces = nominal ? data.nominal.triangles.flatMap(([ia, ib, ic]) => {
      const [a, b, c] = [data.nominal.vertices[ia], data.nominal.vertices[ib], data.nominal.vertices[ic]]
      const normal = cadCross(cadDelta(b, a), cadDelta(c, a))
      const facing = projection.rotate(...normal)[2] / Math.hypot(...normal)
      if (facing <= 0) return []
      const corners = [vertices[ia], vertices[ib], vertices[ic]]
      return [{ corners, depth: corners.reduce((sum, corner) => sum + corner.depth, 0) / 3, facing }]
    }).sort((a, b) => a.depth - b.depth) : []
    return { points, faces }
  }, [data, visible, projection, nominal])
  const active = selected === undefined ? undefined : data.scan[selected]
  const activePoint = active ? projection.point(active.point) : undefined

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    const ctx = element.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    const drawFace = ({ corners, facing }: typeof scene.faces[number]) => {
      const value = 216 + Math.round(facing * 32)
      ctx.fillStyle = `rgba(${value - 8},${value},${value + 5},.68)`
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      ctx.lineTo(corners[1].x, corners[1].y)
      ctx.lineTo(corners[2].x, corners[2].y)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(92,113,126,.18)'
      ctx.lineWidth = .55
      ctx.stroke()
    }
    let face = 0
    for (const point of scene.points) {
      while (face < scene.faces.length && scene.faces[face].depth < point.depth) drawFace(scene.faces[face++])
      ctx.beginPath()
      ctx.arc(point.x, point.y, compact ? 1.05 : pointRadius, 0, Math.PI * 2)
      ctx.fillStyle = cadColor(data.scan[point.index].deviationMm, limit)
      ctx.fill()
    }
    while (face < scene.faces.length) drawFace(scene.faces[face++])
    if (!compact && nominal && section.length) {
      ctx.strokeStyle = 'rgba(35,62,82,.48)'
      ctx.lineWidth = .9
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (const [start, end] of section) {
        const a = projection.point(start)
        const b = projection.point(end)
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (!compact && active && activePoint) {
      const closest = projection.point(active.closest)
      ctx.lineWidth = 1.15
      ctx.strokeStyle = '#172d3d'
      ctx.beginPath()
      ctx.moveTo(closest.x, closest.y)
      ctx.lineTo(activePoint.x, activePoint.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(activePoint.x, activePoint.y, 4.8, 0, Math.PI * 2)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.strokeStyle = '#172d3d'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
    if (!compact) {
      const origin: CadCoordinate = [bounds[0][0], bounds[1][0], bounds[2][0]]
      const from = projection.point(origin)
      ctx.font = '11px Arial, sans-serif'
      ctx.lineWidth = 1
      ctx.fillStyle = '#364c5b'
      ctx.strokeStyle = '#879aa6'
      for (const axis of cadIndices) {
        const tip: [number, number, number] = [...origin]
        tip[axis] += (bounds[axis][1] - bounds[axis][0]) * .18
        const to = projection.point(tip)
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.lineTo(to.x, to.y)
        ctx.stroke()
        ctx.fillText(['X', 'Y', 'Z'][axis], to.x + 3, to.y - 3)
      }
    }
  }, [scene, projection, section, active, activePoint, width, height, data, bounds, nominal, limit, compact])

  function press(event: PointerEvent<HTMLCanvasElement>) {
    gesture.current = { x: event.clientX, y: event.clientY, camera, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function drag(event: PointerEvent<HTMLCanvasElement>) {
    const down = gesture.current
    if (!down) return
    const dx = event.clientX - down.x
    const dy = event.clientY - down.y
    if (!down.moved && Math.hypot(dx, dy) < 3) return
    down.moved = true
    rotate({ yaw: down.camera.yaw + dx * .012, pitch: clampPitch(down.camera.pitch + dy * .012) })
  }

  function release(event: PointerEvent<HTMLCanvasElement>) {
    const down = gesture.current
    gesture.current = undefined
    if (!down || down.moved) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) * width / rect.width
    const y = (event.clientY - rect.top) * height / rect.height
    let closest = 64
    let match: number | undefined
    for (let i = scene.points.length - 1; i >= 0; i--) {
      const point = scene.points[i]
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2
      // Match a painted dot in front before considering the wider hit area.
      if (distance <= pointRadius ** 2) {
        pick(point.index)
        return
      }
      if (distance < closest) {
        closest = distance
        match = point.index
      }
    }
    if (match !== undefined) pick(match)
  }

  return (
    <div className="cad-viewport scientific-plot" ref={plot}>
      <canvas ref={canvas} data-cad-viewport="" data-yaw={camera.yaw} data-pitch={camera.pitch}
        data-visible-count={visible.length} data-selected={selected} data-nominal={nominal}
        data-selected-x={activePoint?.x} data-selected-y={activePoint?.y}
        role="img" aria-label="Registered 3D scan colored by signed deviation from nominal"
        tabIndex={compact ? undefined : 0} aria-keyshortcuts={compact ? undefined : 'ArrowUp ArrowDown'}
        onKeyDown={compact ? undefined : (event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          rotate({ yaw: camera.yaw, pitch: clampPitch(camera.pitch + (event.key === 'ArrowUp' ? .18 : -.18)) })
        }}
        onPointerDown={compact ? undefined : press} onPointerMove={compact ? undefined : drag}
        onPointerUp={compact ? undefined : release} onPointerCancel={() => { gesture.current = undefined }} />
      <DeviationScale limit={limit} />
    </div>
  )
}
