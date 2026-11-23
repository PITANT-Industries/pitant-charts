import { useId, useState } from 'react'
import type { MouseEvent } from 'react'
import type { ChartPreviewProps } from '../../types'
import { usePlotSize } from '../usePlotSize'
import { spectrogramFixture } from './data'
import './mauna-loa-spectrogram.css'

const { data, sourceLabel, sourceUrl } = spectrogramFixture
const { timeBins, frequencyBins, values } = data
const maximum = Math.ceil(Math.max(...values) * 10) / 10
const contrastFloor = 0.02
const palette = [
  [19, 12, 39],
  [60, 29, 86],
  [133, 48, 100],
  [205, 68, 88],
  [248, 123, 69],
  [255, 184, 93],
  [255, 239, 169],
] as const
const scaleValues = [0, 0.05, 0.2, 1, maximum]
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3, useGrouping: false })
const cycles = [
  { frequency: 1, label: 'Annual cycle', plotLabel: 'Annual' },
  { frequency: 2, label: 'Six-month cycle', plotLabel: 'Six-month' },
  { frequency: 3, label: 'Four-month cycle', plotLabel: 'Four-month' },
].map((cycle) => ({ ...cycle, index: frequencyBins.indexOf(cycle.frequency) }))

function contrast(amplitude: number) {
  return Math.log1p(amplitude / contrastFloor) / Math.log1p(maximum / contrastFloor)
}

function tileColor(amplitude: number) {
  const position = contrast(amplitude) * (palette.length - 1)
  const index = Math.min(palette.length - 2, Math.floor(position))
  const fraction = position - index
  const channels = palette[index].map((channel, i) =>
    Math.round(channel + (palette[index + 1][i] - channel) * fraction))
  return `rgb(${channels.join(' ')})`
}

function amplitudeAt(time: number, frequency: number) {
  return values[time * frequencyBins.length + frequency]
}

const tileColors = Array.from(values, tileColor)
const gradient = `linear-gradient(to right, ${palette.map((color) => `rgb(${color.join(' ')})`).join(', ')})`

function AmplitudeTrace({ frequency, time, width, left, right }: {
  frequency: number
  time: number
  width: number
  left: number
  right: number
}) {
  const readings = Array.from(timeBins, (_, index) => amplitudeAt(index, frequency))
  const minimum = Math.min(...readings)
  const maximum = Math.max(...readings)
  const plotBottom = 60
  const plotTop = 9
  const x = (index: number) => left + (right - left) * (index + .5) / readings.length
  const y = (amplitude: number) => maximum === minimum ? (plotTop + plotBottom) / 2
    : plotBottom - (plotBottom - plotTop) * (amplitude - minimum) / (maximum - minimum)
  const path = readings.map((amplitude, index) => `${index ? 'L' : 'M'}${x(index)} ${y(amplitude)}`).join(' ')
  const frequencyLabel = number.format(frequencyBins[frequency])
  return (
    <div className="mauna-loa-trace" data-mauna-loa-trace="" data-frequency={frequencyBins[frequency]}>
      <div className="mauna-loa-trace-label">
        <strong>{frequencyLabel} {frequencyBins[frequency] === 1 ? 'cycle' : 'cycles'}/year over time</strong>
        <span>{number.format(minimum)}–{number.format(maximum)} ppm</span>
      </div>
      <svg viewBox={`0 0 ${width} 68`} role="img" aria-label={`Amplitude from ${number.format(minimum)} to ${number.format(maximum)} ppm in windows centered on ${timeBins[0]}–${timeBins[timeBins.length - 1]}`}>
        <line className="mauna-loa-trace-marker" x1={x(time)} x2={x(time)} y1={0} y2={68} />
        <path className="mauna-loa-trace-line" fill="none" d={path} />
        <circle className="mauna-loa-trace-marker" cx={x(time)} cy={y(readings[time])} r={3.5} />
      </svg>
    </div>
  )
}

