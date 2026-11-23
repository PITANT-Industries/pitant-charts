import { mapDataPointToChartPoint, mapPointerToChartCoordinates } from '@pitant/charts'
import type { ChartLayout, CorrelationPlannedCell, NumericRange } from '@pitant/charts'
import {
  CorrelationMatrix,
  Distribution,
  Spectrogram,
  Spectrum,
  TimeSeries,
} from '@pitant/charts-react'
import type { CorrelationMatrixData } from '@pitant/charts-react'
import { useId, useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { ChartPreviewProps } from '../../types'
import { useChartTheme } from '../theme'
import {
  capabilityFixture,
  correlationFixture,
  processControlFixture,
  spectrogramFixture,
  spectrumFixture,
  steelCorrelationFixture,
} from './data'
import type { MeasuredSource } from './data'
import './scientific.css'

type Color = readonly [red: number, green: number, blue: number, alpha: number]
type ColorStop = { value: number; rgba: Color }

const spectrumGradient: readonly ColorStop[] = [
  { value: 0, rgba: [0.06, 0.11, 0.2, 1] },
  { value: 0.25, rgba: [0.14, 0.29, 0.45, 1] },
  { value: 0.5, rgba: [0.17, 0.55, 0.53, 1] },
  { value: 0.75, rgba: [0.54, 0.73, 0.38, 1] },
  { value: 1, rgba: [0.98, 0.88, 0.47, 1] },
]

const correlationGradient: readonly ColorStop[] = [
  { value: -1, rgba: [0.12, 0.32, 0.64, 1] },
  { value: -0.5, rgba: [0.52, 0.7, 0.87, 1] },
  { value: 0, rgba: [0.93, 0.94, 0.96, 1] },
  { value: 0.5, rgba: [0.89, 0.61, 0.43, 1] },
  { value: 1, rgba: [0.64, 0.23, 0.16, 1] },
]

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5, useGrouping: false })
const correlationNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const observationCount = new Intl.NumberFormat('en-US')

function readNumber(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) ? number.format(value) : 'Unavailable'
}

function nativeColor(color: Color, dark: boolean): Color {
  // Native guide ink is fixed. Invert the dark canvas for contrast and compensate only data colors.
  return dark ? [1 - color[0], 1 - color[1], 1 - color[2], color[3]] : color
}

function themedStops(stops: readonly ColorStop[], dark: boolean) {
  return stops.map(({ value, rgba }) => ({ value, rgba: nativeColor(rgba, dark) }))
}

function cssColor([red, green, blue, alpha]: Color) {
  return `rgba(${Math.round(255 * red)}, ${Math.round(255 * green)}, ${Math.round(255 * blue)}, ${alpha})`
}

type NativeView = {
  ready: boolean
  error: Error | null
  layout: ChartLayout
  renderPlan: { xRange: NumericRange; xOrigin: number; yRange: NumericRange }
}

type AxisLabels = {
  xTitle?: string
  yTitle?: string
  formatX?: (value: number) => string
  formatY?: (value: number) => string
}

type SelectedMark = {
  x: number
  y: number
  xIndex: number
  yIndex?: number
  width?: number
  height?: number
}

const hiddenNativeLabels = { label: '', formatValue: () => '' }

function nearestIndex(values: ArrayLike<number>, target: number) {
  let best = 0
  for (let index = 1; index < values.length; index++) {
    if (Math.abs(values[index] - target) < Math.abs(values[best] - target)) best = index
  }
  return best
}

function matrixCellInk(cell: CorrelationPlannedCell, dark: boolean) {
  const color = cell.style.fillColor
  if (!color) return 'var(--gallery-ink, var(--foreground))'
  const [red, green, blue] = nativeColor(color, dark)
  const linear = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
  return luminance < 0.179 ? '#fff' : '#000'
}

