import type { ReactNode } from 'react'
import { usePlotSize } from '../../usePlotSize'
import type { ParetoData, ParetoPoint } from './model'
import type { preparePareto, calculatePareto } from './model'

type Prepared = NonNullable<ReturnType<typeof preparePareto>>
type Result = ReturnType<typeof calculatePareto>
type ScreenPoint = readonly [number, number]
type View = 'boundary' | 'section'

const axisOrder = [0, 1, 2] as const
const bits = [0, 1] as const
const tickFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
const cubeEdges = axisOrder.flatMap((axis) => bits.flatMap((first) => bits.map((second) => {
  const start: [number, number, number] = [0, 0, 0]
  start[(axis + 1) % 3] = first
  start[(axis + 2) % 3] = second
  const end: [number, number, number] = [...start]
  end[axis] = 1
  return [start, end] as const
})))

function axisTitle({ label, shortLabel, unit, direction }: ParetoData['objectives'][number], condensed: boolean) {
  return `${condensed ? shortLabel || label : label}${!condensed && unit ? ` (${unit})` : ''} ${direction === 'maximize' ? '↑' : '↓'}`
}

function niceInterval([start, end]: Prepared['bounds'][number], requested: number) {
  const span = Math.abs(end - start)
  const approximate = span / requested
  const power = 10 ** Math.floor(Math.log10(approximate))
  const interval = power * ([1, 2, 2.5, 5, 10].find((step) => step * power >= approximate) ?? 10)
  const first = Math.ceil(Math.min(start, end) / interval)
  const last = Math.floor(Math.max(start, end) / interval)
  return Array.from({ length: Math.max(0, Math.min(12, last - first + 1)) }, (_, index) => {
    const value = (first + index) * interval
    return { value, position: (value - start) / (end - start) }
  })
}

function boundaryProjector(width: number, height: number, compact: boolean) {
  const scale = Math.max(1, Math.min((width - (compact ? 46 : 78)) / 1.42, (height - (compact ? 49 : 85)) / 1.42))
  const originX = width / 2
  const originY = (height + scale * .38) / 2
  return ([x, y, z]: ParetoPoint): ScreenPoint => [
    originX + (x - y) * .707 * scale,
    originY + ((x + y - 1) * .325 - z * .72) * scale,
  ]
}

function drawLine(project: (point: ParetoPoint) => ScreenPoint, start: ParetoPoint, end: ParetoPoint, className: string) {
  const [x1, y1] = project(start)
  const [x2, y2] = project(end)
  return <line className={className} x1={x1} y1={y1} x2={x2} y2={y2} />
}

