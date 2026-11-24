import { useId, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import type { PcaBiplotData, PcaPoint } from './model'

const colors = ['#1e587a', '#48735c', '#70537c', '#85520a', '#557681', '#993e34']
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

type Point = { x: number; y: number }
type Drag = { start: Point; end: Point }
type View = {
  left: number; top: number; right: number; bottom: number
  x: (value: number) => number; y: (value: number) => number
  xExtent: number; yExtent: number; magnification: number
}

export function ObservationMark({ group, x, y, size }: { group: number; x: number; y: number; size: number }) {
  const color = colors[group % colors.length]
  const shape = group % 4
  if (shape === 0) return <circle cx={x} cy={y} r={size} fill={color} />
  if (shape === 1) return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} fill={color} />
  if (shape === 2) return <path d={`M${x} ${y - size * 1.25}l${size} ${size * 2}h${-size * 2}Z`} fill={color} />
  return <path d={`M${x} ${y - size * 1.3}l${size} ${size * 1.3}l${-size} ${size * 1.3}l${-size} ${-size * 1.3}Z`} fill={color} />
}

function symmetricTicks(extent: number, count: number) {
  const desired = extent * 2 / count
  const power = 10 ** Math.floor(Math.log10(desired))
  const fraction = desired / power
  const step = power * ([1, 2, 2.5, 5, 10].find((size) => size >= fraction) ?? 10)
  const steps = Math.min(6, Math.floor(extent / step + 1e-9))
  return Array.from({ length: steps * 2 + 1 }, (_, index) => (index - steps) * step)
}

function makeView(width: number, height: number, compact: boolean, points: readonly PcaPoint[], vectors: readonly PcaPoint[]): View {
  const left = compact ? 31 : 46
  const right = Math.max(left + 20, width - (compact ? 17 : 48))
  const top = compact ? 16 : 39
  const bottom = Math.max(top + 20, height - (compact ? 33 : 46))
  const pixelsX = (right - left) / 2
  const pixelsY = (bottom - top) / 2
  const fit = ([a, b]: PcaPoint) => Math.max(Math.abs(a) / pixelsX, Math.abs(b) / pixelsY)
  const pointExtent = points.reduce((extent, value) => Math.max(extent, fit(value)), 0)
  const vectorExtent = vectors.reduce((extent, value) => Math.max(extent, fit(value)), 0)
  const target = .76 * pointExtent / vectorExtent
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const magnification = magnitude * ([5, 2.5, 2, 1].find((factor) => magnitude * factor <= target) ?? 1)
  const unitsPerPixel = pointExtent * 1.13
  const centerX = left + pixelsX
  const centerY = top + pixelsY
  return {
    left, right, top, bottom, xExtent: pixelsX * unitsPerPixel, yExtent: pixelsY * unitsPerPixel, magnification,
    x: (value) => centerX + value / unitsPerPixel, y: (value) => centerY - value / unitsPerPixel,
  }
}