function ScientificOverlay({ view, axes, variables, cells, dark = false, mark, onPick }: {
  view: NativeView
  axes?: AxisLabels
  variables?: readonly { label: string }[]
  cells?: readonly CorrelationPlannedCell[]
  dark?: boolean
  mark?: SelectedMark
  onPick?: (x: number, y: number) => void
}) {
  const { bounds, plotArea, xTicks, yTicks } = view.layout
  const { xRange, xOrigin, yRange } = view.renderPlan
  const { x: left, y: top, width, height } = plotArea
  const bottom = top + height
  const narrow = bounds.width < 420
  const displayedXTicks = narrow ? xTicks.filter((_, index) => index % 2 === 0 || index === xTicks.length - 1) : xTicks

  function mapPoint(x: number, y: number) {
    return mapDataPointToChartPoint({ x, y, layout: view.layout, xRange, yRange, clampToPlot: true })
  }

  function pick(event: MouseEvent<SVGRectElement>) {
    const viewport = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!viewport) return
    const point = mapPointerToChartCoordinates({
      clientX: event.clientX, clientY: event.clientY, viewport,
      layout: view.layout, xRange, yRange,
    })
    if (point.insidePlot) onPick?.(point.dataX, point.dataY)
  }

  if (view.error) return <p className="scientific-render-status" role="alert">The chart could not render.</p>
  if (!view.ready || bounds.width <= 1 || bounds.height <= 1) return null

  const position = mark && mark.x >= xRange[0] && mark.x <= xRange[1] ? mapPoint(mark.x, mark.y) : undefined
  const markWidth = mark?.width ? mark.width / (xRange[1] - xRange[0]) * width : 0
  const markHeight = mark?.height ? mark.height / (yRange[1] - yRange[0]) * height : 0
  return (
    <>
      <span hidden data-scientific-ready="" />
      <svg
        className="scientific-overlay"
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g className={variables && width < 208 ? 'scientific-axes scientific-axes--dense-matrix' : 'scientific-axes'} data-scientific-axes="">
          {axes && <>
            {displayedXTicks.map((tick, index) => (
              <text key={tick.value} x={tick.position} y={bottom + 15}
                textAnchor={index === 0 ? 'start' : index === displayedXTicks.length - 1 ? 'end' : 'middle'}>
                {(axes.formatX ?? readNumber)(tick.value + xOrigin)}
              </text>
            ))}
            {yTicks.map((tick) => (
              <text key={tick.value} x={left - 7} y={Math.max(10, tick.position + 4)} textAnchor="end">
                {(axes.formatY ?? readNumber)(tick.value)}
              </text>
            ))}
            <text className="scientific-axis-title" x={left + width / 2} y={bottom + 32} textAnchor="middle">{axes.xTitle}</text>
          </>}
          {variables?.map(({ label }, index) => {
            const center = mapPoint(index + 0.5, variables.length - index - 0.5)
            const words = label.split(' ')
            return (
              <g key={label}>
                <text x={left - 7} y={center.y + 4} textAnchor="end">{label}</text>
                <text x={center.x} y={bottom + 14} textAnchor="middle">
                  <tspan x={center.x}>{words[0]}</tspan>
                  {words.length > 1 && <tspan x={center.x} dy={12}>{words.slice(1).join(' ')}</tspan>}
                </text>
              </g>
            )
          })}
        </g>
        {cells?.map((cell) => {
          const center = mapPoint(cell.x + 0.5, cell.y + 0.5)
          return (
            <text key={`${cell.x}-${cell.y}`} className="scientific-coefficient" data-scientific-coefficient=""
              x={center.x} y={center.y} textAnchor="middle" dominantBaseline="central" fill={matrixCellInk(cell, dark)}>
              {cell.value.toFixed(2)}
            </text>
          )
        })}
        {mark && position && (
          <g className="scientific-selection" data-scientific-selection="" data-x-index={mark.xIndex} data-y-index={mark.yIndex}>
            {markWidth > 0 && markHeight > 0 ? <>
              <rect x={position.x - markWidth / 2 + 1} y={position.y - markHeight / 2 + 1}
                width={Math.max(1, markWidth - 2)} height={Math.max(1, markHeight - 2)} className="scientific-selection-cell" />
              {!cells && <circle cx={position.x} cy={position.y} r="2" />}
            </> : <>
              <line x1={position.x} x2={position.x} y1={top} y2={bottom} />
              <circle cx={position.x} cy={position.y} r="4.25" />
            </>}
          </g>
        )}
        {onPick && <rect className="scientific-pick-area" data-scientific-pick="" x={left} y={top}
          width={width} height={height} fill="transparent" onClick={pick} />}
      </svg>
    </>
  )
}

