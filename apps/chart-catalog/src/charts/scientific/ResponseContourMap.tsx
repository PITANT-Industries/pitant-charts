import { useId, useMemo, useRef } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import { buildResponseContours } from './response-contour-geometry'
import { responseAxisLabel, responseColor, responseContains, responsePosition, responseTicks } from './response-surface-model'
import type { ResponseBounds, ResponseFactor, ResponsePosition, ResponseSurfaceData, ResponseTriangle, ResponseTrial, ResponseVertex } from './response-surface-model'

const format = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5, useGrouping: false })
const legendFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4, useGrouping: false })

interface ResponseContourMapProps {
  data: ResponseSurfaceData
  bounds: ResponseBounds
  mesh: readonly ResponseTriangle[]
  hull: readonly ResponsePosition[]
  range: readonly [number, number]
  axis: ResponseFactor
  interval: readonly [number, number]
  selected: ResponseVertex
  trial?: ResponseTrial
  choose: (position: ResponsePosition) => void
  chooseTrial: (id: string) => void
}

export function ResponseContourMap({ data, bounds, mesh, hull, range, axis, interval, selected, trial, choose, chooseTrial }: ResponseContourMapProps) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(378, 330)
  const clip = useId()
  const captured = useRef<number | null>(null)
  const [[xmin, xmax], [ymin, ymax]] = bounds
  const left = 52
  const right = Math.max(left + 1, width - 19)
  const top = 13
  const bottom = Math.max(top + 1, height - 92)
  const plotWidth = right - left
  const plotHeight = bottom - top
  const map = useMemo(() => {
    const x = (value: number) => left + (value - xmin) / (xmax - xmin) * plotWidth
    const y = (value: number) => bottom - (value - ymin) / (ymax - ymin) * plotHeight
    const xy = ([a, b]: ResponsePosition) => `${x(a).toFixed(3)},${y(b).toFixed(3)}`
    const polygon = (points: readonly ResponsePosition[]) => `M${points.map(xy).join('L')}Z`
    return { x, y, xy, polygon }
  }, [xmin, xmax, ymin, ymax, plotWidth, plotHeight, bottom])
  const geometry = useMemo(() => buildResponseContours(mesh, range), [mesh, range])
  const paths = useMemo(() => ({
    bands: geometry.bands.map(({ min, max, polygons }) => ({
      min, max, color: responseColor(min + (max - min) / 2, range), d: polygons.map(map.polygon).join(' '),
    })),
    contours: geometry.contours.map(({ level, segments }) => ({
      level, d: segments.map(([first, last]) => `M${map.xy(first)}L${map.xy(last)}`).join(' '),
    })),
    hull: map.polygon(hull),
  }), [geometry, hull, map, range])
  const trials = new Map<string, ResponseTrial>()
  for (const run of data.trials) {
    const key = `${run.x},${run.y}`
    if (!trials.has(key) || run.id === trial?.id) trials.set(key, run)
  }
  const position = selected[axis === 'x' ? 0 : 1]
  const [a, b] = interval.map((value) => responsePosition(axis, position, value))
  const legendY = bottom + 57
  const legendX = (value: number) => left + (range[0] === range[1] ? 0 : (value - range[0]) / (range[1] - range[0])) * plotWidth
  const legendTicks = [range[0]]
  for (const { level } of paths.contours) {
    const spacing = legendTicks.length === 1 ? 46 : 32
    if (legendX(level) - legendX(legendTicks[legendTicks.length - 1]) >= spacing && right - legendX(level) >= 46) legendTicks.push(level)
  }
  if (range[0] !== range[1]) legendTicks.push(range[1])

  function pick(event: PointerEvent<SVGRectElement>) {
    const transform = event.currentTarget.ownerSVGElement?.getScreenCTM()
    if (!transform) return
    const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
    const point: ResponsePosition = [xmin + (cursor.x - left) / plotWidth * (xmax - xmin), ymin + (bottom - cursor.y) / plotHeight * (ymax - ymin)]
    if (responseContains(hull, point)) choose(point)
  }

  function clearPointer(event: PointerEvent<SVGRectElement>) {
    if (captured.current === event.pointerId) captured.current = null
  }

  return (
    <div className="response-map scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-response-map="" data-axis={axis} data-position={position}
        role="group" aria-label={`Fitted ${responseAxisLabel(data.responseAxis)} contour map`}>
        <defs><clipPath id={clip}><path d={paths.hull} /></clipPath></defs>
        <rect className="scientific-frame" data-response-map-frame="" x={left} y={top} width={plotWidth} height={plotHeight} />
        <g clipPath={`url(#${clip})`} aria-hidden="true">
          {paths.bands.map(({ min, max, color, d }) => <path key={min} data-response-map-band="" data-low={min} data-high={max}
            d={d} fill={color} stroke={color} strokeWidth=".45" />)}
          {paths.contours.map(({ level, d }) => <path key={level} data-response-map-contour="" data-level={level} d={d} />)}
        </g>
        <path data-response-map-domain="" d={paths.hull} />
        <g className="scientific-axis" aria-hidden="true">
          {responseTicks(xmin, xmax, Math.max(2, Math.floor(plotWidth / 55))).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={map.x(value)} x2={map.x(value)} y1={bottom} y2={bottom + 4} />
              <text x={map.x(value)} y={bottom + 16} textAnchor="middle">{format.format(value)}</text>
            </g>
          ))}
          {responseTicks(ymin, ymax, Math.max(2, Math.floor(plotHeight / 37))).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={map.y(value)} y2={map.y(value)} />
              <text x={left - 7} y={map.y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={left + plotWidth / 2} y={bottom + 33}
            textAnchor="middle">{responseAxisLabel(data.xAxis)}</text>
          <text className="scientific-axis-label" textAnchor="middle"
            transform={`translate(${left - 39} ${top + plotHeight / 2}) rotate(-90)`}>{responseAxisLabel(data.yAxis)}</text>
          <text x={left} y={legendY - 5}>{responseAxisLabel(data.responseAxis)}</text>
          {paths.bands.map(({ min, max, color }) => <rect key={min} x={legendX(min)} y={legendY}
            width={max === min ? plotWidth : legendX(max) - legendX(min)} height="7" fill={color} />)}
          <rect className="scientific-frame" x={left} y={legendY} width={plotWidth} height="7" />
          {paths.contours.map(({ level }) => <line key={level} className="scientific-tick"
            x1={legendX(level)} x2={legendX(level)} y1={legendY + 7} y2={legendY + 10} />)}
          {legendTicks.map((value, index) => <text key={value} x={legendX(value)} y={legendY + 20}
            textAnchor={index === 0 ? 'start' : index === legendTicks.length - 1 ? 'end' : 'middle'}>{legendFormat.format(value)}</text>)}
        </g>
        <line data-response-map-section="" x1={map.x(a[0])} y1={map.y(a[1])} x2={map.x(b[0])} y2={map.y(b[1])} />
        <circle data-response-map-probe="" data-x={selected[0]} data-y={selected[1]} data-fitted={selected[2]}
          cx={map.x(selected[0])} cy={map.y(selected[1])} r="5" />
        <rect data-response-map-pick="" data-x-min={xmin} data-x-max={xmax} data-y-min={ymin} data-y-max={ymax}
          x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" tabIndex={0} role="group"
          aria-label="Probe the factor plane with the arrow keys" aria-keyshortcuts="ArrowLeft ArrowRight ArrowDown ArrowUp"
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return
            captured.current = event.pointerId
            event.currentTarget.setPointerCapture(event.pointerId)
            pick(event)
          }}
          onPointerMove={(event) => { if (captured.current === event.pointerId) pick(event) }}
          onPointerUp={clearPointer}
          onPointerCancel={clearPointer}
          onLostPointerCapture={clearPointer}
          onKeyDown={(event) => {
            const [x, y] = selected
            const stepX = (xmax - xmin) / 100
            const stepY = (ymax - ymin) / 100
            switch (event.key) {
              case 'ArrowLeft': choose([x - stepX, y]); break
              case 'ArrowRight': choose([x + stepX, y]); break
              case 'ArrowDown': choose([x, y - stepY]); break
              case 'ArrowUp': choose([x, y + stepY]); break
              default: return
            }
            event.preventDefault()
          }} />
        <g aria-hidden="true">
          {[...trials.entries()].map(([key, run]) => (
            <circle key={key} data-response-map-trial="" data-id={run.id} data-selected={run.id === trial?.id}
              cx={map.x(run.x)} cy={map.y(run.y)} r="3" onClick={() => chooseTrial(run.id)} />
          ))}
        </g>
      </svg>
    </div>
  )
}
