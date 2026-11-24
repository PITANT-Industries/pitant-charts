import { useEffect, useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import '../scientific-figure.css'
import './wavelet-scalogram.css'

export interface WaveletSignal {
  startSeconds: number
  sampleRateHz: number
  unit: string
  samples: readonly number[] | Float64Array
}

export interface WaveletScalogramData {
  timeSeconds: readonly number[]
  frequencyHz: readonly number[]
  powerDb: readonly (readonly number[])[]
  coiEdgeSeconds?: readonly number[]
  waveform: WaveletSignal
}

export interface WaveletScalogramProps {
  data: WaveletScalogramData
  label?: string
  compact?: boolean
  powerDomainDb?: readonly [number, number]
  initialTimeSeconds?: number
  initialFrequencyHz?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Range = readonly [number, number]
type PlotDomains = { time: Range; logFrequency: Range; power: Range; signal: Range }

const palette = [
  [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [183, 55, 121],
  [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191],
] as const
const windowOptions = [
  { seconds: 0.001, label: '1 ms' },
  { seconds: 0.01, label: '10 ms' },
  { seconds: 0.05, label: '50 ms' },
  { seconds: 0.25, label: '250 ms' },
  { seconds: 1, label: '1 s' },
]
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const detailedTimeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })
const sampleFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const powerFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function blend(low: number, high: number, weight: number) {
  return low + (high - low) * weight
}

function increasing(values: readonly number[]) {
  return values.length >= 2 && values.every((value, index) =>
    Number.isFinite(value) && (index === 0 || value > values[index - 1]))
}

function signalEnd(signal: WaveletSignal) {
  return signal.startSeconds + (signal.samples.length - 1) / signal.sampleRateHz
}

function domainsFor(data: WaveletScalogramData, powerDomainDb?: Range): PlotDomains | null {
  const { timeSeconds, frequencyHz, powerDb, coiEdgeSeconds, waveform } = data
  if (!increasing(timeSeconds) || !increasing(frequencyHz) || frequencyHz[0] <= 0) return null
  if (powerDb.length !== frequencyHz.length ||
      powerDb.some((row) => row.length !== timeSeconds.length || row.some((value) => !Number.isFinite(value)))) return null
  if (coiEdgeSeconds && (coiEdgeSeconds.length !== frequencyHz.length ||
      coiEdgeSeconds.some((value) => !Number.isFinite(value) || value < 0))) return null
  if (!Number.isFinite(waveform.startSeconds) || !Number.isFinite(waveform.sampleRateHz) ||
      waveform.sampleRateHz <= 0 || waveform.samples.length < 2) return null
  const end = signalEnd(waveform)
  const time: Range = [timeSeconds[0], timeSeconds[timeSeconds.length - 1]]
  if (!Number.isFinite(end) || end <= waveform.startSeconds || time[0] < waveform.startSeconds || time[1] > end) return null
  const logFrequency: Range = [Math.log(frequencyHz[0]), Math.log(frequencyHz[frequencyHz.length - 1])]
  if (logFrequency[1] <= logFrequency[0]) return null

  let peak = 0
  for (const sample of waveform.samples) {
    if (!Number.isFinite(sample)) return null
    peak = Math.max(peak, Math.abs(sample))
  }
  let powerMin = Infinity
  let powerMax = -Infinity
  for (const row of powerDb) {
    for (const value of row) {
      powerMin = Math.min(powerMin, value)
      powerMax = Math.max(powerMax, value)
    }
  }
  const [minDb, maxDb] = powerDomainDb ?? [Math.min(powerMin, powerMax - 1), powerMax]
  if (!Number.isFinite(maxDb - minDb) || maxDb <= minDb) return null
  return { time, logFrequency, power: [minDb, maxDb], signal: [-Math.max(1, peak), Math.max(1, peak)] }
}

function precedingIndex(values: readonly number[], value: number) {
  let low = 0
  let high = values.length - 1
  while (high - low > 1) {
    const middle = (low + high) >>> 1
    if (value < values[middle]) high = middle
    else low = middle
  }
  return low
}

function nearestIndex(values: readonly number[], value: number) {
  const left = precedingIndex(values, value)
  return Math.abs(values[left] - value) <= Math.abs(values[left + 1] - value) ? left : left + 1
}

function axisTicks([low, high]: Range, count: number) {
  const interval = (high - low) / count
  const base = 10 ** Math.floor(Math.log10(interval))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => multiple * base >= interval) ?? 10)
  if (!Number.isFinite(step) || !(step > 0)) return [low, high]
  const first = Math.ceil(low / step)
  const last = Math.floor(high / step)
  const size = Math.min(10, last - first + 1)
  return size > 1 ? Array.from({ length: size }, (_, index) => (first + index) * step) : [low, high]
}