function Figure({ id, caption, compact, dark, source, chart, controls, axes }: {
  id: string
  caption: string
  compact: boolean
  dark: boolean
  source: MeasuredSource
  chart: ReactNode
  controls: ReactNode
  axes?: AxisLabels
}) {
  return (
    <figure className="scientific-preview" data-scientific-preview={id} data-compact={compact} data-dark={dark}>
      {!compact && (
        <figcaption id={caption} data-scientific-source="">
          <span className="scientific-source-line">
            <a href={source.sourceUrl}>{source.sourceLabel}</a>
            {source.license && <a href={source.license.url}>{source.license.name}</a>}
          </span>
          <span>{source.description}</span>
        </figcaption>
      )}
      <div className="scientific-graphic">
        {axes?.yTitle && <p className="scientific-y-title" aria-hidden="true">{axes.yTitle}</p>}
        <div className="scientific-plot-frame">{chart}</div>
      </div>
      {!compact && controls}
    </figure>
  )
}

function IndexControl({ label, length, index, setIndex, valueText }: {
  label: string
  length: number
  index: number
  setIndex: (index: number) => void
  valueText: string
}) {
  return (
    <label className="scientific-input">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={length - 1}
        value={index}
        aria-valuetext={valueText}
        onChange={(event) => setIndex(event.currentTarget.valueAsNumber)}
      />
    </label>
  )
}

function ColorScale({ label, min, max, colors }: {
  label: string
  min: number
  max: number
  colors: readonly ColorStop[]
}) {
  const gradient = colors.map(({ rgba }, index) => `${cssColor(rgba)} ${index * 100 / (colors.length - 1)}%`).join(', ')
  const style: CSSProperties = { backgroundImage: `linear-gradient(to right, ${gradient})` }
  return (
    <div className="scientific-scale" role="img" aria-label={`${label} from ${readNumber(min)} to ${readNumber(max)}`}>
      <span>{label}</span>
      <div className="scientific-scale-gradient">
        <span>{readNumber(min)}</span>
        <span style={style} aria-hidden="true" />
        <span>{readNumber(max)}</span>
      </div>
    </div>
  )
}

type Picker = { index: number; setIndex: (index: number) => void }
type PairPicker = { x: Picker; y: Picker }

function SpectrumReadout({ index, setIndex }: Picker) {
  const { data, config } = spectrumFixture
  const frequencies = data.frequencies
  const amplitudes = data.columns[config.series[0].field]
  const peak = config.peakMarkers?.find((marker) => marker.frequency === frequencies[index])
  const frequency = `${readNumber(frequencies[index])} cycles/year`

  return (
    <div className="scientific-readout">
      <output>{peak?.label && `${peak.label} · `}{frequency} · {readNumber(amplitudes[index])} ppm amplitude</output>
      <IndexControl label="Frequency bin" length={frequencies.length} index={index} setIndex={setIndex} valueText={frequency} />
    </div>
  )
}

function SpectrogramReadout({ x: { index: time, setIndex: setTime }, y: { index: frequency, setIndex: setFrequency } }: PairPicker) {
  const { data, config } = spectrogramFixture
  const valueIndex = data.valueLayout === 'time-major'
    ? time * data.frequencyBins.length + frequency
    : frequency * data.timeBins.length + time
  const center = readNumber(data.timeBins[time])
  const frequencyText = `${readNumber(data.frequencyBins[frequency])} cycles/year`
  const [min, max] = config.zAxis?.range ?? [0, Math.max(0, ...data.values)]

  return (
    <div className="scientific-readout">
      <output>{center} · {frequencyText} · {readNumber(data.values[valueIndex])} ppm amplitude</output>
      <IndexControl label="Window center year" length={data.timeBins.length} index={time} setIndex={setTime} valueText={center} />
      <IndexControl label="Frequency bin" length={data.frequencyBins.length} index={frequency} setIndex={setFrequency} valueText={frequencyText} />
      <ColorScale label="Amplitude (ppm)" min={min} max={max} colors={spectrumGradient} />
    </div>
  )
}