function SpectrogramFigure({ compact, label }: { compact: boolean; label: string }) {
  const caption = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 320 : 700, compact ? 185 : 325)
  const [time, setTime] = useState(0)
  const [frequency, setFrequency] = useState(cycles[0].index)
  const narrow = width < 410
  const left = narrow ? 30 : 43
  const right = Math.max(left + 1, width - (narrow ? 71 : 84))
  const top = 30
  const bottom = Math.max(top + 1, height - 35)
  const tileWidth = (right - left) / timeBins.length
  const tileHeight = (bottom - top) / frequencyBins.length
  const x = (index: number) => left + tileWidth * index
  const y = (index: number) => bottom - tileHeight * (index + 1)
  const tickCount = narrow ? 3 : 5
  const timeTicks = Array.from({ length: tickCount }, (_, index) =>
    Math.round(index * (timeBins.length - 1) / (tickCount - 1)))
  const frequencyTicks = [0.25, 1, 2, 3, 4]
  const currentCycle = cycles.find((cycle) => cycle.index === frequency)
  const frequencyValue = frequencyBins[frequency]
  const frequencyLabel = `${number.format(frequencyValue)} ${frequencyValue === 1 ? 'cycle' : 'cycles'}/year`
  const amplitude = amplitudeAt(time, frequency)

  function selectTile(event: MouseEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    setTime(Math.min(timeBins.length - 1, Math.max(0,
      Math.floor(timeBins.length * (event.clientX - rect.left) / rect.width))))
    setFrequency(Math.min(frequencyBins.length - 1, Math.max(0,
      Math.ceil(frequencyBins.length * (rect.bottom - event.clientY) / rect.height) - 1)))
  }

  return (
    <figure className="mauna-loa-spectrogram" data-compact={compact} data-scientific-ready="">
      {!compact && (
        <figcaption className="mauna-loa-caption" id={caption}>
          <strong>NOAA Mauna Loa monthly CO₂</strong>
          <p>480 monthly averages from 1980–2019. Each column shows a detrended eight-year window. <a href={sourceUrl}>{sourceLabel}</a></p>
        </figcaption>
      )}
      <div className="mauna-loa-plot" ref={plot}>
        <svg viewBox={`0 0 ${width} ${height}`} data-mauna-loa-heatmap=""
          role="img" aria-label={label} aria-describedby={compact ? undefined : caption}>
          <g shapeRendering="crispEdges">
            {tileColors.map((color, index) => (
              <rect key={index} x={x(Math.floor(index / frequencyBins.length))} y={y(index % frequencyBins.length)}
                width={tileWidth} height={tileHeight} fill={color} />
            ))}
          </g>
          <g data-scientific-axes="">
            <text className="mauna-loa-axis-title" x={left} y={20}>Frequency (cycles/year)</text>
            {frequencyTicks.map((value) => (
              <text className="mauna-loa-axis" key={value}
                x={left - 6} y={y(frequencyBins.indexOf(value)) + tileHeight / 2 + 4} textAnchor="end">{value}</text>
            ))}
            {timeTicks.map((index) => (
              <text className="mauna-loa-axis" key={index} x={x(index + .5)} y={bottom + 14}
                textAnchor={index === 0 ? 'start' : index === timeBins.length - 1 ? 'end' : 'middle'}>{timeBins[index]}</text>
            ))}
            <text className="mauna-loa-axis-title" x={(left + right) / 2} y={height - 6} textAnchor="middle">
              Window center year
            </text>
            {cycles.map((cycle) => {
              const center = y(cycle.index) + tileHeight / 2
              return <g key={cycle.index}>
                <rect className="mauna-loa-band-bg" x={right + 4} y={center - 8} width={narrow ? 55 : 70} height={16} rx={3} />
                <text className="mauna-loa-band-label" x={right + 8} y={center + 3.5}>{cycle.plotLabel}</text>
              </g>
            })}
          </g>
          {!compact && (
            <>
              <g className="mauna-loa-selection" data-scientific-selection="" data-x-index={time} data-y-index={frequency}>
                <line x1={x(time + .5)} x2={x(time + .5)} y1={top} y2={bottom} />
                <rect x={x(time)} y={y(frequency)} width={tileWidth} height={tileHeight} fill="none" />
              </g>
              <rect className="mauna-loa-pick" data-scientific-pick="" x={left} y={top}
                width={right - left} height={bottom - top} fill="transparent" onClick={selectTile} />
            </>
          )}
        </svg>
      </div>
      {!compact && (
        <>
          <div className="mauna-loa-scale" role="img" aria-label={`Amplitude, 0 to ${maximum} ppm, shown with logarithmic color spacing`}>
            <span>Amplitude (ppm) · log contrast</span>
            <div className="mauna-loa-scale-bar" style={{ background: gradient }} />
            <div className="mauna-loa-scale-ticks">
              {scaleValues.map((value) => <span key={value} style={{ left: `${100 * contrast(value)}%` }}>{value}</span>)}
            </div>
          </div>
          <div className="mauna-loa-inspector">
            <div className="mauna-loa-inspector-header">
              <output data-year={timeBins[time]} data-frequency={frequencyValue} data-amplitude={amplitude}>
                <strong>{number.format(amplitude)} ppm</strong>
                <span>{timeBins[time]} · {currentCycle?.label ?? frequencyLabel}</span>
              </output>
              <div className="mauna-loa-shortcuts" role="group" aria-label="Seasonal cycles">
                {cycles.map((cycle) => <button key={cycle.index} type="button" aria-pressed={cycle.index === frequency}
                  onClick={() => setFrequency(cycle.index)}>{cycle.label}</button>)}
              </div>
            </div>
            <AmplitudeTrace frequency={frequency} time={time} width={width} left={left} right={right} />
            <div className="mauna-loa-controls">
              <label>
                <span>Window center year</span>
                <input type="range" min={0} max={timeBins.length - 1} value={time}
                  aria-valuetext={String(timeBins[time])} onChange={(event) => setTime(event.currentTarget.valueAsNumber)} />
              </label>
              <label>
                <span>Frequency bin</span>
                <input type="range" min={0} max={frequencyBins.length - 1} value={frequency}
                  aria-valuetext={frequencyLabel} onChange={(event) => setFrequency(event.currentTarget.valueAsNumber)} />
              </label>
            </div>
          </div>
        </>
      )}
    </figure>
  )
}

export default function MaunaLoaSpectrogram({ example, compact = false, data }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use the typed Spectrogram inputs in the chart guide to plot your own measurements.</p>
  }
  return <SpectrogramFigure compact={compact} label={example.title} />
}
