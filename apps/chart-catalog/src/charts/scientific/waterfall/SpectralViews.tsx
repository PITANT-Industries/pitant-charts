import { useId, useMemo } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { axisTitle, intensityExtent, readIntensity } from './model'
import type { SpectralSelection, SpectralWaterfallAxes, SpectralWaterfallData } from './model'
import './spectral-views.css'

type Range = readonly [number, number]
type Point = readonly [number, number]

interface SpectralViewProps {
  data: SpectralWaterfallData
  axes: SpectralWaterfallAxes
  selection: SpectralSelection
  onSelect: (selection: SpectralSelection) => void
}

interface Frame {
  left: number
  right: number
  top: number
  bottom: number
}

const colors = [[22, 38, 65], [29, 76, 119], [37, 130, 120], [155, 183, 92], [255, 223, 116]]
const colorCount = 48
const rgb = (channels: number[]) => 'rgb(' + channels.join(' ') + ')'
const shades = Array.from({ length: colorCount }, (_, index) => {
  const step = index / (colorCount - 1) * (colors.length - 1)
  const start = Math.min(colors.length - 2, Math.floor(step))
  return rgb(colors[start].map((channel, i) => Math.round(channel + (colors[start + 1][i] - channel) * (step - start))))
})
const gradient = 'linear-gradient(90deg, ' + colors.map(rgb).join(', ') + ')'
const formatTick = new Intl.NumberFormat('en', { maximumSignificantDigits: 5, useGrouping: false })

function format(value: number) {
  const magnitude = Math.abs(value)
  return magnitude >= 1e6 || magnitude > 0 && magnitude < .0001 ? value.toExponential(2) : formatTick.format(value)
}

function domain(values: ArrayLike<number>): Range {
  return [values[0], values[values.length - 1]]
}

function expand([start, end]: Range): Range {
  if (start !== end) return [start, end]
  const pad = Math.max(Math.abs(start) * .01, .5)
  return [start - pad, end + pad]
}

function scale([start, end]: Range, [low, high]: Range) {
  return (value: number) => low + (value - start) / (end - start) * (high - low)
}

function tickValues([start, end]: Range, count: number) {
  return start === end ? [start] : Array.from({ length: count }, (_, index) => start + index / (count - 1) * (end - start))
}

function binEdges(values: ArrayLike<number>) {
  if (values.length === 1) return expand([values[0], values[0]])
  return Array.from({ length: values.length + 1 }, (_, index) => {
    if (index === 0) return values[0] - (values[1] - values[0]) / 2
    if (index === values.length) {
      const last = values[index - 1]
      return last + (last - values[index - 2]) / 2
    }
    return values[index - 1] + (values[index] - values[index - 1]) / 2
  })
}

function nearestIndex(values: ArrayLike<number>, target: number) {
  let left = 0
  let right = values.length - 1
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2)
    if (values[middle] <= target) left = middle
    else right = middle
  }
  return Math.abs(values[left] - target) <= Math.abs(values[right] - target) ? left : right
}

function eventPoint(event: MouseEvent<SVGSVGElement>, { left, right, top, bottom }: Frame): Point | undefined {
  const transform = event.currentTarget.getScreenCTM()
  if (!transform) return
  const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
  if (x >= left && x <= right && y >= top && y <= bottom) return [x, y]
}

function selectWithKeys(event: KeyboardEvent<SVGSVGElement>, { data, selection, onSelect }: SpectralViewProps) {
  const { scanIndex, binIndex } = selection
  const next: Record<string, SpectralSelection> = {
    ArrowLeft: { scanIndex, binIndex: Math.max(0, binIndex - 1) },
    ArrowRight: { scanIndex, binIndex: Math.min(data.spectralBins.length - 1, binIndex + 1) },
    ArrowUp: { scanIndex: Math.min(data.scanValues.length - 1, scanIndex + 1), binIndex },
    ArrowDown: { scanIndex: Math.max(0, scanIndex - 1), binIndex },
    Home: { scanIndex, binIndex: 0 },
    End: { scanIndex, binIndex: data.spectralBins.length - 1 },
  }
  if (!Object.hasOwn(next, event.key)) return
  event.preventDefault()
  onSelect(next[event.key])
}

function frameFor(width: number, height: number): Frame {
  return { left: 58, right: Math.max(59, width - 15), top: 13, bottom: Math.max(14, height - 41) }
}