function CorrelationReadout({ data, x: { index: column, setIndex: setColumn }, y: { index: row, setIndex: setRow } }: PairPicker & {
  data: CorrelationMatrixData
}) {
  const variableCount = data.variables.length
  const index = data.valueLayout === 'column-major' ? column * variableCount + row : row * variableCount + column
  const value = data.values[index]
  const sampleCount = data.sampleCounts?.[index]
  const options = data.variables.map((variable, variableIndex) => (
    <option key={variable.key} value={variableIndex}>{variable.label}</option>
  ))

  return (
    <div className="scientific-readout">
      <output>Pearson r = {Number.isFinite(value) ? correlationNumber.format(value) : 'Unavailable'}{sampleCount !== undefined ? ` · ${observationCount.format(sampleCount)} paired observations` : ''}</output>
      <label className="scientific-input">
        <span>Row variable</span>
        <select value={row} onChange={(event) => setRow(Number(event.currentTarget.value))}>{options}</select>
      </label>
      <label className="scientific-input">
        <span>Column variable</span>
        <select value={column} onChange={(event) => setColumn(Number(event.currentTarget.value))}>{options}</select>
      </label>
      <ColorScale label="Pearson r" min={-1} max={1} colors={correlationGradient} />
    </div>
  )
}

function ProcessReadout({ index, setIndex }: Picker) {
  const { data, config } = processControlFixture
  const observation = data.timestamps[index]
  const track = config.spcTracks?.[0]
  const marked = track?.markers?.some((marker) => marker.x === observation)
  const flaggedObservations = track?.markers?.map((marker) => readNumber(marker.x)).join(', ')
  const label = `Observation ${readNumber(observation)}`

  return (
    <div className="scientific-readout">
      <output>{label} · Calibration factor {readNumber(data.columns[config.series[0].field][index])}{marked ? ' · Beyond the control limit' : ''}</output>
      <IndexControl label="Observation" length={data.timestamps.length} index={index} setIndex={setIndex} valueText={label} />
      {track && (
        <p className="scientific-limits">Lower control limit {readNumber(track.lowerControlLimit)} · Mean {readNumber(track.centerLine)} · Upper control limit {readNumber(track.upperControlLimit)}</p>
      )}
      {flaggedObservations && <p className="scientific-limits">Outside control limits · {flaggedObservations}</p>}
    </div>
  )
}

