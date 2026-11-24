import { usePlotSize } from '../../usePlotSize'
import type { PreparedGaugeRR } from './model'

export interface GaugeCellSelection {
  part: string
  operator: string
}

export type GaugeScale = 'part-centered' | 'measured'
type Domain = readonly [number, number]

const axisNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8, maximumFractionDigits: 10, useGrouping: false })

function scaleDomain(study: PreparedGaugeRR, scale: GaugeScale): Domain {
  if (scale === 'part-centered') {
    const magnitude = Math.max(...study.residualDomain.map(Math.abs))
    const extent = magnitude ? magnitude * 1.12 : Math.max(1e-6, Math.abs(study.grandMean) * .01)
    return [-extent, extent]
  }
  const [min, max] = study.absoluteDomain
  const padded = (max - min) * .11 || Math.max(1e-6, Math.abs(max) * .01)
  return [min - padded, max + padded]
}

function scaleTicks([min, max]: Domain, centered: boolean): number[] {
  const approximate = (max - min) / 3
  const power = 10 ** Math.floor(Math.log10(approximate))
  const step = power * ([1, 2, 2.5, 5, 10].find((value) => power * value >= approximate) ?? 10)
  if (centered) {
    const extent = step <= max ? step : step / 2
    return [-extent, 0, extent]
  }
  const start = Math.ceil(min / step)
  const count = Math.max(0, Math.min(5, Math.floor(max / step) - start + 1))
  return Array.from({ length: count }, (_, index) => Number(((start + index) * step).toPrecision(13)))
}

export function GaugeMatrix({ study, active, scale, compact, onSelect }: {
  study: PreparedGaugeRR
  active: GaugeCellSelection
  scale: GaugeScale
  compact: boolean
  onSelect: (cell: GaugeCellSelection) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(710, compact ? 190 : 410)
  const [min, max] = scaleDomain(study, scale)
  const left = compact ? 3 : 32
  const right = Math.max(left + 1, width - 3)
  const top = compact ? 3 : 49
  const bottom = Math.max(top + 1, height - (compact ? 3 : 5))
  const colWidth = (right - left) / study.operators.length
  const rowHeight = (bottom - top) / study.parts.length
  const pad = compact ? Math.min(5, colWidth * .1) : 9
  const xAt = (column: number, value: number) => left + column * colWidth + pad + ((value - min) / (max - min)) * (colWidth - 2 * pad)
  const centered = scale === 'part-centered'
  const power = centered && max < .01 ? Math.floor(Math.log10(max)) : 0
  const divisor = 10 ** power
  const ticks = compact ? [] : !centered && colWidth < 117 ? [study.grandMean] : scaleTicks([min, max], centered)
  const rowBox = 27 + Math.min(32, Math.max(0, (study.trials.length - 2) * 4))
  const spread = Math.min(compact ? 3 : 6, rowHeight * .55 / (study.trials.length - 1))
  const pointRadius = Math.min(compact ? 1.4 : 2.65, rowHeight / (study.trials.length * 1.65))
  const meanHalf = Math.min(rowHeight * .34, compact ? 4 : 8)
  const reference = centered ? 0 : study.grandMean

  return <><div className={`gauge-matrix-scroll${compact ? ' gauge-matrix-compact' : ''}`}>
    <div ref={plot} className="scientific-plot gauge-matrix-plot"
      style={compact ? undefined : { minInlineSize: 32 + study.operators.length * 65, blockSize: 54 + study.parts.length * rowBox }}>
      <svg viewBox={`0 0 ${width} ${height}`} data-gauge-matrix data-scale={scale} data-min={min} data-max={max}
        data-reference={reference} data-axis-power={power} role="img"
        aria-label={centered ? 'Operator by part matrix of readings centered on the observed part mean' : 'Operator by part matrix on a shared measured-value scale'}>
        {!compact && <g className="scientific-axis gauge-column-head" aria-hidden="true">
          <text x={2} y={16}>Part</text>
          {study.operators.map(({ id }, column) => <g key={id} data-gauge-operator={id}>
            <text x={left + (column + .5) * colWidth} y={16} textAnchor="middle">Operator {id}</text>
            {ticks.map((value) => <text key={value} data-gauge-tick={value} x={xAt(column, value)} y={37}
              textAnchor="middle">{axisNumber.format(value / divisor)}</text>)}
          </g>)}
          {study.parts.map(({ id }, row) => <text key={id} data-gauge-part={id} x={2}
            y={top + (row + .5) * rowHeight} dominantBaseline="middle">{id}</text>)}
        </g>}
        {study.cells.flatMap((rowCells, column) => rowCells.map((cell, row) => {
          const selected = cell.part === active.part && cell.operator === active.operator
          const originX = left + column * colWidth
          const originY = top + row * rowHeight
          const middle = originY + rowHeight / 2
          const plotted = centered ? cell.residuals : cell.readings.map(({ value }) => value)
          const cellMean = centered ? plotted.reduce((a, b) => a + b, 0) / plotted.length : cell.mean
          return <g key={JSON.stringify([cell.part, cell.operator])} className="gauge-cell" data-gauge-cell
            data-part={cell.part} data-operator={cell.operator} data-active={selected}
            data-x-min={xAt(column, min)} data-x-max={xAt(column, max)}
            onClick={compact ? undefined : () => onSelect(cell)}>
            <rect className="gauge-cell-background" x={originX} y={originY} width={colWidth} height={rowHeight} />
            <line className="gauge-reference" x1={xAt(column, reference)} x2={xAt(column, reference)}
              y1={originY} y2={originY + rowHeight} />
            <line className="gauge-range" x1={xAt(column, Math.min(...plotted))} x2={xAt(column, Math.max(...plotted))}
              y1={middle} y2={middle} />
            <line data-gauge-cell-mean={cell.mean} className="gauge-mean" x1={xAt(column, cellMean)} x2={xAt(column, cellMean)}
              y1={middle - meanHalf} y2={middle + meanHalf} />
            {cell.readings.map(({ trial, value }, index) => <circle key={trial} data-gauge-reading={trial}
              data-recorded={value} data-plotted={plotted[index]}
              cx={xAt(column, plotted[index])} cy={middle + (index - (study.trials.length - 1) / 2) * spread} r={pointRadius}
              className="gauge-reading" />)}
          </g>
        }))}
      </svg>
    </div>
  </div>
    {!compact && <p className="gauge-axis-caption">
      {centered ? 'Deviation from each part’s observed mean' : 'Shared measured scale'}
      {' '}<span>{'('}{power !== 0 && <>×10<sup>{power}</sup> </>}{study.unit}{')'}</span>
    </p>}
  </>
}