function BiplotAxes({ view, height, variance, compact }: { view: View; height: number; variance: PcaPoint; compact: boolean }) {
  const { left, right, top, bottom, x, y, xExtent, yExtent, magnification } = view
  const horizontal = right - left
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const bottomTicks = symmetricTicks(xExtent, horizontal < 310 ? 4 : 8)
  const leftTicks = symmetricTicks(yExtent, compact ? 4 : 6)
  const topTicks = symmetricTicks(xExtent / magnification, horizontal < 310 ? 4 : 8)
  const rightTicks = symmetricTicks(yExtent / magnification, 6)

  return (
    <g className="scientific-axis" aria-hidden="true">
      {bottomTicks.map((tick) => <g key={tick}>
        <line className="pca-grid" x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} />
        <line className="scientific-tick" x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 4} />
        <text x={x(tick)} y={bottom + 17} textAnchor="middle">{decimal.format(tick)}</text>
      </g>)}
      {leftTicks.map((tick) => <g key={tick}>
        <line className="pca-grid" x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
        <line className="scientific-tick" x1={left - 4} x2={left} y1={y(tick)} y2={y(tick)} />
        <text x={left - 7} y={y(tick) + 3.5} textAnchor="end">{decimal.format(tick)}</text>
      </g>)}
      <line className="pca-zero" x1={centerX} x2={centerX} y1={top} y2={bottom} />
      <line className="pca-zero" x1={left} x2={right} y1={centerY} y2={centerY} />
      <rect className="scientific-frame" data-pca-frame x={left} y={top} width={horizontal} height={bottom - top} />
      <text className="scientific-axis-label" x={centerX} y={height - 5} textAnchor="middle">PC1 scores ({(variance[0] * 100).toFixed(1)}%)</text>
      <text className="scientific-axis-label" textAnchor="middle" transform={`translate(11 ${centerY}) rotate(-90)`}>
        PC2 scores ({(variance[1] * 100).toFixed(1)}%)
      </text>
      {!compact && <g className="pca-loading-axes" data-pca-loading-axes>
        {topTicks.map((tick) => <g key={tick}>
          <line x1={x(tick * magnification)} x2={x(tick * magnification)} y1={top - 4} y2={top} />
          <text x={x(tick * magnification)} y={top - 8} textAnchor="middle">{decimal.format(tick)}</text>
        </g>)}
        {rightTicks.map((tick) => <g key={tick}>
          <line x1={right} x2={right + 4} y1={y(tick * magnification)} y2={y(tick * magnification)} />
          <text x={right + 6} y={y(tick * magnification) + 3.5}>{decimal.format(tick)}</text>
        </g>)}
        <text x={centerX} y={13} textAnchor="middle">PC1 loadings</text>
        <text textAnchor="middle" transform={`translate(${right + 39} ${centerY}) rotate(90)`}>PC2 loadings</text>
      </g>}
    </g>
  )
}

function placeLabels(vectors: readonly PcaPoint[], ids: readonly string[], view: View) {
  return vectors.flatMap(([a, b], index) => {
    if (a === 0 && b === 0) return []
    const tipX = view.x(a * view.magnification)
    const tipY = view.y(b * view.magnification)
    const placeRight = a >= 0
    const reserve = Math.min(80, 5.5 * ids[index].length + 7)
    const anchor: 'start' | 'end' = placeRight ? 'start' : 'end'
    const x = placeRight ? Math.min(view.right - reserve, tipX + 6) : Math.max(view.left + reserve, tipX - 6)
    return [{ index, anchor, x, y: tipY, tipX, tipY }]
  }).sort((a, b) => a.tipY - b.tipY).map((label, index, all) => {
    const earlier = all.slice(0, index).reverse().find((other) =>
      other.anchor === label.anchor && Math.abs(other.x - label.x) < 36)
    label.y = earlier ? Math.max(label.tipY, earlier.y + 13) : label.tipY
    return label
  })
}