function BoundaryAxes({ project, data, prepared, compact, width }: {
  project: (point: ParetoPoint) => ScreenPoint
  data: ParetoData
  prepared: Prepared
  compact: boolean
  width: number
}) {
  const origins: readonly ParetoPoint[] = [[0, 1, 0], [1, 0, 0], [0, 1, 0]]
  return (
    <g className="scientific-axis" aria-hidden="true">
      {axisOrder.map((axis) => {
        const start = origins[axis]
        const finish: [number, number, number] = [...start]
        finish[axis] = 1
        const at = (value: number) => {
          const point: [number, number, number] = [...start]
          point[axis] = value
          return project(point)
        }
        const [centerX, centerY] = at(.5)
        const gap = compact ? 15 : 31
        const labelX = axis === 2 ? Math.max(11, centerX - (compact ? 13 : 35))
          : centerX + gap * (axis === 0 ? -.42 : .42)
        const labelY = axis === 2 ? centerY : centerY + gap * .9
        const rotation = axis === 2 ? -90 : axis === 0 ? 24.7 : -24.7
        return (
          <g key={axis}>
            {drawLine(project, start, finish, 'pareto-axis')}
            {!compact && niceInterval(prepared.bounds[axis], 4).map(({ value, position }) => {
              const [x, y] = at(position)
              return <g key={value}>
                <line className="pareto-axis" x1={x} y1={y} x2={x + (axis === 2 ? -5 : 0)} y2={y + (axis === 2 ? 0 : 5)} />
                <text x={x + (axis === 2 ? -8 : 0)} y={y + (axis === 2 ? 3.5 : 15)}
                  textAnchor={axis === 2 ? 'end' : 'middle'}>{tickFormat.format(value)}</text>
              </g>
            })}
            <text className="pareto-axis-title" data-pareto-objective={axis}
              x={labelX} y={labelY} textAnchor="middle"
              transform={`rotate(${rotation} ${labelX} ${labelY})`}>
              {axisTitle(data.objectives[axis], compact || width < 450)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function TrialMark({ index, id, point, frontier, selected, compact, onSelect }: {
  index: number
  id: string
  point: ScreenPoint
  frontier: boolean
  selected: boolean
  compact: boolean
  onSelect: (index: number) => void
}) {
  const [x, y] = point
  const radius = compact ? 2.65 : 3.5
  return (
    <g className="pareto-trial" data-pareto-trial={id} data-frontier={frontier} data-selected={selected}
      aria-hidden="true">
      {frontier
        ? <path className="pareto-frontier-point" d={`M${x} ${y - radius * 1.3}l${radius * 1.15} ${radius * 1.3}l${-radius * 1.15} ${radius * 1.3}l${-radius * 1.15} ${-radius * 1.3}Z`} />
        : <circle className="pareto-other-point" cx={x} cy={y} r={radius * .69} />}
      {selected && <circle className="pareto-selected-ring" cx={x} cy={y} r={8} />}
      {!compact && <circle className="pareto-hit" cx={x} cy={y} r={8} fill="transparent" onClick={() => onSelect(index)} />}
    </g>
  )
}

export function ParetoPlot({ data, prepared, result, indices, selected, threshold, view, compact, label, onSelect }: {
  data: ParetoData
  prepared: Prepared
  result: Result
  indices: readonly number[]
  selected: number
  threshold: number
  view: View
  compact: boolean
  label: string
  onSelect: (index: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 380 : 760, compact ? 190 : 460)
  let plotContent: ReactNode

  if (view === 'boundary') {
    const project = boundaryProjector(width, height, compact)
    const depth = ([x, y, z]: ParetoPoint) => x + y + z * (.65 / .72)
    const faces = result.faces.map(({ axis, vertices }, index) => ({
        depth: vertices.reduce((sum, point) => sum + depth(point), 0) / vertices.length,
        mark: <polygon key={`face-${index}`} data-pareto-face={axis} className="pareto-face" data-axis={axis}
          points={vertices.map((point) => project(point).join(',')).join(' ')} />,
    })).sort((a, b) => a.depth - b.depth)
    const orderedTrials = [...indices].sort((a, b) => depth(prepared.positions[a]) - depth(prepared.positions[b]))
    plotContent = (
      <>
        <g aria-hidden="true">
          {cubeEdges.map(([a, b], index) => <g key={index}>{drawLine(project, a, b, 'pareto-box')}</g>)}
        </g>
        {faces.map(({ mark }) => mark)}
        {orderedTrials.map((index) => <TrialMark key={index} index={index} id={data.trials[index].id}
          point={project(prepared.positions[index])} frontier={result.frontier.has(index)}
          selected={false} compact={compact} onSelect={onSelect} />)}
        <BoundaryAxes project={project} data={data} prepared={prepared} compact={compact} width={width} />
        {!compact && selected >= 0 && <circle className="pareto-selected-ring" aria-hidden="true" data-pareto-active
          cx={project(prepared.positions[selected])[0]} cy={project(prepared.positions[selected])[1]} r={8} />}
      </>
    )
  } else {
    const left = width < 400 ? 45 : 60
    const top = 18
    const right = Math.max(left + 5, width - 20)
    const bottom = Math.max(top + 5, height - 45)
    const x = (value: number) => left + value * (right - left)
    const y = (value: number) => bottom - value * (bottom - top)
    plotContent = (
      <>
        <g aria-hidden="true" className="scientific-axis">
          {result.cells.filter(({ z }) => z <= threshold).map(({ x0, x1, y0, y1 }, index) => (
            <rect key={index} data-pareto-section-cell className="pareto-section-cell"
              x={x(x0)} y={y(y1)} width={x(x1) - x(x0)} height={y(y0) - y(y1)} />
          ))}
          {niceInterval(prepared.bounds[0], width < 400 ? 4 : 6).map(({ value, position }) => (
            <g key={value}>
              <line className="pareto-section-grid" x1={x(position)} x2={x(position)} y1={top} y2={bottom} />
              <text x={x(position)} y={bottom + 16} textAnchor="middle">{tickFormat.format(value)}</text>
            </g>
          ))}
          {niceInterval(prepared.bounds[1], 5).map(({ value, position }) => (
            <g key={value}>
              <line className="pareto-section-grid" x1={left} x2={right} y1={y(position)} y2={y(position)} />
              <text x={left - 6} y={y(position) + 4} textAnchor="end">{tickFormat.format(value)}</text>
            </g>
          ))}
          <rect className="scientific-frame" data-pareto-section-frame x={left} y={top} width={right - left} height={bottom - top} />
          <text className="pareto-axis-title" x={(left + right) / 2} y={height - 6}
            textAnchor="middle">{axisTitle(data.objectives[0], false)}</text>
          <text className="pareto-axis-title" textAnchor="middle" transform={`translate(12 ${(top + bottom) / 2}) rotate(-90)`}>
            {axisTitle(data.objectives[1], false)}
          </text>
        </g>
        {indices.map((index) => <TrialMark key={index} index={index} id={data.trials[index].id}
          point={[x(prepared.positions[index][0]), y(prepared.positions[index][1])]} frontier={result.frontier.has(index)}
          selected={selected === index} compact={compact} onSelect={onSelect} />)}
      </>
    )
  }

  return (
    <div className="pareto-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-pareto-plot data-view={view}>
        {plotContent}
      </svg>
    </div>
  )
}