function CapabilityReadout({ index, setIndex }: Picker) {
  const { data, config } = capabilityFixture
  const counts = data.columns[config.series[0].field]
  const interval = `[${readNumber(data.binStarts[index])}, ${readNumber(data.binEnds[index])})`
  const count = counts[index]

  return (
    <div className="scientific-readout">
      <output>{interval} · {count} {count === 1 ? 'observation' : 'observations'}</output>
      <IndexControl label="Histogram bin" length={data.binStarts.length} index={index} setIndex={setIndex} valueText={interval} />
      {config.markers && (
        <p className="scientific-limits">
          {config.markers.map((marker) => `${marker.label} ${marker.value.toFixed(2)}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

const spectrumMaximum = Math.max(...spectrumFixture.data.columns[spectrumFixture.config.series[0].field])
const capabilityCounts = capabilityFixture.data.columns[capabilityFixture.config.series[0].field]
const capabilityBinCenters = capabilityFixture.data.binStarts.map(
  (start, index) => (start + capabilityFixture.data.binEnds[index]) / 2,
)
const defaultSelections: Record<string, readonly [number, number]> = {
  'spectrum-measured': [nearestIndex(spectrumFixture.data.frequencies, 1), 0],
  'spectrogram-measured': [0, nearestIndex(spectrogramFixture.data.frequencyBins, 1)],
  'correlation-matrix-measured': [1, 0],
  'correlation-matrix-steel': [1, 0],
  'process-control-individuals': [0, 0],
  'process-control-capability': [capabilityCounts.indexOf(Math.max(...capabilityCounts)), 0],
}

function axisLabels(config: {
  xAxis?: { label?: string; formatValue?: (value: number) => string }
  yAxis?: { label?: string; formatValue?: (value: number) => string }
}): AxisLabels {
  return {
    xTitle: config.xAxis?.label,
    yTitle: config.yAxis?.label,
    formatX: config.xAxis?.formatValue,
    formatY: config.yAxis?.formatValue,
  }
}

function chartConfigs(dark: boolean) {
  const ink = nativeColor(dark ? [0.48, 0.7, 0.97, 1] : [0.11, 0.4, 0.76, 1], dark)
  const limitInk = nativeColor(dark ? [0.98, 0.52, 0.52, 1] : [0.68, 0.16, 0.16, 1], dark)
  const targetInk = nativeColor(dark ? [0.54, 0.76, 0.52, 1] : [0.14, 0.49, 0.27, 1], dark)
  const spectrum = spectrumFixture.config
  const spectrogram = spectrogramFixture.config
  const process = processControlFixture.config
  const capability = capabilityFixture.config

  return {
    spectrum: {
      ...spectrum,
      xAxis: { ...spectrum.xAxis, ...hiddenNativeLabels },
      yAxis: { ...spectrum.yAxis, ...hiddenNativeLabels, range: [0, Math.ceil(2.2 * spectrumMaximum) / 2] as const },
      series: spectrum.series.map((item) => ({ ...item, rgba: ink })),
      peakMarkers: spectrum.peakMarkers?.map((item) => ({ ...item, rgba: limitInk, labelVisible: false })),
    },
    spectrogram: {
      ...spectrogram,
      xAxis: { ...spectrogram.xAxis, ...hiddenNativeLabels },
      yAxis: { ...spectrogram.yAxis, ...hiddenNativeLabels },
      colorStops: themedStops(spectrumGradient, dark),
    },
    correlation: {
      ...correlationFixture.config,
      labels: { visible: false },
      colorStops: themedStops(correlationGradient, dark),
    },
    process: {
      ...process,
      xAxis: { ...process.xAxis, ...hiddenNativeLabels },
      yAxis: { ...process.yAxis, ...hiddenNativeLabels },
      series: process.series.map((item) => ({ ...item, rgba: ink })),
      spcTracks: process.spcTracks?.map((track) => ({
        ...track,
        controlLineRgba: limitInk,
        markerRgba: limitInk,
        zoneFillRgba: [ink[0], ink[1], ink[2], 0.06] as const,
        markers: track.markers?.map((marker) => ({ ...marker, labelVisible: false })),
      })),
    },
    capability: {
      ...capability,
      xAxis: { ...capability.xAxis, ...hiddenNativeLabels },
      yAxis: { ...capability.yAxis, ...hiddenNativeLabels, range: [0, Math.ceil(1.1 * Math.max(...capabilityCounts) / 4) * 4] as const },
      series: capability.series.map((item) => ({
        ...item, rgba: ink, fillRgba: [ink[0], ink[1], ink[2], 0.85] as const, lineRgba: [0, 0, 0, 0] as const,
      })),
      markers: capability.markers?.map((item) => ({
        ...item, rgba: item.kind === 'target' ? targetInk : limitInk, labelVisible: false,
      })),
    },
  }
}

export default function ScientificPreview({ example, compact = false, data }: ChartPreviewProps) {
  const caption = useId()
  const theme = useChartTheme()
  const channels = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(theme.surface)
  const dark = channels !== null && (Number(channels[1]) + Number(channels[2]) + Number(channels[3])) / 3 < 128
  const configs = useMemo(() => chartConfigs(dark), [dark])
  const [[x, y], setSelection] = useState<readonly [number, number]>(() => defaultSelections[example.id] ?? [0, 0])
  const xPicker = { index: x, setIndex: (nextX: number) => setSelection(([, currentY]) => [nextX, currentY]) }
  const yPicker = { index: y, setIndex: (nextY: number) => setSelection(([currentX]) => [currentX, nextY]) }

  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use the native typed inputs in the chart documentation to plot your own data.</p>
  }

  const props = {
    ariaLabel: example.title,
    ...(compact ? {} : { ariaDescribedBy: caption }),
    className: 'scientific-plot',
    renderer: 'canvas2d' as const,
  }
  const figure = { id: example.id, caption, compact, dark }
  function overlay(view: NativeView, axes: AxisLabels, mark: SelectedMark, onPick: (x: number, y: number) => void) {
    return <ScientificOverlay view={view} axes={axes} mark={compact ? undefined : mark} onPick={compact ? undefined : onPick} />
  }

  switch (example.id) {
    case 'spectrum-measured': {
      const { data, config } = spectrumFixture
      const axes = axisLabels(config)
      const mark = { x: data.frequencies[x], y: data.columns[config.series[0].field][x], xIndex: x }
      const chart = <Spectrum {...props} data={data} config={configs.spectrum}>
        {(view) => overlay(view, axes, mark, (frequency) => xPicker.setIndex(nearestIndex(data.frequencies, frequency)))}
      </Spectrum>
      return <Figure {...figure} source={spectrumFixture} chart={chart} axes={axes} controls={<SpectrumReadout {...xPicker} />} />
    }
    case 'spectrogram-measured': {
      const { data, config } = spectrogramFixture
      const axes = axisLabels(config)
      const mark = { x: data.timeBins[x], y: data.frequencyBins[y], width: data.timeBinWidth, height: data.frequencyBinWidth, xIndex: x, yIndex: y }
      const chart = <Spectrogram {...props} data={data} config={configs.spectrogram}>
        {(view) => overlay(view, axes, mark, (year, frequency) => setSelection([nearestIndex(data.timeBins, year), nearestIndex(data.frequencyBins, frequency)]))}
      </Spectrogram>
      return <Figure {...figure} source={spectrogramFixture} chart={chart} axes={axes} controls={<SpectrogramReadout x={xPicker} y={yPicker} />} />
    }
    case 'correlation-matrix-measured':
    case 'correlation-matrix-steel': {
      const fixture = example.id === 'correlation-matrix-steel' ? steelCorrelationFixture : correlationFixture
      const { data } = fixture
      const count = data.variables.length
      const mark = { x: x + 0.5, y: count - y - 0.5, width: 1, height: 1, xIndex: x, yIndex: y }
      const pickCell = (column: number, row: number) =>
        setSelection([Math.min(count - 1, Math.floor(column)), Math.min(count - 1, count - Math.ceil(row))])
      const chart = <CorrelationMatrix {...props} data={data} config={configs.correlation}>
        {(view) => <ScientificOverlay view={view} variables={data.variables} dark={dark}
          mark={compact ? undefined : mark} cells={compact ? undefined : view.renderPlan.cells}
          onPick={compact ? undefined : pickCell} />}
      </CorrelationMatrix>
      return <Figure {...figure} source={fixture} chart={chart} controls={<CorrelationReadout data={data} x={xPicker} y={yPicker} />} />
    }
    case 'process-control-individuals': {
      const { data, config } = processControlFixture
      const axes = axisLabels(config)
      const mark = { x: data.timestamps[x], y: data.columns[config.series[0].field][x], xIndex: x }
      const chart = <TimeSeries {...props} data={data} config={configs.process}>
        {(view) => overlay(view, axes, mark, (sample) => xPicker.setIndex(nearestIndex(data.timestamps, sample)))}
      </TimeSeries>
      return <Figure {...figure} source={processControlFixture} chart={chart} axes={axes} controls={<ProcessReadout {...xPicker} />} />
    }
    case 'process-control-capability': {
      const { data, config } = capabilityFixture
      const axes = { ...axisLabels(config), yTitle: 'Observations' }
      const mark = { x: capabilityBinCenters[x], y: capabilityCounts[x], xIndex: x }
      const chart = <Distribution {...props} data={data} config={configs.capability}>
        {(view) => overlay(view, axes, mark, (factor) => xPicker.setIndex(nearestIndex(capabilityBinCenters, factor)))}
      </Distribution>
      return <Figure {...figure} source={capabilityFixture} chart={chart} axes={axes} controls={<CapabilityReadout {...xPicker} />} />
    }
    default:
      return <p className="chart-render-message" role="status">Scientific example unavailable.</p>
  }
}
