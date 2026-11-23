import {
  CorrelationMatrix,
  Distribution,
  Spectrogram,
  Spectrum,
  TimeSeries,
} from '@pitant/charts-react'
import { useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ChartPreviewProps } from '../../types'
import { useChartTheme } from '../theme'
import {
  capabilityFixture,
  correlationFixture,
  processControlFixture,
  spectrogramFixture,
  spectrumFixture,
} from './data'
import './scientific.css'

type Color = readonly [red: number, green: number, blue: number, alpha: number]
type ColorStop = { value: number; rgba: Color }
type MeasuredSource = { sourceLabel: string; sourceUrl: string; description: string }

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

function NativeState({ ready, error }: { ready: boolean; error: Error | null }) {
  if (error) return <p className="scientific-render-status" role="alert">The chart could not render.</p>
  return <span hidden data-scientific-ready={ready ? '' : undefined} />
}

function Figure({ id, caption, compact, dark, source, chart, controls }: {
  id: string
  caption: string
  compact: boolean
  dark: boolean
  source: MeasuredSource
  chart: ReactNode
  controls: ReactNode
}) {
  return (
    <figure className="scientific-preview" data-scientific-preview={id} data-compact={compact} data-dark={dark}>
      {chart}
      {!compact && (
        <>
          {controls}
          <figcaption id={caption}>
            {source.description} <a href={source.sourceUrl}>{source.sourceLabel}</a>
          </figcaption>
        </>
      )}
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

function SpectrumReadout() {
  const { data, config } = spectrumFixture
  const frequencies = data.frequencies
  const amplitudes = data.columns[config.series[0].field]
  const peak = config.peakMarkers?.[0]?.frequency
  const [index, setIndex] = useState(() => peak === undefined ? 0 : Math.max(0, frequencies.indexOf(peak)))
  const frequency = `${readNumber(frequencies[index])} cycles/year`

  return (
    <div className="scientific-readout">
      <IndexControl label="Frequency bin" length={frequencies.length} index={index} setIndex={setIndex} valueText={frequency} />
      <output>{frequency} · {readNumber(amplitudes[index])} ppm amplitude</output>
    </div>
  )
}

function SpectrogramReadout() {
  const { data, config } = spectrogramFixture
  const [time, setTime] = useState(0)
  const [frequency, setFrequency] = useState(() => Math.max(0, data.frequencyBins.indexOf(1)))
  const valueIndex = data.valueLayout === 'time-major'
    ? time * data.frequencyBins.length + frequency
    : frequency * data.timeBins.length + time
  const center = readNumber(data.timeBins[time])
  const frequencyText = `${readNumber(data.frequencyBins[frequency])} cycles/year`
  const [min, max] = config.zAxis?.range ?? [0, Math.max(0, ...data.values)]

  return (
    <div className="scientific-readout">
      <IndexControl label="Window center year" length={data.timeBins.length} index={time} setIndex={setTime} valueText={center} />
      <IndexControl label="Frequency bin" length={data.frequencyBins.length} index={frequency} setIndex={setFrequency} valueText={frequencyText} />
      <output>{center} · {frequencyText} · {readNumber(data.values[valueIndex])} ppm amplitude</output>
      <ColorScale label="Amplitude (ppm)" min={min} max={max} colors={spectrumGradient} />
    </div>
  )
}

function CorrelationReadout() {
  const { data } = correlationFixture
  const [row, setRow] = useState(0)
  const [column, setColumn] = useState(1)
  const variableCount = data.variables.length
  const index = data.valueLayout === 'column-major' ? column * variableCount + row : row * variableCount + column
  const value = data.values[index]
  const sampleCount = data.sampleCounts?.[index]
  const options = data.variables.map((variable, variableIndex) => (
    <option key={variable.key} value={variableIndex}>{variable.label}</option>
  ))

  return (
    <div className="scientific-readout">
      <label className="scientific-input">
        <span>Row variable</span>
        <select value={row} onChange={(event) => setRow(Number(event.currentTarget.value))}>{options}</select>
      </label>
      <label className="scientific-input">
        <span>Column variable</span>
        <select value={column} onChange={(event) => setColumn(Number(event.currentTarget.value))}>{options}</select>
      </label>
      <output>Pearson r = {Number.isFinite(value) ? correlationNumber.format(value) : 'Unavailable'}{sampleCount !== undefined ? ` · ${sampleCount} paired observations` : ''}</output>
      <ColorScale label="Pearson r" min={-1} max={1} colors={correlationGradient} />
    </div>
  )
}

function ProcessReadout() {
  const { data, config } = processControlFixture
  const [index, setIndex] = useState(0)
  const observation = data.timestamps[index]
  const track = config.spcTracks?.[0]
  const marked = track?.markers?.some((marker) => marker.x === observation)
  const flaggedObservations = track?.markers?.map((marker) => readNumber(marker.x)).join(', ')
  const label = `Observation ${readNumber(observation)}`

  return (
    <div className="scientific-readout">
      <IndexControl label="Observation" length={data.timestamps.length} index={index} setIndex={setIndex} valueText={label} />
      <output>{label} · Calibration factor {readNumber(data.columns[config.series[0].field][index])}{marked ? ' · Beyond the control limit' : ''}</output>
      {track && (
        <p className="scientific-limits">Lower control limit {readNumber(track.lowerControlLimit)} · Mean {readNumber(track.centerLine)} · Upper control limit {readNumber(track.upperControlLimit)}</p>
      )}
      {flaggedObservations && <p className="scientific-limits">Outside control limits · {flaggedObservations}</p>}
    </div>
  )
}

function CapabilityReadout() {
  const { data, config } = capabilityFixture
  const counts = data.columns[config.series[0].field]
  const [index, setIndex] = useState(() => counts.indexOf(Math.max(...counts)))
  const interval = `[${readNumber(data.binStarts[index])}, ${readNumber(data.binEnds[index])})`
  const count = counts[index]

  return (
    <div className="scientific-readout">
      <IndexControl label="Histogram bin" length={data.binStarts.length} index={index} setIndex={setIndex} valueText={interval} />
      <output>{interval} · {count} {count === 1 ? 'observation' : 'observations'}</output>
      {config.markers && (
        <p className="scientific-limits">
          {config.markers.map((marker) => `${marker.label} ${marker.value.toFixed(2)}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

export default function ScientificPreview({ example, compact = false, data }: ChartPreviewProps) {
  const caption = useId()
  const theme = useChartTheme()
  const channels = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(theme.surface)
  const dark = channels !== null && (Number(channels[1]) + Number(channels[2]) + Number(channels[3])) / 3 < 128

  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use the native typed inputs in the chart documentation to plot your own data.</p>
  }

  const props = {
    ariaLabel: example.title,
    ...(compact ? {} : { ariaDescribedBy: caption }),
    className: 'scientific-plot',
    renderer: 'canvas2d' as const,
    children: NativeState,
  }
  const figure = { id: example.id, caption, compact, dark }
  const ink = nativeColor(dark ? [0.48, 0.7, 0.97, 1] : [0.11, 0.4, 0.76, 1], dark)
  const limitInk = nativeColor(dark ? [0.98, 0.52, 0.52, 1] : [0.68, 0.16, 0.16, 1], dark)

  switch (example.id) {
    case 'spectrum-measured': {
      const { data, config } = spectrumFixture
      const series = config.series.map((item) => ({ ...item, rgba: ink }))
      const peakMarkers = config.peakMarkers?.map((item) => ({ ...item, rgba: limitInk, labelVisible: !compact }))
      const chart = <Spectrum {...props} data={data} config={{ ...config, series, peakMarkers }} />
      return <Figure {...figure} source={spectrumFixture} chart={chart} controls={<SpectrumReadout />} />
    }
    case 'spectrogram-measured': {
      const { data, config } = spectrogramFixture
      const colorStops = themedStops(spectrumGradient, dark)
      const chart = <Spectrogram {...props} data={data} config={{ ...config, colorStops }} />
      return <Figure {...figure} source={spectrogramFixture} chart={chart} controls={<SpectrogramReadout />} />
    }
    case 'correlation-matrix-measured': {
      const { data, config } = correlationFixture
      const colorStops = themedStops(correlationGradient, dark)
      const chart = <CorrelationMatrix {...props} data={data} config={{ ...config, colorStops, labels: { visible: !compact } }} />
      return <Figure {...figure} source={correlationFixture} chart={chart} controls={<CorrelationReadout />} />
    }
    case 'process-control-individuals': {
      const { data, config } = processControlFixture
      const series = config.series.map((item) => ({ ...item, rgba: ink }))
      const spcTracks = config.spcTracks?.map((track) => ({
        ...track,
        controlLineRgba: limitInk,
        markerRgba: limitInk,
        zoneFillRgba: [ink[0], ink[1], ink[2], 0.08] as const,
        markers: track.markers?.map((marker) => ({ ...marker, labelVisible: false })),
      }))
      const chart = <TimeSeries {...props} data={data} config={{ ...config, series, spcTracks }} />
      return <Figure {...figure} source={processControlFixture} chart={chart} controls={<ProcessReadout />} />
    }
    case 'process-control-capability': {
      const { data, config } = capabilityFixture
      const series = config.series.map((item) => ({
        ...item,
        rgba: ink,
        fillRgba: [ink[0], ink[1], ink[2], 0.85] as const,
        lineRgba: [0, 0, 0, 0] as const,
      }))
      const targetInk = nativeColor(dark ? [0.54, 0.76, 0.52, 1] : [0.14, 0.49, 0.27, 1], dark)
      const markers = config.markers?.map((item) => ({
        ...item,
        rgba: item.kind === 'target' ? targetInk : limitInk,
        labelVisible: false,
      }))
      const topCount = Math.ceil(Math.max(...data.columns.count) * 1.1 / 4) * 4
      const yAxis = { ...config.yAxis, label: 'Count', range: [0, topCount] as const }
      const chart = <Distribution {...props} data={data} config={{ ...config, series, markers, yAxis }} />
      return <Figure {...figure} source={capabilityFixture} chart={chart} controls={<CapabilityReadout />} />
    }
    default:
      return <p className="chart-render-message" role="status">Scientific example unavailable.</p>
  }
}