export function BiplotPlot({ data, points, vectors, variance, groups, active, variable, brushing, compact, label, onPick, onBrush }: {
  data: PcaBiplotData
  points: readonly PcaPoint[]
  vectors: readonly PcaPoint[]
  variance: PcaPoint
  groups: readonly number[]
  active: number
  variable: number
  brushing?: ReadonlySet<string>
  compact: boolean
  label: string
  onPick: (index: number) => void
  onBrush: (indices: number[]) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 390 : 760, compact ? 185 : 420)
  const [drag, setDrag] = useState<Drag>()
  const start = useRef<{ point: Point; pointerId: number } | undefined>(undefined)
  const marker = useId()
  const clip = useId()
  const view = makeView(width, height, compact, points, vectors)
  const { left, top, right, bottom, x, y, magnification } = view
  const screenPoints = points.map(([a, b]) => ({ x: x(a), y: y(b) }))
  const origin = { x: x(0), y: y(0) }
  const observation = screenPoints[active]
  const vector = vectors[variable]
  const normSquared = vector[0] ** 2 + vector[1] ** 2
  const factor = normSquared > 0 ? (points[active][0] * vector[0] + points[active][1] * vector[1]) / normSquared : 0
  const foot = { x: x(factor * vector[0]), y: y(factor * vector[1]) }
  const shortLabels = data.variables.map(({ id, shortLabel }) => shortLabel || id)
  const labels = compact ? [] : placeLabels(vectors, shortLabels, view)

  function pointerPoint(event: PointerEvent<SVGRectElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = (value: number, min: number, span: number) => Math.max(0, Math.min(1, (value - min) / span))
    return {
      x: left + fraction(event.clientX, bounds.left, bounds.width) * (right - left),
      y: top + fraction(event.clientY, bounds.top, bounds.height) * (bottom - top),
    }
  }

  function begin(event: PointerEvent<SVGRectElement>) {
    if (!event.isPrimary || event.button !== 0) return
    const point = pointerPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { point, pointerId: event.pointerId }
    setDrag({ start: point, end: point })
  }

  function move(event: PointerEvent<SVGRectElement>) {
    if (start.current?.pointerId === event.pointerId) {
      setDrag({ start: start.current.point, end: pointerPoint(event) })
    }
  }

  function clear() {
    start.current = undefined
    setDrag(undefined)
  }

  function end(event: PointerEvent<SVGRectElement>) {
    const gesture = start.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const first = gesture.point
    const last = pointerPoint(event)
    clear()
    if (Math.hypot(last.x - first.x, last.y - first.y) >= 6) {
      const lowX = Math.min(first.x, last.x)
      const highX = Math.max(first.x, last.x)
      const lowY = Math.min(first.y, last.y)
      const highY = Math.max(first.y, last.y)
      const selected = screenPoints.flatMap((point, index) =>
        point.x >= lowX && point.x <= highX && point.y >= lowY && point.y <= highY ? [index] : [])
      onBrush(selected)
      return
    }
    let nearest = -1
    let distance = event.pointerType === 'touch' ? 22 : 14
    screenPoints.forEach((point, index) => {
      const gap = Math.hypot(last.x - point.x, last.y - point.y)
      if (gap < distance) {
        distance = gap
        nearest = index
      }
    })
    if (nearest >= 0) onPick(nearest)
  }

  return (
    <div className="pca-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-pca-plot>
        <defs>
          <clipPath id={clip}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
          <marker id={marker} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0 0 8 4 0 8 2 4Z" fill="#963c2e" />
          </marker>
        </defs>
        <BiplotAxes view={view} height={height} variance={variance} compact={compact} />
        <g clipPath={`url(#${clip})`} aria-hidden="true">
          {screenPoints.map((point, index) => {
            const id = data.observations[index].id
            return <g key={id} className="pca-row" data-pca-row={id} data-brushed={brushing?.has(id)}
              data-score-x={points[index][0]} data-score-y={points[index][1]}>
              <ObservationMark group={groups[index]} {...point} size={compact ? 2 : 2.7} />
            </g>
          })}
          {vectors.map(([a, b], index) => (a !== 0 || b !== 0) && (
            <line key={data.variables[index].id} className="pca-vector" data-pca-vector={data.variables[index].id}
              data-active={!compact && variable === index} data-loading-x={a} data-loading-y={b}
              x1={origin.x} y1={origin.y} x2={x(a * magnification)} y2={y(b * magnification)} markerEnd={`url(#${marker})`} />
          ))}
          {!compact && <>
            {normSquared > 0 && (
              <g data-pca-projection>
                <line className="pca-projection-ray" x1={origin.x} y1={origin.y} x2={foot.x} y2={foot.y} />
                <line className="pca-projection-drop" x1={observation.x} y1={observation.y} x2={foot.x} y2={foot.y} />
                <circle className="pca-projection-foot" cx={foot.x} cy={foot.y} r={3.5} />
              </g>
            )}
            <circle className="pca-active-row" cx={observation.x} cy={observation.y} r={5} />
          </>}
          {drag && <rect className="pca-brush" x={Math.min(drag.start.x, drag.end.x)} y={Math.min(drag.start.y, drag.end.y)}
            width={Math.abs(drag.end.x - drag.start.x)} height={Math.abs(drag.end.y - drag.start.y)} />}
        </g>
        {labels.map(({ index, anchor, x, y, tipX, tipY }) => <g key={data.variables[index].id} className="pca-vector-label"
          data-active={variable === index} aria-hidden="true">
          {Math.abs(tipY - y) > 2 && <line x1={tipX} y1={tipY} x2={x} y2={y} />}
          <text x={x} y={y + 3.5} textAnchor={anchor}>{shortLabels[index]}</text>
        </g>)}
        {!compact && <rect className="pca-hit" data-pca-brush-target fill="transparent"
          x={left} y={top} width={right - left} height={bottom - top}
          onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={clear} onLostPointerCapture={clear} />}
      </svg>
    </div>
  )
}