function frequencyTicks([low, high]: Range) {
  const ticks: number[] = []
  const firstPower = Math.floor(low / Math.LN10)
  const lastPower = Math.ceil(high / Math.LN10)
  const step = Math.max(1, Math.ceil((lastPower - firstPower) / 6))
  for (let power = firstPower; power <= lastPower; power += step) {
    for (const multiple of (step === 1 ? [1, 2, 5] : [1])) {
      const log = power * Math.LN10 + Math.log(multiple)
      if (log >= low && log <= high) ticks.push(multiple * 10 ** power)
    }
  }
  return ticks.length > 1 ? ticks : [Math.exp(low), Math.exp(high)]
}

function pixelLookup(values: readonly number[], count: number, reverse: boolean) {
  return Array.from({ length: count }, (_, index) => {
    const fraction = (index + .5) / count
    const target = blend(values[0], values[values.length - 1], reverse ? 1 - fraction : fraction)
    const left = precedingIndex(values, target)
    return { left, weight: (target - values[left]) / (values[left + 1] - values[left]) }
  })
}

function renderRaster(data: WaveletScalogramData, range: Range) {
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 420
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const raster = context.createImageData(canvas.width, canvas.height)
  const times = pixelLookup(data.timeSeconds, canvas.width, false)
  const frequencies = pixelLookup(data.frequencyHz.map(Math.log), canvas.height, true)
  let offset = 0
  for (const row of frequencies) {
    const lower = data.powerDb[row.left]
    const upper = data.powerDb[row.left + 1]
    for (const column of times) {
      const power = blend(
        blend(lower[column.left], lower[column.left + 1], column.weight),
        blend(upper[column.left], upper[column.left + 1], column.weight),
        row.weight,
      )
      const fraction = Math.min(1, Math.max(0, (power - range[0]) / (range[1] - range[0])))
      const index = fraction * (palette.length - 1)
      const stop = Math.min(palette.length - 2, Math.floor(index))
      for (let channel = 0; channel < 3; channel++) {
        raster.data[offset++] = blend(palette[stop][channel], palette[stop + 1][channel], index - stop)
      }
      raster.data[offset++] = 255
    }
  }
  context.putImageData(raster, 0, 0)
  return canvas.toDataURL('image/png')
}

