import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { flowPointIndex } from './model'
import type { PreparedCumulativeFlow } from './model'

const axisValue = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function stepBand(lower: readonly number[], upper: readonly number[], x: (index: number) => number, y: (count: number) => number) {
  let path = `M${x(0)},${y(upper[0])}`
  for (let index = 1; index < upper.length; index++) {
    path += `H${x(index)}V${y(upper[index])}`
  }
  const last = upper.length - 1
  path += `V${y(lower[last])}`
  for (let index = last - 1; index >= 0; index--) {
    path += `V${y(lower[index])}H${x(index)}`
  }
  return path + 'Z'
}

export function CumulativeFlowPlot({ flow, index, stage, compact, seek }: {
  flow: PreparedCumulativeFlow
  index: number
  stage: string
  compact: boolean
  seek?: (index: number, stage?: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(620)
  useEffect(() => {
    const container = host.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(120, entry.contentRect.width))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const bands = useMemo(() => {
    const completed = flow.points.map(({ completed }) => completed)
    const result = [{
      id: '', layer: -1, lower: flow.points.map(() => 0), upper: completed,
    }]
    for (let layer = flow.stages.length - 1; layer >= 0; layer--) {
      const lower = result[result.length - 1].upper
      result.push({
        id: flow.stages[layer].id, layer, lower,
        upper: lower.map((count, cursor) => count + flow.points[cursor].wip[layer]),
      })
    }
    return result
  }, [flow])

  const left = compact ? 6 : 38
  const right = width - (compact ? 6 : 12)
  const height = compact ? 205 : 310
  const top = compact ? 8 : 21
  const bottom = height - (compact ? 6 : 43)
  const capacity = Math.max(1, flow.points[flow.points.length - 1].admitted)
  const seconds = flow.end - flow.start
  const unit = seconds >= 7200 ? { divisor: 3600, label: 'h' } : seconds >= 180 ? { divisor: 60, label: 'min' } : { divisor: 1, label: 's' }
  const x = (cursor: number) => left + (flow.points[cursor].time - flow.start) / seconds * (right - left)
  const y = (count: number) => bottom - count / capacity * (bottom - top)
  const step = Math.max(1, Math.ceil(capacity / 5))
  const ticks = [0, step, 2 * step, 3 * step, 4 * step, 5 * step].filter((count) => count <= capacity)
  const position = x(index)
  const admitted = flow.points[index].admitted

  function pointerSeek(event: PointerEvent<SVGSVGElement>) {
    const transform = event.currentTarget.getScreenCTM()
    if (!seek || !transform || event.button !== 0) return
    const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
    if (pointer.x < left || pointer.x > right || pointer.y < top || pointer.y > bottom) return
    const time = flow.start + (pointer.x - left) / (right - left) * seconds
    const nearest = flowPointIndex(flow.points, time)
    const target = flow.points[nearest].time > time ? Math.max(0, nearest - 1) : nearest
    const count = (bottom - pointer.y) / (bottom - top) * capacity
    const selected = bands.find((band) => band.lower[target] <= count && count < band.upper[target])
    seek(target, selected?.id || undefined)
  }

  return <div className="flow-plot" ref={host}>
    <svg data-flow-plot viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      role="img" aria-label="Cumulative job counts with the active stages stacked above completed jobs"
      data-left={left} data-right={right} data-top={top} data-bottom={bottom} data-capacity={capacity}
      onPointerDown={compact ? undefined : pointerSeek}>
      {!compact && <>
        {ticks.map((count) => <g key={count} className="flow-grid">
          <line x1={left} x2={right} y1={y(count)} y2={y(count)} />
          <text x={left - 6} y={y(count) + 3} textAnchor="end">{count}</text>
        </g>)}
        {(width < 450 ? [0, .5, 1] : [0, .25, .5, .75, 1]).map((fraction) =>
          <text key={fraction} x={left + (right - left) * fraction} y={bottom + 17}
            textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>
            {axisValue.format(seconds * fraction / unit.divisor)}
          </text>)}
        <text x={left} y="12">Jobs</text>
        <text x={(left + right) / 2} y={bottom + 34} textAnchor="middle">Elapsed time ({unit.label})</text>
      </>}
      <path className="flow-axis" d={`M${left},${top}V${bottom}H${right}`} />
      {bands.map(({ id, layer, lower, upper }) => <path key={layer} data-flow-band={layer < 0 ? 'completed' : 'stage'}
        data-flow-stage={id} data-color={layer < 0 ? 0 : layer % 6 + 1} data-highlighted={id === stage}
        data-lower={lower[index]} data-upper={upper[index]}
        d={stepBand(lower, upper, x, y)} />)}
      <line className="flow-cursor" data-flow-cursor data-time={flow.points[index].time} x1={position} x2={position} y1={top} y2={bottom} />
      <circle className="flow-aggregate-marker" cx={position} cy={y(admitted)} r={compact ? 2.4 : 3.2} />
    </svg>
  </div>
}
