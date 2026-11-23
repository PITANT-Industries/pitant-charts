import { useEffect, useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import './campbell-diagram.css'

export interface CampbellRun {
  id: string
  label: string
  rpm: readonly number[]
  levelsDb: readonly (readonly number[])[]
}

export interface CampbellDiagramData {
  frequenciesHz: readonly number[]
  runs: readonly CampbellRun[]
}

export interface CampbellDiagramProps {
  data: CampbellDiagramData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Range = [min: number, max: number]
type AmplitudeDomains = { color: Range; spectrum: Range }

const orders = [1, 2, 3, 4, 5, 6]
const palette = [
  [12, 19, 36],
  [25, 38, 77],
  [27, 79, 112],
  [27, 140, 143],
  [120, 198, 157],
  [255, 223, 124],
] as const
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const colorScale = `linear-gradient(to right, ${palette.map((color) => `rgb(${color.join(' ')})`).join(', ')})`

function increasing(values: readonly number[]) {
  return values.length >= 2 && values.every((value, index) =>
    Number.isFinite(value) && value >= 0 && (index === 0 || value > values[index - 1]))
}

function amplitudeDomains(data: CampbellDiagramData): AmplitudeDomains | null {
  if (!increasing(data.frequenciesHz) || !data.runs.length) return null
  if (new Set(data.runs.map((run) => run.id)).size !== data.runs.length) return null

  let lowest = Infinity
  let highest = -Infinity
  for (const run of data.runs) {
    if (!increasing(run.rpm) || run.levelsDb.length !== run.rpm.length) return null
    for (const spectrum of run.levelsDb) {
      if (spectrum.length !== data.frequenciesHz.length) return null
      for (const level of spectrum) {
        if (!Number.isFinite(level)) return null
        lowest = Math.min(lowest, level)
        highest = Math.max(highest, level)
      }
    }
  }
  const minimum = Math.min(lowest, highest - 1)
  if (minimum >= highest || !Number.isFinite(highest - minimum)) return null
  return { color: [Math.max(highest - 60, minimum), highest], spectrum: [minimum, highest] }
}

function lowerIndex(values: readonly number[], value: number) {
  let start = 0
  let end = values.length - 1
  while (end - start > 1) {
    const mid = (start + end) >>> 1
    if (value < values[mid]) end = mid
    else start = mid
  }
  return start
}

function closestIndex(values: readonly number[], value: number) {
  const lower = lowerIndex(values, value)
  return Math.abs(values[lower] - value) <= Math.abs(values[lower + 1] - value) ? lower : lower + 1
}

function blend(left: number, right: number, amount: number) {
  return left + (right - left) * amount
}

function pixelAxis(values: readonly number[], size: number, reverse = false) {
  const first = values[0]
  const last = values[values.length - 1]
  return Array.from({ length: size }, (_, index) => {
    const fraction = (index + .5) / size
    const value = blend(first, last, reverse ? 1 - fraction : fraction)
    const lower = lowerIndex(values, value)
    return { lower, weight: (value - values[lower]) / (values[lower + 1] - values[lower]) }
  })
}

function heatmapImage(run: CampbellRun, frequencies: readonly number[], range: Range) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 400
  const context = canvas.getContext('2d')
  if (!context) return undefined

  const image = context.createImageData(canvas.width, canvas.height)
  const speeds = pixelAxis(run.rpm, canvas.width)
  const bands = pixelAxis(frequencies, canvas.height, true)
  let offset = 0
  for (const band of bands) {
    for (const speed of speeds) {
      const first = run.levelsDb[speed.lower]
      const next = run.levelsDb[speed.lower + 1]
      const level = blend(
        blend(first[band.lower], first[band.lower + 1], band.weight),
        blend(next[band.lower], next[band.lower + 1], band.weight),
        speed.weight,
      )
      const fraction = Math.max(0, Math.min(1, (level - range[0]) / (range[1] - range[0])))
      const position = fraction * (palette.length - 1)
      const stop = Math.min(palette.length - 2, Math.floor(position))
      for (let channel = 0; channel < 3; channel++) {
        image.data[offset++] = blend(palette[stop][channel], palette[stop + 1][channel], position - stop)
      }
      image.data[offset++] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function ticks(first: number, last: number, interval: number) {
  if (!Number.isFinite(interval) || interval <= 0) return [first, last]
  const result: number[] = []
  const start = Math.ceil(first / interval) * interval
  for (let index = 0; index < 10; index++) {
    const value = start + index * interval
    if (value > last || (index > 0 && value <= result[index - 1])) break
    result.push(value)
  }
  return result.length > 1 ? result : [first, last]
}

function tickInterval(extent: number, limit: number) {
  const target = extent / limit
  const power = 10 ** Math.floor(Math.log10(target))
  return ([1, 2, 5, 10].find((step) => step * power >= target) ?? 10) * power
}

function CampbellMap({ run, frequencies, range, speed, band, showOrders, compact, label, onPick }: {
  run: CampbellRun
  frequencies: readonly number[]
  range: Range
  speed: number
  band: number
  showOrders: boolean
  compact: boolean
  label: string
  onPick: (speed: number, band: number) => void
}) {
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 400 : 750, 300)
  const [raster, setRaster] = useState<{ run: CampbellRun; frequencies: readonly number[]; range: Range; url?: string }>()
  useEffect(() => {
    setRaster({ run, frequencies, range, url: heatmapImage(run, frequencies, range) })
  }, [run, frequencies, range])
  const image = raster?.run === run && raster.frequencies === frequencies && raster.range === range ? raster.url : undefined
  const left = 40
  const right = Math.max(left + 1, width - 16)
  const top = 24
  const bottom = Math.max(top + 1, height - 38)
  const firstSpeed = run.rpm[0]
  const lastSpeed = run.rpm[run.rpm.length - 1]
  const firstHz = frequencies[0]
  const lastHz = frequencies[frequencies.length - 1]
  const x = (rpm: number) => blend(left, right, (rpm - firstSpeed) / (lastSpeed - firstSpeed))
  const y = (hz: number) => blend(bottom, top, (hz - firstHz) / (lastHz - firstHz))
  const rpmTicks = ticks(firstSpeed, lastSpeed, tickInterval(lastSpeed - firstSpeed, width < 400 ? 3 : 6))
  const frequencyTicks = ticks(firstHz, lastHz, tickInterval(lastHz - firstHz, 5))

  function select(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const rpm = blend(firstSpeed, lastSpeed, (event.clientX - bounds.left) / bounds.width)
    const hz = blend(lastHz, firstHz, (event.clientY - bounds.top) / bounds.height)
    onPick(closestIndex(run.rpm, rpm), closestIndex(frequencies, hz))
  }

  return (
    <div className="campbell-map" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-campbell-heatmap="" role="img" aria-label={label}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        {image && <image data-campbell-raster="" href={image} x={left} y={top} width={right - left} height={bottom - top} preserveAspectRatio="none" />}
        {showOrders && (
          <g clipPath={`url(#${clipId})`} aria-hidden="true">
            {orders.map((order) => {
              const hz = lastSpeed * order / 60
              return <g key={order}>
                <line className="campbell-order" x1={left} y1={y(firstSpeed * order / 60)} x2={right} y2={y(hz)} />
                <text className="campbell-order-label" x={right - 7} y={y(hz) - 3} textAnchor="end">{order}×</text>
              </g>
            })}
          </g>
        )}
        <g className="campbell-map-labels" aria-hidden="true">
          <text className="campbell-axis-title" x={left} y={16}>Frequency (Hz)</text>
          {frequencyTicks.map((hz) => <text key={hz} x={left - 6} y={y(hz) + 4} textAnchor="end">{format.format(hz)}</text>)}
          {rpmTicks.map((rpm) => <text key={rpm} x={x(rpm)} y={bottom + 14} textAnchor="middle">{format.format(rpm)}</text>)}
          <text className="campbell-axis-title" x={(left + right) / 2} y={height - 6} textAnchor="middle">Shaft speed (RPM)</text>
        </g>
        {!compact && (
          <>
            <g className="campbell-crosshair" aria-hidden="true" clipPath={`url(#${clipId})`}>
              <line x1={x(run.rpm[speed])} x2={x(run.rpm[speed])} y1={top} y2={bottom} />
              <line x1={left} x2={right} y1={y(frequencies[band])} y2={y(frequencies[band])} />
              <circle cx={x(run.rpm[speed])} cy={y(frequencies[band])} r={4} />
            </g>
            <rect className="campbell-pick" x={left} y={top} width={right - left} height={bottom - top}
              fill="transparent" onClick={select} />
          </>
        )}
      </svg>
    </div>
  )
}

function SpectrumSlice({ frequencies, levels, range, band }: {
  frequencies: readonly number[]
  levels: readonly number[]
  range: Range
  band: number
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(780, 150)
  const left = 41
  const right = Math.max(left + 1, width - 16)
  const top = 20
  const bottom = Math.max(top + 1, height - 32)
  const firstHz = frequencies[0]
  const lastHz = frequencies[frequencies.length - 1]
  const x = (hz: number) => blend(left, right, (hz - firstHz) / (lastHz - firstHz))
  const y = (value: number) => blend(bottom, top, (value - range[0]) / (range[1] - range[0]))
  const path = levels.map((level, index) => `${index ? 'L' : 'M'}${x(frequencies[index])} ${y(level)}`).join(' ')
  const frequencyTicks = ticks(firstHz, lastHz, tickInterval(lastHz - firstHz, width < 400 ? 3 : 6))
  return (
    <div className="campbell-spectrum" ref={plot} data-campbell-spectrum="">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Frequency spectrum at the selected shaft speed">
        <g className="campbell-spectrum-labels" aria-hidden="true">
          <text className="campbell-axis-title" x={left} y={14}>Relative amplitude (dB)</text>
          {[range[0], blend(range[0], range[1], .5), range[1]].map((level) => (
            <g key={level}>
              <line x1={left} x2={right} y1={y(level)} y2={y(level)} />
              <text x={left - 5} y={y(level) + 3} textAnchor="end">{format.format(level)}</text>
            </g>
          ))}
          {frequencyTicks.map((hz) => <text key={hz} x={x(hz)} y={bottom + 12} textAnchor="middle">{format.format(hz)}</text>)}
          <text className="campbell-axis-title" x={(left + right) / 2} y={height - 4} textAnchor="middle">Frequency (Hz)</text>
        </g>
        <path className="campbell-spectrum-line" d={path} data-campbell-spectrum-path="" />
        <line className="campbell-spectrum-guide" x1={x(frequencies[band])} x2={x(frequencies[band])} y1={top} y2={bottom} />
        <circle className="campbell-spectrum-marker" cx={x(frequencies[band])} cy={y(levels[band])} r={3.5} />
      </svg>
    </div>
  )
}

function CampbellFigure({ data, label, compact, source, domains }: CampbellDiagramProps & { label: string; domains: AmplitudeDomains }) {
  const [runId, setRunId] = useState(data.runs[0].id)
  const [selectedSpeed, setSpeed] = useState(0)
  const [selectedBand, setBand] = useState(0)
  const [showOrders, setShowOrders] = useState(true)
  const run = data.runs.find(({ id }) => id === runId) ?? data.runs[0]
  const speed = Math.min(selectedSpeed, run.rpm.length - 1)
  const band = Math.min(selectedBand, data.frequenciesHz.length - 1)
  const rpm = run.rpm[speed]
  const frequency = data.frequenciesHz[band]
  const level = run.levelsDb[speed][band]

  function pick(nextSpeed: number, nextBand: number) {
    setSpeed(nextSpeed)
    setBand(nextBand)
  }

  function changeRun(nextId: string) {
    const nextRun = data.runs.find(({ id }) => id === nextId)
    if (!nextRun) return
    setRunId(nextId)
    setSpeed(closestIndex(nextRun.rpm, rpm))
  }

  return (
    <figure className="campbell-diagram" data-compact={compact}>
      {!compact && source && (
        <figcaption className="campbell-source">
          <strong>{source.label}</strong>
          <p>{source.description} <a href={source.href}>Dataset</a>
            {source.license && <> · {source.licenseUrl ? <a href={source.licenseUrl}>{source.license}</a> : source.license}</>}</p>
        </figcaption>
      )}
      {!compact && (
        <div className="campbell-options">
          <label>Bearing condition
            <select value={run.id} onChange={(event) => changeRun(event.currentTarget.value)}>
              {data.runs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="campbell-show-orders">
            <input type="checkbox" checked={showOrders} onChange={(event) => setShowOrders(event.currentTarget.checked)} />
            Show shaft orders
          </label>
        </div>
      )}
      <CampbellMap run={run} frequencies={data.frequenciesHz} range={domains.color} speed={speed} band={band}
        showOrders={showOrders} compact={Boolean(compact)} label={label} onPick={pick} />
      {!compact && (
        <>
          <div className="campbell-scale">
            <span>{format.format(domains.color[0])} dB</span>
            <span aria-hidden="true" style={{ background: colorScale }} />
            <span>{format.format(domains.color[1])} dB</span>
          </div>
          <div className="campbell-inspector">
            <output data-campbell-readout="" data-rpm={rpm} data-frequency={frequency} data-level={level}>
              <strong>{format.format(rpm)} RPM</strong>
              <span>{format.format(frequency)} Hz · {format.format(level)} dB</span>
            </output>
            <SpectrumSlice frequencies={data.frequenciesHz} levels={run.levelsDb[speed]} range={domains.spectrum} band={band} />
            <div className="campbell-sliders">
              <label>Shaft speed
                <input type="range" min={0} max={run.rpm.length - 1} value={speed}
                  aria-valuetext={`${format.format(rpm)} RPM`} onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)} />
              </label>
              <label>Frequency
                <input type="range" min={0} max={data.frequenciesHz.length - 1} value={band}
                  aria-valuetext={`${format.format(frequency)} Hz`} onChange={(event) => setBand(event.currentTarget.valueAsNumber)} />
              </label>
            </div>
          </div>
        </>
      )}
    </figure>
  )
}

export function CampbellDiagram({ label = 'Campbell diagram', ...props }: CampbellDiagramProps) {
  const domains = useMemo(() => amplitudeDomains(props.data), [props.data])
  if (!domains) {
    return <p className="chart-render-message" role="status">Provide ordered shaft speeds, frequencies, and a complete amplitude grid for each run.</p>
  }
  return <CampbellFigure {...props} label={label} domains={domains} />
}