function ScalogramPlot({ data, domains, time, frequency, window, compact, label, select }: {
  data: WaveletScalogramData
  domains: PlotDomains
  time: number
  frequency: number
  window: Range
  compact: boolean
  label: string
  select: (timeIndex: number, frequencyIndex: number) => void
}) {
  const scaleId = useId()
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 440 : 780, 310)
  const [raster, setRaster] = useState<{ data: WaveletScalogramData; src?: string }>()
  useEffect(() => {
    setRaster({ data, src: renderRaster(data, domains.power) })
  }, [data, domains.power])
  const left = width < 375 ? 54 : 61
  const right = Math.max(left + 1, width - (width < 375 ? 65 : 78))
  const top = 24
  const bottom = Math.max(top + 1, height - 41)
  const colorX = right + (width < 375 ? 10 : 15)
  const colorWidth = 11
  const x = (value: number) => blend(left, right, (value - domains.time[0]) / (domains.time[1] - domains.time[0]))
  const y = (value: number) => blend(bottom, top, (Math.log(value) - domains.logFrequency[0]) /
    (domains.logFrequency[1] - domains.logFrequency[0]))
  const selectedTime = data.timeSeconds[time]
  const selectedFrequency = data.frequencyHz[frequency]
  const mid = (domains.time[0] + domains.time[1]) / 2
  const buildEdgePath = (leftEdge: boolean) => data.coiEdgeSeconds?.map((seconds, index) => {
    const actualTime = leftEdge
      ? Math.min(mid, Math.max(domains.time[0], data.waveform.startSeconds + seconds))
      : Math.max(mid, Math.min(domains.time[1], signalEnd(data.waveform) - seconds))
    return `${index ? 'L' : 'M'}${x(actualTime).toFixed(2)} ${y(data.frequencyHz[index]).toFixed(2)}`
  }).join(' ')

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const timeValue = blend(...domains.time, (event.clientX - bounds.left) / bounds.width)
    const frequencyLog = blend(...domains.logFrequency, 1 - (event.clientY - bounds.top) / bounds.height)
    select(nearestIndex(data.timeSeconds, timeValue), nearestIndex(data.frequencyHz, Math.exp(frequencyLog)))
  }

  return (
    <div className="wavelet-map scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-wavelet-plot=""
        aria-label={`${label}, time in seconds, logarithmic frequency in hertz, relative power ${powerFormat.format(domains.power[0])} to ${powerFormat.format(domains.power[1])} dB`}>
        <defs>
          <clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
          <linearGradient id={scaleId} x1="0%" y1="100%" x2="0%" y2="0%">
            {palette.map((color, index) => <stop key={index} offset={index / (palette.length - 1)} stopColor={`rgb(${color.join(' ')})`} />)}
          </linearGradient>
        </defs>
        {raster?.data === data && raster.src && (
          <image href={raster.src} data-wavelet-raster="" x={left} y={top} width={right - left}
            height={bottom - top} preserveAspectRatio="none" />
        )}
        {data.coiEdgeSeconds && (
          <g data-wavelet-coi="" className="wavelet-coi" clipPath={`url(#${clipId})`} aria-hidden="true">
            <path d={buildEdgePath(true)} />
            <path d={buildEdgePath(false)} />
          </g>
        )}
        {!compact && (
          <g className="wavelet-selection" clipPath={`url(#${clipId})`} aria-hidden="true">
            <rect x={x(window[0])} y={top} width={x(window[1]) - x(window[0])} height={bottom - top} />
            <line x1={x(selectedTime)} x2={x(selectedTime)} y1={top} y2={bottom} />
            <line x1={left} x2={right} y1={y(selectedFrequency)} y2={y(selectedFrequency)} />
            <circle cx={x(selectedTime)} cy={y(selectedFrequency)} r={3.5} />
          </g>
        )}
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-wavelet-axis-frame="" x={left} y={top}
            width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={15}>{compact ? 'Wavelet power' : '(a) Wavelet power'}</text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
            Frequency (Hz, log scale)
          </text>
          {frequencyTicks(domains.logFrequency).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          {axisTicks(domains.time, width < 420 ? 4 : 7).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{format.format(value)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Time (s)</text>
        </g>
        <g className="scientific-axis" data-wavelet-colorbar="" aria-hidden="true">
          <rect x={colorX} y={top} width={colorWidth} height={bottom - top} fill={`url(#${scaleId})`} />
          <rect className="scientific-frame" x={colorX} y={top} width={colorWidth} height={bottom - top} />
          {(compact ? [0, .5, 1] : [0, 1 / 3, 2 / 3, 1]).map((fraction) => {
            const py = blend(bottom, top, fraction)
            const px = colorX + colorWidth
            return (
              <g key={fraction}>
                <line className="scientific-tick" x1={px} x2={px + 4} y1={py} y2={py} />
                <text x={px + 7} y={py + 4}>{powerFormat.format(blend(...domains.power, fraction))}</text>
              </g>
            )
          })}
          <text className="scientific-axis-label" transform={`translate(${width - 8} ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
            Relative power (dB)
          </text>
        </g>
        {!compact && (
          <rect className="wavelet-plot-pick" x={left} y={top} width={right - left} height={bottom - top}
            fill="transparent" onClick={choose} />
        )}
      </svg>
    </div>
  )
}

function waveformIndices(signal: WaveletSignal, range: Range) {
  const first = Math.max(0, Math.ceil((range[0] - signal.startSeconds) * signal.sampleRateHz))
  const last = Math.min(signal.samples.length - 1, Math.floor((range[1] - signal.startSeconds) * signal.sampleRateHz))
  return [first, last] as const
}

function waveformPath(signal: WaveletSignal, [first, last]: Range, width: number, x: (time: number) => number, y: (value: number) => number) {
  const block = Math.max(1, Math.ceil((last - first + 1) / width))
  const path: string[] = []
  function add(index: number) {
    const time = signal.startSeconds + index / signal.sampleRateHz
    path.push(`${path.length ? 'L' : 'M'}${x(time).toFixed(2)} ${y(signal.samples[index]).toFixed(2)}`)
  }
  for (let start = first; start <= last; start += block) {
    let minimum = start
    let maximum = start
    for (let index = start + 1; index < Math.min(start + block, last + 1); index++) {
      if (signal.samples[index] < signal.samples[minimum]) minimum = index
      if (signal.samples[index] > signal.samples[maximum]) maximum = index
    }
    add(Math.min(minimum, maximum))
    if (minimum !== maximum) add(Math.max(minimum, maximum))
  }
  return path.join(' ')
}

function SignalPlot({ signal, window, amplitude, selectedTime, sampleIndex }: {
  signal: WaveletSignal
  window: Range
  amplitude: Range
  selectedTime: number
  sampleIndex: number
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(780, 192)
  const left = width < 375 ? 54 : 61
  const right = Math.max(left + 1, width - 21)
  const top = 24
  const bottom = Math.max(top + 1, height - 41)
  const indices = waveformIndices(signal, window)
  const detailed = window[1] - window[0] < .04
  let range = amplitude
  if (detailed && indices[0] <= indices[1]) {
    let low = signal.samples[indices[0]]
    let high = low
    for (let index = indices[0] + 1; index <= indices[1]; index++) {
      low = Math.min(low, signal.samples[index])
      high = Math.max(high, signal.samples[index])
    }
    const padding = (high - low) * .08 || Math.max(Math.abs(low) * .05, .001)
    range = [low - padding, high + padding]
  }
  const x = (value: number) => blend(left, right, (value - window[0]) / (window[1] - window[0]))
  const y = (value: number) => blend(bottom, top, (value - range[0]) / (range[1] - range[0]))
  const title = signal.unit ? `Waveform (${signal.unit})` : 'Waveform'
  const timeFormat = detailed ? detailedTimeFormat : format
  const sampleTime = signal.startSeconds + sampleIndex / signal.sampleRateHz
  return (
    <div className="wavelet-signal scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-wavelet-signal="" data-sample-rate={signal.sampleRateHz}
        data-sample-count={signal.samples.length} data-amplitude-min={range[0]} data-amplitude-max={range[1]}
        aria-label="Waveform near the selected time">
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={15}>(b) Waveform near selected time</text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
            {title}
          </text>
          {axisTicks(range, 4).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
            </g>
          ))}
          {axisTicks(window, width < 420 ? 3 : 6).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{timeFormat.format(value)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Time (s)</text>
        </g>
        {range[0] <= 0 && 0 <= range[1] && <line className="scientific-reference" x1={left} x2={right} y1={y(0)} y2={y(0)} />}
        <line className="scientific-reference" x1={x(selectedTime)} x2={x(selectedTime)} y1={top} y2={bottom} />
        <path className="wavelet-signal-trace" data-wavelet-signal-trace=""
          d={waveformPath(signal, indices, right - left, x, y)} />
        <circle className="wavelet-sample-marker" data-wavelet-sample-marker=""
          cx={x(sampleTime)} cy={y(signal.samples[sampleIndex])} r="3.1" />
      </svg>
    </div>
  )
}

function WaveletFigure({ data, domains, label, compact = false, initialTimeSeconds, initialFrequencyHz, source }: WaveletScalogramProps & {
  domains: PlotDomains
  label: string
}) {
  const [timeIndex, setTimeIndex] = useState(() => initialTimeSeconds !== undefined && Number.isFinite(initialTimeSeconds)
    ? nearestIndex(data.timeSeconds, initialTimeSeconds) : Math.floor(data.timeSeconds.length / 2))
  const [frequencyIndex, setFrequencyIndex] = useState(() => initialFrequencyHz !== undefined && Number.isFinite(initialFrequencyHz)
    ? nearestIndex(data.frequencyHz, initialFrequencyHz) : Math.floor(data.frequencyHz.length / 2))
  const [windowSeconds, setWindowSeconds] = useState(.25)
  const time = Math.min(timeIndex, data.timeSeconds.length - 1)
  const frequency = Math.min(frequencyIndex, data.frequencyHz.length - 1)
  const selectedTime = data.timeSeconds[time]
  const selectedFrequency = data.frequencyHz[frequency]
  const selectedPower = data.powerDb[frequency][time]
  const signal = data.waveform
  const stop = signalEnd(signal)
  const windows = windowOptions.filter(({ seconds }) => seconds >= .05 || seconds * signal.sampleRateHz >= 2)
  const activeWindow = windows.some(({ seconds }) => seconds === windowSeconds) ? windowSeconds : .25
  const duration = Math.min(activeWindow, stop - signal.startSeconds)
  const windowStart = Math.min(stop - duration, Math.max(signal.startSeconds, selectedTime - duration / 2))
  const window: Range = [windowStart, windowStart + duration]
  const sampleIndex = Math.max(0, Math.min(signal.samples.length - 1, Math.round((selectedTime - signal.startSeconds) * signal.sampleRateHz)))
  const sampleTime = signal.startSeconds + sampleIndex / signal.sampleRateHz
  const sampleValue = signal.samples[sampleIndex]
  const rate = signal.sampleRateHz >= 1000 ? `${format.format(signal.sampleRateHz / 1000)} kHz` : `${format.format(signal.sampleRateHz)} Hz`
  const edgeSeconds = data.coiEdgeSeconds?.[frequency]
  const edgeAffected = edgeSeconds !== undefined &&
    Math.min(selectedTime - data.waveform.startSeconds, stop - selectedTime) < edgeSeconds

  return (
    <figure className="wavelet-scalogram" data-wavelet-scalogram="" data-compact={compact}>
      <ScalogramPlot data={data} domains={domains} time={time} frequency={frequency} window={window}
        compact={compact} label={label} select={(nextTime, nextFrequency) => {
          setTimeIndex(nextTime)
          setFrequencyIndex(nextFrequency)
        }} />
      {!compact && (
        <>
          {data.coiEdgeSeconds && <p className="wavelet-legend">Dashed boundaries mark the cone of influence.</p>}
          <SignalPlot signal={signal} window={window} amplitude={domains.signal} selectedTime={selectedTime} sampleIndex={sampleIndex} />
          <div className="wavelet-inspector">
            <output data-wavelet-readout="" data-time={selectedTime} data-frequency={selectedFrequency}
              data-power={selectedPower} data-window-start={window[0]} data-window-end={window[1]}
              data-wavelet-sample-index={sampleIndex} data-wavelet-sample-time={sampleTime} data-wavelet-sample-value={sampleValue}>
              <strong>{format.format(selectedTime)} s</strong>
              <span>{powerFormat.format(selectedFrequency)} Hz · {powerFormat.format(selectedPower)} dB</span>
              <span>{rate} waveform · {sampleFormat.format(sampleValue)} {signal.unit}</span>
              {edgeAffected && <span>Near the transform boundary</span>}
            </output>
            <div className="wavelet-controls">
              <label>Time
                <input type="range" min={0} max={data.timeSeconds.length - 1} value={time}
                  aria-valuetext={`${format.format(selectedTime)} seconds`}
                  onChange={(event) => setTimeIndex(event.currentTarget.valueAsNumber)} />
              </label>
              <label>Frequency
                <input type="range" min={0} max={data.frequencyHz.length - 1} value={frequency}
                  aria-valuetext={`${powerFormat.format(selectedFrequency)} hertz`}
                  onChange={(event) => setFrequencyIndex(event.currentTarget.valueAsNumber)} />
              </label>
              <label>Waveform window
                <select value={activeWindow} onChange={(event) => setWindowSeconds(Number(event.currentTarget.value))}>
                  {windows.map(({ seconds, label }) => <option key={seconds} value={seconds}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>
          {source && (
            <figcaption className="wavelet-caption">
              <strong>{source.label}</strong>
              <p>{source.description} <a href={source.href}>Dataset</a>
                {source.license && <> · {source.licenseUrl ? <a href={source.licenseUrl}>{source.license}</a> : source.license}</>}</p>
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function WaveletScalogram({ data, label = 'Wavelet scalogram with linked waveform', powerDomainDb, ...props }: WaveletScalogramProps) {
  const domains = useMemo(() => domainsFor(data, powerDomainDb), [data, powerDomainDb])
  if (!domains) {
    return <p className="chart-render-message" role="status">Provide ordered time and positive frequency bins, a finite power scale, and an aligned waveform.</p>
  }
  return <WaveletFigure {...props} data={data} label={label} domains={domains} />
}
