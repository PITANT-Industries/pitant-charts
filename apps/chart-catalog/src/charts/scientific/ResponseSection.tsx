import { usePlotSize } from '../usePlotSize'
import { responseAxisLabel } from './response-surface-model'
import type { ResponseBounds, ResponseFactor, ResponseSurfaceData, ResponseTrial, ResponseVertex } from './response-surface-model'

const format = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })

function axisTicks(min: number, max: number, target: number) {
  const rough = (max - min) / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = magnitude * ([1, 2, 2.5, 5, 10].find((value) => value * magnitude >= rough) ?? 10)
  if (!Number.isFinite(step) || step <= 0) return [min, max]
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  return last > first
    ? Array.from({ length: last - first + 1 }, (_, index) => (first + index) * step)
    : [min, max]
}

interface ResponseSectionProps {
  data: ResponseSurfaceData
  bounds: ResponseBounds
  axis: ResponseFactor
  position: number
  interval: readonly [number, number]
  section: readonly ResponseVertex[]
  selected: ResponseVertex
  trial?: ResponseTrial
  choose: (varying: number) => void
  chooseTrial: (id: string) => void
}

export function ResponseSection({ data, bounds, axis, position, interval, section, selected, trial, choose, chooseTrial }: ResponseSectionProps) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(430, 268)
  const varying = axis === 'x' ? 'y' : 'x'
  const fixedAxis = axis === 'x' ? 0 : 1
  const varyingAxis = axis === 'x' ? 1 : 0
  const axisLabel = responseAxisLabel(varying === 'x' ? data.xAxis : data.yAxis)
  const fixedLabel = responseAxisLabel(axis === 'x' ? data.xAxis : data.yAxis)
  const responseLabel = responseAxisLabel(data.responseAxis)
  const [xmin, xmax] = bounds[varyingAxis]
  const [ymin, ymax] = bounds[2]
  const [start, end] = interval
  const left = 57
  const right = Math.max(left + 1, width - 20)
  const top = 15
  const bottom = Math.max(top + 1, height - 43)
  const plotWidth = right - left
  const plotHeight = bottom - top
  const x = (value: number) => left + (value - xmin) / (xmax - xmin) * plotWidth
  const y = (value: number) => bottom - (value - ymin) / (ymax - ymin) * plotHeight
  const sectionWidth = end - start
  const positionTolerance = (bounds[fixedAxis][1] - bounds[fixedAxis][0]) * 1e-8
  const measured = data.trials.filter((run) => Math.abs(run[axis] - position) <= positionTolerance)
    .map((run) => ({ run, fitted: data.evaluate(run.x, run.y) }))

  let connected = false
  const curve = section.map((vertex) => {
    if (!Number.isFinite(vertex[2])) {
      connected = false
      return ''
    }
    const point = `${x(vertex[varyingAxis])},${y(vertex[2])}`
    const command = connected ? 'L' : 'M'
    connected = true
    return `${command}${point}${sectionWidth === 0 ? `L${point}` : ''}`
  }).join('')

  function select(value: number) {
    if (Number.isFinite(value)) choose(Math.min(end, Math.max(start, value)))
  }

  return (
    <div className="response-section scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-response-section="" data-axis={axis} data-position={position}
        role="group" aria-label={`${responseLabel} by ${axisLabel} at ${fixedLabel} ${format.format(position)}`}>
        <rect className="scientific-frame" data-response-frame="" x={left} y={top} width={plotWidth} height={plotHeight} />
        <g className="scientific-axis" aria-hidden="true">
          {axisTicks(xmin, xmax, Math.max(2, Math.floor(plotWidth / 53))).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 5} />
              <text x={x(value)} y={bottom + 18} textAnchor="middle">{format.format(value)}</text>
            </g>
          ))}
          {axisTicks(ymin, ymax, Math.max(2, Math.floor(plotHeight / 33))).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 5} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={left + plotWidth / 2} y={bottom + 35} textAnchor="middle">{axisLabel}</text>
          <text className="scientific-axis-label" textAnchor="middle"
            transform={`translate(${left - 43} ${top + plotHeight / 2}) rotate(-90)`}>{responseLabel}</text>
        </g>
        <path className="response-section-curve" data-response-section-path="" d={curve} fill="none" strokeLinecap="round" />
        {Number.isFinite(selected[2]) && <circle className="response-section-picked" data-response-section-marker=""
          data-x={selected[0]} data-y={selected[1]} data-fitted={selected[2]}
          cx={x(selected[varyingAxis])} cy={y(selected[2])} r={4.6} />}
        <rect data-response-section-pick="" data-min={start} data-max={end} x={x(start)} y={top}
          width={x(end) - x(start)} height={plotHeight} fill="transparent" role="group"
          tabIndex={sectionWidth > 0 ? 0 : undefined} aria-label={`Probe ${axisLabel} with the Left and Right arrow keys`}
          aria-keyshortcuts="ArrowLeft ArrowRight Home End"
          onClick={(event) => {
            const transform = event.currentTarget.ownerSVGElement?.getScreenCTM()
            if (!transform) return
            const hit = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
            select(xmin + (hit.x - left) / plotWidth * (xmax - xmin))
          }}
          onKeyDown={(event) => {
            const value = selected[varyingAxis]
            const step = sectionWidth / 100
            switch (event.key) {
              case 'ArrowLeft': select(value - step); break
              case 'ArrowRight': select(value + step); break
              case 'Home': select(start); break
              case 'End': select(end); break
              default: return
            }
            event.preventDefault()
          }} />
        <g aria-hidden="true">
          {measured.map(({ run, fitted }) => (
            <line className="response-section-residual" data-response-residual="" data-id={run.id} key={run.id}
              x1={x(run[varying])} x2={x(run[varying])} y1={y(fitted)} y2={y(run.response)} />
          ))}
          {measured.map(({ run, fitted }) => (
            <circle className="response-section-trial" data-response-trial="" data-id={run.id}
              data-selected={trial?.id === run.id} data-measured={run.response} data-residual={run.response - fitted}
              key={run.id} cx={x(run[varying])} cy={y(run.response)} r={trial?.id === run.id ? 4.3 : 3.5}
              onClick={() => chooseTrial(run.id)} />
          ))}
        </g>
      </svg>
    </div>
  )
}
