import { useEffect, useId, useRef, useState } from 'react'
import type { PreparedTaktBalance, summarizeTaktBalance } from './model'

const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

export function TaktBalancePlot({ study, summary, baseLoad, taskId, compact, select }: {
  study: PreparedTaktBalance
  summary: ReturnType<typeof summarizeTaktBalance>
  baseLoad: number
  taskId: string
  compact: boolean
  select?: (id: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const pattern = useId()
  const [width, setWidth] = useState(540)
  useEffect(() => {
    const node = host.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(120, entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const left = compact ? 10 : 43
  const right = width - (compact ? 10 : 14)
  const top = compact ? 8 : 28
  const height = compact ? 207 : 309
  const bottom = height - (compact ? 8 : 34)
  const range = Math.min(Number.MAX_VALUE, Math.max(study.takt, baseLoad, summary.maxLoad) * 1.18)
  const lane = (right - left) / summary.stations.length
  const bar = Math.min(lane * .67, 110)
  const y = (value: number) => bottom - value / range * (bottom - top)
  const taktY = y(study.takt)
  const power = 10 ** Math.floor(Math.log10(range / 4))
  const tickStep = ([1, 2, 2.5, 5, 10].find((value) => value * power >= range / 4) ?? 10) * power
  const ticks = [0, 1, 2, 3, 4].map((value) => value * tickStep).filter((value) => value <= range)

  return <div className="takt-plot" ref={host}>
    <svg data-takt-plot viewBox={`0 0 ${width} ${height}`} width={width} height={height}
      role="img" aria-label="Task duration stacked by station against takt time"
      data-top={top} data-bottom={bottom} data-domain={range}>
      <defs><pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M-1,1L1,-1M0,5L5,0M4,6L6,4" className="takt-overload-stripe" />
      </pattern></defs>
      {!compact && <>
        {ticks.map((value) => <g className="takt-grid" key={value}>
          <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
          <text x={left - 7} y={y(value) + 3} textAnchor="end">{format.format(value)}</text>
        </g>)}
        <text x={left} y="13">Seconds per unit</text>
        <text className="takt-limit-label" x={right} y="13" textAnchor="end">Takt {format.format(study.takt)} s</text>
      </>}
      <path className="takt-axis" d={`M${left},${top}V${bottom}H${right}`} />
      {summary.stations.map(({ station, tasks, load, overloaded }, index) => {
        const center = left + lane * (index + .5)
        const start = center - bar / 2
        let previous = 0
        return <g key={station.id} data-takt-station={station.id} data-load={load} data-overloaded={overloaded}>
          {tasks.map((task, row) => {
            const base = y(previous)
            previous += task.seconds
            const upper = y(previous)
            const thickness = base - upper
            const label = task.shortLabel ?? task.label
            const fits = thickness >= 13 && label.length * 5.8 + 6 <= bar
            return <g key={task.id} data-takt-task={task.id} data-seconds={task.seconds}
              data-selected={task.id === taskId} data-shade={row % 3}
              onClick={select ? () => select(task.id) : undefined}>
              <rect data-takt-segment x={start} y={upper} width={bar} height={thickness} />
              {!compact && thickness > 0 && <title>{task.label} · {format.format(task.seconds)} s</title>}
              {!compact && fits && <text className="takt-task-label" x={center} y={(upper + base) / 2 + 3.4} textAnchor="middle">{label}</text>}
            </g>
          })}
          {overloaded && <rect data-takt-excess x={start} y={y(load)} width={bar} height={taktY - y(load)} fill={`url(#${pattern})`} />}
          {!compact && <>
            <text x={center} y={bottom + 15} textAnchor="middle">{station.label}</text>
            <text className="takt-load-label" x={center} y={bottom + 29} textAnchor="middle">{format.format(load)} s</text>
          </>}
        </g>
      })}
      <line className="takt-limit" x1={left} x2={right} y1={taktY} y2={taktY} data-takt-limit={study.takt} />
    </svg>
  </div>
}
