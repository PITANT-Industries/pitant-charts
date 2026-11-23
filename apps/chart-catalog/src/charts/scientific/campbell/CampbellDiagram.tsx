import { useEffect, useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import '../scientific-figure.css'
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
type CampbellDomains = { color: Range; spectrum: Range; speed: Range }

const orders = [1, 2, 3, 4, 5, 6]
const palette = [
  [68, 1, 84],
  [71, 45, 123],
  [59, 82, 139],
  [44, 114, 142],
  [33, 145, 140],
  [40, 174, 128],
  [94, 201, 98],
  [173, 220, 48],
  [253, 231, 37],
] as const
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function increasing(values: readonly number[]) {
  return values.length >= 2 && values.every((value, index) =>
    Number.isFinite(value) && value >= 0 && (index === 0 || value > values[index - 1]))
}

function plotDomains(data: CampbellDiagramData): CampbellDomains | null {
  if (!increasing(data.frequenciesHz) || !data.runs.length) return null
  if (new Set(data.runs.map((run) => run.id)).size !== data.runs.length) return null

  let lowest = Infinity
  let highest = -Infinity
  let minimumSpeed = Infinity
  let maximumSpeed = 0
  for (const run of data.runs) {
    if (!increasing(run.rpm) || run.levelsDb.length !== run.rpm.length) return null
    minimumSpeed = Math.min(minimumSpeed, run.rpm[0])
    maximumSpeed = Math.max(maximumSpeed, run.rpm[run.rpm.length - 1])
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
  return { color: [Math.max(highest - 60, minimum), highest], spectrum: [minimum, highest], speed: [minimumSpeed, maximumSpeed] }
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

function CampbellMap({ run, frequencies, range, speedRange, speed, band, showOrders, compact, label, onPick }: {
  run: CampbellRun
  frequencies: readonly number[]
  range: Range
  speedRange: Range
  speed: number
  band: number
  showOrders: boolean
  compact: boolean
  label: string
  onPick: (speed: number, band: number) => void
}) {
  const clipId = useId()
  const scaleId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 400 : 750, 300)
  const [raster, setRaster] = useState<{ run: CampbellRun; frequencies: readonly number[]; range: Range; url?: string }>()
  useEffect(() => {
    setRaster({ run, frequencies, range, url: heatmapImage(run, frequencies, range) })
  }, [run, frequencies, range])
  const image = raster?.run === run && raster.frequencies === frequencies && raster.range === range ? raster.url : undefined
  const left = width < 375 ? 48 : 55
  const right = Math.max(left + 1, width - (width < 375 ? 67 : 79))
  const top = compact ? 20 : 26
  const bottom = Math.max(top + 1, height - 41)
  const centerY = (top + bottom) / 2
  const colorLeft = right + (width < 375 ? 10 : 16)
  const colorWidth = 11
  const colorDivisions = compact ? 2 : 3
  const colorTicks = Array.from({ length: colorDivisions + 1 }, (_, index) => index / colorDivisions)
  const firstSpeed = run.rpm[0]
  const lastSpeed = run.rpm[run.rpm.length - 1]
  const firstHz = frequencies[0]
  const lastHz = frequencies[frequencies.length - 1]
  const x = (rpm: number) => blend(left, right, (rpm - speedRange[0]) / (speedRange[1] - speedRange[0]))
  const y = (hz: number) => blend(bottom, top, (hz - firstHz) / (lastHz - firstHz))
  const rpmTicks = ticks(speedRange[0], speedRange[1], tickInterval(speedRange[1] - speedRange[0], width < 400 ? 3 : 6))
  const frequencyTicks = ticks(firstHz, lastHz, tickInterval(lastHz - firstHz, 5))
  const measuredLeft = x(firstSpeed)
  const measuredWidth = x(lastSpeed) - measuredLeft

  function select(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const rpm = blend(firstSpeed, lastSpeed, (event.clientX - bounds.left) / bounds.width)
    const hz = blend(lastHz, firstHz, (event.clientY - bounds.top) / bounds.height)
    onPick(closestIndex(run.rpm, rpm), closestIndex(frequencies, hz))
  }

  return (
    <div className="campbell-map scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-campbell-heatmap="" role="img" aria-label={`${label}, ${run.label}, relative amplitude ${format.format(range[0])} to ${format.format(range[1])} dB`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={measuredLeft} y={top} width={measuredWidth} height={bottom - top} />
          </clipPath>
          <linearGradient id={scaleId} x1="0%" y1="100%" x2="0%" y2="0%">
            {palette.map((color, index) => (
              <stop key={index} offset={index / (palette.length - 1)} stopColor={`rgb(${color.join(' ')})`} />
            ))}
          </linearGradient>
        </defs>
        {image && <image data-campbell-raster="" href={image} x={measuredLeft} y={top} width={measuredWidth} height={bottom - top} preserveAspectRatio="none" />}
        {showOrders && (
          <g clipPath={`url(#${clipId})`} aria-hidden="true">
            {orders.map((order) => (
              <line key={order} className="campbell-order" x1={measuredLeft} y1={y(firstSpeed * order / 60)}
                x2={measuredLeft + measuredWidth} y2={y(lastSpeed * order / 60)} />
            ))}
          </g>
        )}
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-campbell-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={compact ? 13 : 15}>
            {compact ? run.label : '(a) Frequency–speed map'}
          </text>
          <text className="scientific-axis-label" transform={`translate(13 ${centerY}) rotate(-90)`} textAnchor="middle">Frequency (Hz)</text>
          {frequencyTicks.map((hz) => (
            <g key={hz}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(hz)} y2={y(hz)} />
              <text x={left - 8} y={y(hz) + 4} textAnchor="end">{format.format(hz)}</text>
            </g>
          ))}
          {rpmTicks.map((rpm) => (
            <g key={rpm}>
              <line className="scientific-tick" x1={x(rpm)} x2={x(rpm)} y1={bottom} y2={bottom + 4} />
              <text x={x(rpm)} y={bottom + 17} textAnchor="middle">{format.format(rpm)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Shaft speed (rpm)</text>
        </g>
        <g className="scientific-axis" aria-hidden="true" data-campbell-colorbar="">
          <rect x={colorLeft} y={top} width={colorWidth} height={bottom - top} fill={`url(#${scaleId})`} />
          <rect className="scientific-frame" x={colorLeft} y={top} width={colorWidth} height={bottom - top} />
          {colorTicks.map((fraction) => {
            const tickY = blend(bottom, top, fraction)
            const tickX = colorLeft + colorWidth
            return (
              <g key={fraction}>
                <line className="scientific-tick" x1={tickX} x2={tickX + 4} y1={tickY} y2={tickY} />
                <text x={tickX + 7} y={tickY + 4}>{format.format(blend(range[0], range[1], fraction))}</text>
              </g>
            )
          })}
          <text className="scientific-axis-label" transform={`translate(${width - 8} ${centerY}) rotate(-90)`} textAnchor="middle">Relative amplitude (dB)</text>
        </g>
        {!compact && (
          <>
            <g className="campbell-crosshair" aria-hidden="true" clipPath={`url(#${clipId})`}>
              <line x1={x(run.rpm[speed])} x2={x(run.rpm[speed])} y1={top} y2={bottom} />
              <line x1={left} x2={right} y1={y(frequencies[band])} y2={y(frequencies[band])} />
              <circle cx={x(run.rpm[speed])} cy={y(frequencies[band])} r={4} />
            </g>
            <rect className="campbell-pick" x={measuredLeft} y={top} width={measuredWidth} height={bottom - top}
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
  const left = width < 375 ? 48 : 55
  const right = Math.max(left + 1, width - 18)
  const top = 26
  const bottom = Math.max(top + 1, height - 41)
  const firstHz = frequencies[0]
  const lastHz = frequencies[frequencies.length - 1]
  const x = (hz: number) => blend(left, right, (hz - firstHz) / (lastHz - firstHz))
  const y = (value: number) => blend(bottom, top, (value - range[0]) / (range[1] - range[0]))
  const path = levels.map((level, index) => `${index ? 'L' : 'M'}${x(frequencies[index])} ${y(level)}`).join(' ')
  const frequencyTicks = ticks(firstHz, lastHz, tickInterval(lastHz - firstHz, width < 400 ? 3 : 6))
  return (
    <div className="campbell-spectrum scientific-plot" ref={plot} data-campbell-spectrum="">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Frequency spectrum at the selected shaft speed">
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={15}>(b) Spectrum at selected speed</text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Relative amplitude (dB)</text>
          {[range[0], blend(range[0], range[1], .5), range[1]].map((level) => (
            <g key={level}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(level)} y2={y(level)} />
              <text x={left - 8} y={y(level) + 4} textAnchor="end">{format.format(level)}</text>
            </g>
          ))}
          {frequencyTicks.map((hz) => (
            <g key={hz}>
              <line className="scientific-tick" x1={x(hz)} x2={x(hz)} y1={bottom} y2={bottom + 4} />
              <text x={x(hz)} y={bottom + 17} textAnchor="middle">{format.format(hz)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Frequency (Hz)</text>
        </g>
        <path className="campbell-spectrum-line" d={path} data-campbell-spectrum-path="" />
        <line className="scientific-reference" x1={x(frequencies[band])} x2={x(frequencies[band])} y1={top} y2={bottom} />
        <circle className="campbell-spectrum-marker" cx={x(frequencies[band])} cy={y(levels[band])} r={3.5} />
      </svg>
    </div>
  )
}

function CampbellFigure({ data, label, compact, source, domains }: CampbellDiagramProps & { label: string; domains: CampbellDomains }) {
  const [runId, setRunId] = useState(data.runs[0].id)
  const [selectedSpeed, setSpeed] = useState(() => Math.floor(data.runs[0].rpm.length / 2))
  const [selectedBand, setBand] = useState(() => {
    const initialSpectrum = data.runs[0].levelsDb[selectedSpeed]
    return initialSpectrum.reduce((peak, level, index) => level > initialSpectrum[peak] ? index : peak, 0)
  })
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
      {!compact && (
        <div className="campbell-options">
          <label>Bearing condition
            <select value={run.id} onChange={(event) => changeRun(event.currentTarget.value)}>
              {data.runs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="campbell-show-orders">
            <input type="checkbox" checked={showOrders} onChange={(event) => setShowOrders(event.currentTarget.checked)} />
            Show shaft orders (1×–6×)
          </label>
        </div>
      )}
      <CampbellMap run={run} frequencies={data.frequenciesHz} range={domains.color} speedRange={domains.speed} speed={speed} band={band}
        showOrders={showOrders} compact={Boolean(compact)} label={label} onPick={pick} />
      {!compact && (
        <>
          <SpectrumSlice frequencies={data.frequenciesHz} levels={run.levelsDb[speed]} range={domains.spectrum} band={band} />
          <div className="campbell-inspector">
            <output data-campbell-readout="" data-rpm={rpm} data-frequency={frequency} data-level={level}>
              <strong>{format.format(rpm)} RPM</strong>
              <span>{format.format(frequency)} Hz · {format.format(level)} dB</span>
            </output>
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
      {!compact && source && (
        <figcaption className="campbell-source">
          <strong>{source.label}</strong>
          <p>{source.description} <a href={source.href}>Dataset</a>
            {source.license && <> · {source.licenseUrl ? <a href={source.licenseUrl}>{source.license}</a> : source.license}</>}</p>
        </figcaption>
      )}
    </figure>
  )
}

export function CampbellDiagram({ label = 'Campbell diagram', ...props }: CampbellDiagramProps) {
  const domains = useMemo(() => plotDomains(props.data), [props.data])
  if (!domains) {
    return <p className="chart-render-message" role="status">Provide ordered shaft speeds, frequencies, and a complete amplitude grid for each run.</p>
  }
  return <CampbellFigure {...props} label={label} domains={domains} />
}