function PlotAxes({ frame, xTicks, yTicks, x, y, xTitle, yTitle, guides }: {
  frame: Frame
  xTicks: number[]
  yTicks: number[]
  x: (value: number) => number
  y: (value: number) => number
  xTitle: string
  yTitle: string
  guides?: boolean
}) {
  const { left, right, top, bottom } = frame
  const yMiddle = (bottom + top) / 2
  return (
    <g aria-hidden="true" className="spectral-view-axes">
      {yTicks.map(value => (
        <g key={value}>
          {guides && <line className="spectral-view-grid" x1={left} x2={right} y1={y(value)} y2={y(value)} />}
          <text x={left - 7} y={y(value)} textAnchor="end" dominantBaseline="middle">{format(value)}</text>
        </g>
      ))}
      {xTicks.map((value, index) => (
        <text key={value} x={x(value)} y={bottom + 16} textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}>{format(value)}</text>
      ))}
      <path className="spectral-view-axis" d={'M' + left + ' ' + top + 'V' + bottom + 'H' + right} />
      <text className="spectral-view-unit" x={(left + right) / 2} y={bottom + 33} textAnchor="middle">{xTitle}</text>
      <text className="spectral-view-unit" x={12} y={yMiddle} textAnchor="middle" transform={'rotate(-90 12 ' + yMiddle + ')'}>{yTitle}</text>
    </g>
  )
}

function heatmapCells(data: SpectralWaterfallData, x: (value: number) => number, y: (value: number) => number, spectralEdges: ArrayLike<number>, scanEdges: ArrayLike<number>, range: Range) {
  const paths = Array.from({ length: colorCount }, () => [] as string[])
  const xEdges = Array.from(spectralEdges, x)
  const yEdges = Array.from(scanEdges, y)
  const [min, max] = range
  for (let scanIndex = 0; scanIndex < data.scanValues.length; scanIndex++) {
    const top = yEdges[scanIndex + 1]
    const bottom = yEdges[scanIndex]
    for (let binIndex = 0; binIndex < data.spectralBins.length; binIndex++) {
      const value = readIntensity(data, { scanIndex, binIndex })
      if (!Number.isFinite(value)) continue
      const color = Math.round((min === max ? .5 : (value - min) / (max - min)) * (colorCount - 1))
      const left = xEdges[binIndex]
      const right = xEdges[binIndex + 1]
      paths[color].push('M' + left + ' ' + top + 'H' + right + 'V' + bottom + 'H' + left + 'Z')
    }
  }
  return paths.map(parts => parts.join(''))
}

export function SpectralHeatmap(props: SpectralViewProps) {
  const { data, axes, selection, onSelect } = props
  const id = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(486, 220)
  const frame = frameFor(width, height)
  const model = useMemo(() => {
    const xEdges = binEdges(data.spectralBins)
    const yEdges = binEdges(data.scanValues)
    const xRange = domain(xEdges)
    const yRange = domain(yEdges)
    const values = intensityExtent(data.values) ?? [0, 1] as const
    const x = scale(xRange, [frame.left, frame.right])
    const y = scale(yRange, [frame.bottom, frame.top])
    return { x, y, xRange, yRange, values, cells: heatmapCells(data, x, y, xEdges, yEdges, values) }
  }, [data, frame.left, frame.right, frame.top, frame.bottom])
  const { x, y, xRange, yRange, values, cells } = model
  const selectedX = x(data.spectralBins[selection.binIndex])
  const selectedY = y(data.scanValues[selection.scanIndex])

  function selectCell(event: MouseEvent<SVGSVGElement>) {
    const point = eventPoint(event, frame)
    if (!point) return
    const spectral = scale([frame.left, frame.right], xRange)(point[0])
    const scan = scale([frame.bottom, frame.top], yRange)(point[1])
    onSelect({ scanIndex: nearestIndex(data.scanValues, scan), binIndex: nearestIndex(data.spectralBins, spectral) })
  }

  return (
    <section className="spectral-linked-view" data-spectral-view="heatmap">
      <h3>Spectral heatmap</h3>
      <div className="spectral-linked-plot" ref={plot}>
        <svg viewBox={['0', '0', width, height].join(' ')} role="img" aria-label="Spectral heatmap" aria-describedby={id} tabIndex={0}
          onClick={selectCell} onKeyDown={event => selectWithKeys(event, props)}>
          <desc id={id}>Use left and right arrows to select a spectral bin, and up and down arrows to select a scan.</desc>
          <g aria-hidden="true" className="spectral-heatmap-cells">
            <rect className="spectral-heatmap-missing" x={frame.left} y={frame.top} width={frame.right - frame.left} height={frame.bottom - frame.top} />
            {cells.map((path, index) => path && <path key={index} d={path} fill={shades[index]} />)}
          </g>
          <PlotAxes frame={frame} xTicks={tickValues(domain(data.spectralBins), width < 375 ? 3 : 5)} yTicks={tickValues(domain(data.scanValues), 4)}
            x={x} y={y} xTitle={axisTitle(axes.spectral)} yTitle={axisTitle(axes.scan)} />
          <g aria-hidden="true" className="spectral-view-crosshair" data-spectral-selection>
            <line x1={frame.left} x2={frame.right} y1={selectedY} y2={selectedY} />
            <line x1={selectedX} x2={selectedX} y1={frame.top} y2={frame.bottom} />
            <circle cx={selectedX} cy={selectedY} r="4" />
          </g>
        </svg>
      </div>
      <div className="spectral-heatmap-legend">
        <span>{axisTitle(axes.intensity)}</span>
        <div><span>{format(values[0])}</span><span aria-hidden="true" className="spectral-heatmap-ramp" style={{ backgroundImage: gradient }} /><span>{format(values[1])}</span></div>
      </div>
    </section>
  )
}

function spectrumPath(data: SpectralWaterfallData, scanIndex: number, x: (value: number) => number, y: (value: number) => number) {
  const path: string[] = []
  const isolated: Point[] = []
  let previous: Point | undefined
  let length = 0
  for (let binIndex = 0; binIndex < data.spectralBins.length; binIndex++) {
    const value = readIntensity(data, { scanIndex, binIndex })
    if (!Number.isFinite(value)) {
      if (length === 1 && previous) isolated.push(previous)
      length = 0
      continue
    }
    const point = [x(data.spectralBins[binIndex]), y(value)] as const
    path.push((length === 0 ? 'M' : 'L') + point.join(' '))
    previous = point
    length++
  }
  if (length === 1 && previous) isolated.push(previous)
  return { path: path.join(''), isolated }
}

export function SelectedSpectrum(props: SpectralViewProps) {
  const { data, axes, selection, onSelect } = props
  const id = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(486, 220)
  const frame = frameFor(width, height)
  const spectralRange = domain(data.spectralBins)
  const xRange = expand(spectralRange)
  const intensityRange = useMemo(() => intensityExtent(data.values) ?? [0, 1] as const, [data.values])
  const x = scale(xRange, [frame.left, frame.right])
  const y = scale(expand(intensityRange), [frame.bottom, frame.top])
  const { path, isolated } = spectrumPath(data, selection.scanIndex, x, y)
  const selectedX = x(data.spectralBins[selection.binIndex])
  const intensity = readIntensity(data, selection)

  function selectBin(event: MouseEvent<SVGSVGElement>) {
    const point = eventPoint(event, frame)
    if (!point) return
    const spectral = scale([frame.left, frame.right], xRange)(point[0])
    onSelect({ scanIndex: selection.scanIndex, binIndex: nearestIndex(data.spectralBins, spectral) })
  }

  return (
    <section className="spectral-linked-view" data-spectral-view="spectrum">
      <h3>Selected spectrum</h3>
      <div className="spectral-linked-plot" ref={plot}>
        <svg viewBox={['0', '0', width, height].join(' ')} role="img" aria-label="Selected spectrum" aria-describedby={id} tabIndex={0}
          onClick={selectBin} onKeyDown={event => selectWithKeys(event, props)}>
          <desc id={id}>The measured intensity trace for the selected scan. Use left and right arrows to select a spectral bin, and up and down arrows to change the scan.</desc>
          <PlotAxes frame={frame} xTicks={tickValues(spectralRange, width < 375 ? 3 : 5)} yTicks={tickValues(intensityRange, 4)}
            x={x} y={y} xTitle={axisTitle(axes.spectral)} yTitle={axisTitle(axes.intensity)} guides />
          <g aria-hidden="true" className="spectral-view-trace">
            <path d={path} />
            {isolated.map(([xValue, yValue]) => <circle key={xValue} cx={xValue} cy={yValue} r="2" />)}
          </g>
          <g aria-hidden="true" className="spectral-view-marker" data-spectral-selection>
            <line x1={selectedX} x2={selectedX} y1={frame.top} y2={frame.bottom} />
            {Number.isFinite(intensity) && <circle cx={selectedX} cy={y(intensity)} r="4" />}
          </g>
        </svg>
      </div>
    </section>
  )
}
