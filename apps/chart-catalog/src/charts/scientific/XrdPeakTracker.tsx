import { useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { usePlotSize } from '../usePlotSize'
import './scientific-figure.css'
import './xrd-peak-tracker.css'

type Domain = readonly [number, number]

export interface XrdPeakFit {
  centerDeg: number
  fwhmDeg: number
  height: number
  background: number
  backgroundSlope: number
  lorentzFraction: number
  rmse: number
}

export interface XrdPeak {
  id: string
  label: string
  windowDeg: Domain
  fits: readonly (XrdPeakFit | null)[]
}

export interface XrdScan {
  temperatureK: number
  intensity: readonly number[]
}

export interface XrdPeakData {
  angleDeg: readonly number[]
  scans: readonly XrdScan[]
  peaks: readonly XrdPeak[]
}

export interface XrdPeakTrackerProps {
  data: XrdPeakData
  label?: string
  compact?: boolean
  initialTemperatureK?: number
  /** Display a peak and its measured scan selected by a companion view. */
  selection?: { peakId: string; temperatureK: number }
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Frame = { left: number; right: number; top: number; bottom: number }
const metrics = [
  { id: 'center', key: 'centerDeg', title: 'Peak position', axis: '2θ (°)', digits: 4 },
  { id: 'fwhm', key: 'fwhmDeg', title: 'Peak width', axis: 'FWHM (°)', digits: 4 },
  { id: 'height', key: 'height', title: 'Peak height', axis: 'Height (a.u.)', digits: 1 },
] as const
type Metric = typeof metrics[number]
const temperatureFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const tickFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })

function finiteRange([low, high]: Domain) {
  return Number.isFinite(high - low) && high > low
}

function isIncreasing(values: readonly number[]) {
  return values.every((value, index) => Number.isFinite(value) && (index === 0 || value > values[index - 1]))
}

function getDomains({ angleDeg, scans, peaks }: XrdPeakData) {
  if (angleDeg.length < 3 || !isIncreasing(angleDeg) || scans.length < 2 ||
      !isIncreasing(scans.map(({ temperatureK }) => temperatureK)) || scans[0].temperatureK < 0 ||
      !peaks.length || new Set(peaks.map(({ id }) => id)).size !== peaks.length) return null
  const angle = [angleDeg[0], angleDeg[angleDeg.length - 1]] as const
  let low = 0
  let high = 0
  for (const { intensity } of scans) {
    if (intensity.length !== angleDeg.length) return null
    for (const value of intensity) {
      if (!Number.isFinite(value)) return null
      low = Math.min(value, low)
      high = Math.max(value, high)
    }
  }
  for (const peak of peaks) {
    const [start, end] = peak.windowDeg
    if (!finiteRange(peak.windowDeg) || start < angle[0] || end > angle[1] || peak.fits.length !== scans.length) return null
    for (const fit of peak.fits) {
      if (!fit) continue
      if (![fit.centerDeg, fit.fwhmDeg, fit.height, fit.background, fit.backgroundSlope, fit.lorentzFraction, fit.rmse].every(Number.isFinite) ||
          fit.centerDeg <= start || fit.centerDeg >= end || fit.fwhmDeg <= 0 || fit.fwhmDeg > end - start ||
          fit.height <= 0 || fit.lorentzFraction < 0 || fit.lorentzFraction > 1 || fit.rmse < 0) return null
      const bgStart = baseline(fit, start)
      const bgEnd = baseline(fit, end)
      low = Math.min(low, bgStart, bgEnd)
      high = Math.max(high, Math.max(bgStart, bgEnd) + fit.height)
    }
  }
  const temperature = [scans[0].temperatureK, scans[scans.length - 1].temperatureK] as const
  if (!finiteRange(angle) || !finiteRange(temperature) || !Number.isFinite(high - low)) return null
  return { angle, intensity: [low, high > low ? high + (high - low) * .04 : low + 1] as const, temperature }
}

function scale(value: number, [low, high]: Domain, start: number, end: number) {
  return start + (value - low) / (high - low) * (end - start)
}

function ticks([low, high]: Domain, target: number) {
  const approximate = (high - low) / target
  const base = 10 ** Math.floor(Math.log10(approximate))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => base * multiple >= approximate) ?? 10)
  if (!Number.isFinite(step) || step <= 0) return [low, high]
  const first = Math.ceil(low / step - 1e-9)
  const last = Math.floor(high / step + 1e-9)
  return last > first ? Array.from({ length: Math.min(10, last - first + 1) }, (_, index) => (first + index) * step) : [low, high]
}

function baseline(fit: XrdPeakFit, angle: number) {
  return fit.background + fit.backgroundSlope * (angle - fit.centerDeg)
}

function peakValue(fit: XrdPeakFit, angle: number) {
  const scaled = (2 * (angle - fit.centerDeg) / fit.fwhmDeg) ** 2
  return baseline(fit, angle) + fit.height *
    ((1 - fit.lorentzFraction) * Math.exp(-Math.LN2 * scaled) + fit.lorentzFraction / (1 + scaled))
}

function Axes({ frame, horizontal, vertical, horizontalLabel, verticalLabel, height, profile, title, children }: {
  frame: Frame
  horizontal: Domain
  vertical: Domain
  horizontalLabel: string
  verticalLabel: string
  height: number
  profile?: boolean
  title?: string
  children?: ReactNode
}) {
  const { left, right, top, bottom } = frame
  const x = (value: number) => scale(value, horizontal, left, right)
  const y = (value: number) => scale(value, vertical, bottom, top)
  return (
    <g className="scientific-axis" aria-hidden="true">
      {title && <text className="scientific-panel-title" x={left} y={13}>{title}</text>}
      {ticks(horizontal, right - left < 290 ? (profile && right - left >= 170 ? 5 : 4) : 6).map((value) => (
        <g key={value}>
          <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
          <text x={x(value)} y={bottom + 17} textAnchor="middle">{tickFormat.format(value)}</text>
        </g>
      ))}
      {ticks(vertical, bottom - top > 180 ? 5 : 3).map((value) => (
        <g key={value}>
          <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
          <text x={left - 8} y={y(value) + 4} textAnchor="end">{tickFormat.format(value)}</text>
        </g>
      ))}
      <rect className="scientific-frame" data-xrd-axis-frame={profile ? '' : undefined}
        x={left} y={top} width={right - left} height={bottom - top} />
      {children}
      <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle">{horizontalLabel}</text>
      <text className="scientific-axis-label xrd-y-label" textAnchor="middle"
        transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`}>{verticalLabel}</text>
    </g>
  )
}

function pathFrom(values: readonly number[], x: (value: number, index: number) => number, y: (value: number, index: number) => number) {
  return values.map((value, index) => `${index ? 'L' : 'M'}${x(value, index).toFixed(2)} ${y(value, index).toFixed(2)}`).join(' ')
}

function Profile({ data, angle, intensity, scan, fit, peak, compact, onPick, label }: {
  data: XrdPeakData
  angle: Domain
  intensity: Domain
  scan: XrdScan
  fit: XrdPeakFit | null
  peak: XrdPeak
  compact: boolean
  onPick?: (angle: number) => void
  label: string
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 420 : 760, compact ? 170 : 340)
  const left = width < 355 ? 48 : 56
  const right = Math.max(left + 1, width - 19)
  const top = 14
  const bottom = Math.max(top + 1, height - 42)
  const x = (value: number) => scale(value, angle, left, right)
  const y = (value: number) => scale(value, intensity, bottom, top)
  const [start, end] = peak.windowDeg
  const curve = fit ? pathFrom(Array.from({ length: 101 }, (_, index) => start + index / 100 * (end - start)),
    x, (value) => y(peakValue(fit, value))) : ''

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    onPick?.(scale(event.clientX, [bounds.left, bounds.right], ...angle))
  }

  return (
    <div className="xrd-profile scientific-plot" ref={plot}>
      <svg role="img" data-xrd-profile="" aria-label={`${label}. Measured diffraction at ${temperatureFormat.format(scan.temperatureK)} K, ${peak.label}.`}
        viewBox={`0 0 ${width} ${height}`}>
        <Axes frame={{ left, right, top, bottom }} horizontal={angle} vertical={intensity} height={height}
          horizontalLabel="Diffraction angle, 2θ (°)" verticalLabel="Intensity (a.u.)" profile>
          <path className="xrd-window" d={`M${x(start)} ${bottom + 4}v3H${x(end)}v-3`} />
        </Axes>
        <g data-xrd-measured="" aria-hidden="true">
          {compact ? (
            <path className="xrd-measurement-trace" d={pathFrom(data.angleDeg, x, (_, index) => y(scan.intensity[index]))} />
          ) : data.angleDeg.map((value, index) => (
            <circle key={value} className="xrd-bin" cx={x(value)} cy={y(scan.intensity[index])} r={width < 400 ? 1.4 : 1.8} />
          ))}
        </g>
        {fit && (
          <g aria-hidden="true">
            <path className="xrd-fit" data-xrd-fit="" d={curve} />
            {!compact && (
              <>
                <line data-xrd-baseline="" className="scientific-reference" x1={x(start)} x2={x(end)}
                  y1={y(baseline(fit, start))} y2={y(baseline(fit, end))} />
                <path data-xrd-fwhm="" className="xrd-fwhm" d={widthBracket(fit, x, y)} />
              </>
            )}
          </g>
        )}
        {!compact && onPick && <rect className="xrd-profile-pick" x={left} y={top} width={right - left} height={bottom - top}
          fill="transparent" onClick={choose} />}
      </svg>
    </div>
  )
}

function widthBracket(fit: XrdPeakFit, x: (value: number) => number, y: (value: number) => number) {
  const leftAngle = fit.centerDeg - fit.fwhmDeg / 2
  const rightAngle = fit.centerDeg + fit.fwhmDeg / 2
  const left = x(leftAngle)
  const right = x(rightAngle)
  const first = y(baseline(fit, leftAngle) + fit.height / 2)
  const last = y(baseline(fit, rightAngle) + fit.height / 2)
  return `M${left} ${first - 3}v6 M${left} ${first}L${right} ${last} M${right} ${last - 3}v6`
}

function metricDomain(fits: XrdPeak['fits'], metric: Metric): Domain {
  const values = fits.flatMap((fit) => fit ? [fit[metric.key]] : [])
  if (!values.length) return [0, 1]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = (max - min || Math.abs(min) * .02 || 1) * .15
  return [metric.id === 'center' ? min - padding : Math.max(0, min - padding), max + padding]
}

function Trend({ metric, scans, temperature, peak, selectedIndex, onSelect }: {
  metric: Metric
  scans: readonly XrdScan[]
  temperature: Domain
  peak: XrdPeak
  selectedIndex: number
  onSelect?: (temperature: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(245, 168)
  const left = 60
  const right = Math.max(left + 1, width - 12)
  const top = 24
  const bottom = Math.max(top + 1, height - 38)
  const vertical = metricDomain(peak.fits, metric)
  const x = (value: number) => scale(value, temperature, left, right)
  const y = (value: number) => scale(value, vertical, bottom, top)
  const selected = scans[selectedIndex].temperatureK
  const fit = peak.fits[selectedIndex]
  const path = peak.fits.map((fit, index) => {
    if (!fit) return ''
    return `${index > 0 && peak.fits[index - 1] ? 'L' : 'M'}${x(scans[index].temperatureK).toFixed(2)} ${y(fit[metric.key]).toFixed(2)}`
  }).join(' ')

  function choose(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    onSelect?.(scale(event.clientX, [bounds.left, bounds.right], ...temperature))
  }

  return (
    <div className="xrd-trend scientific-plot" ref={plot}>
      <svg role="img" aria-label={`${metric.title} by temperature`} data-xrd-trend="" data-metric={metric.id}
        viewBox={`0 0 ${width} ${height}`}>
        <Axes frame={{ left, right, top, bottom }} horizontal={temperature} vertical={vertical} height={height}
          horizontalLabel="Temperature (K)" verticalLabel={metric.axis} title={metric.title} />
        <g aria-hidden="true">
          <line className="scientific-reference" x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} />
          <path className="xrd-trend-line" d={path} />
          {peak.fits.map((fit, index) => fit && (
            <circle key={scans[index].temperatureK} className="xrd-trend-point"
              cx={x(scans[index].temperatureK)} cy={y(fit[metric.key])} r={2.1} />
          ))}
          {fit && <circle className="xrd-trend-cursor" data-xrd-trend-cursor="" data-temperature={selected}
            data-value={fit[metric.key]} cx={x(selected)} cy={y(fit[metric.key])} r={3.9} />}
        </g>
        {onSelect && <rect className="xrd-trend-pick" x={left} y={top} width={right - left} height={bottom - top}
          fill="transparent" onClick={choose} />}
      </svg>
    </div>
  )
}

function nearestScan(scans: readonly XrdScan[], temperature: number) {
  let selected = 0
  for (let index = 1; index < scans.length; index++) {
    if (Math.abs(scans[index].temperatureK - temperature) < Math.abs(scans[selected].temperatureK - temperature)) selected = index
  }
  return selected
}

function TrackerFigure({ data, domains, label, compact = false, source, initialTemperatureK, selection }:
  XrdPeakTrackerProps & { domains: NonNullable<ReturnType<typeof getDomains>>; label: string }) {
  const [peakId, setPeakId] = useState(data.peaks[0].id)
  const [temperature, setTemperature] = useState(initialTemperatureK !== undefined && Number.isFinite(initialTemperatureK)
    ? initialTemperatureK : data.scans[0].temperatureK)
  const index = selection
    ? data.scans.findIndex(({ temperatureK }) => temperatureK === selection.temperatureK)
    : nearestScan(data.scans, temperature)
  const peak = data.peaks.find(({ id }) => id === (selection?.peakId ?? peakId))
    ?? (selection ? undefined : data.peaks[0])
  if (!peak || index < 0) return <p className="chart-render-message" role="status">Select a known peak and a measured temperature.</p>
  const scan = data.scans[index]
  const fit = peak.fits[index]
  const selected = `${temperatureFormat.format(scan.temperatureK)} K`
  const padding = (domains.temperature[1] - domains.temperature[0]) * .03
  const temperatureDomain = [Math.max(0, domains.temperature[0] - padding), domains.temperature[1] + padding] as const

  function pickPeak(angle: number) {
    const target = data.peaks.find(({ windowDeg: [start, end] }) => angle >= start && angle <= end)
    if (target) setPeakId(target.id)
  }

  const readout = !compact && (
    <output className="xrd-readout" data-xrd-readout="" data-temperature={scan.temperatureK} data-center={fit?.centerDeg}
      data-fwhm={fit?.fwhmDeg} data-height={fit?.height} data-rmse={fit?.rmse}>
      <span>Temperature <strong>{selected}</strong></span>
      {fit ? (
        <>
          <span>2θ <strong>{fit.centerDeg.toFixed(metrics[0].digits)}°</strong></span>
          <span>FWHM <strong>{fit.fwhmDeg.toFixed(metrics[1].digits)}°</strong></span>
          <span>Peak height <strong>{fit.height.toFixed(metrics[2].digits)} a.u.</strong></span>
          <span>Fit RMSE <strong>{fit.rmse.toFixed(2)} a.u.</strong></span>
        </>
      ) : <span>Peak fit <strong>Unavailable for this scan</strong></span>}
    </output>
  )

  return (
    <figure className="xrd-peak-tracker" data-xrd-peak-tracker="" data-compact={compact} data-peak={peak.id}>
      {!compact && !selection && data.peaks.length > 1 && (
        <label className="xrd-choice">Peak
          <select value={peak.id} onChange={(event) => setPeakId(event.currentTarget.value)}>
            {data.peaks.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      )}
      {selection && readout}
      <Profile data={data} angle={domains.angle} intensity={domains.intensity} scan={scan} fit={fit} peak={peak}
        compact={compact} onPick={selection ? undefined : pickPeak} label={label} />
      {!compact && (
        <>
          <ul className="xrd-key" aria-label="Figure key">
            <li className="xrd-key-measured">Measured profile</li>
            <li className="xrd-key-fit">Pseudo-Voigt fit</li>
            <li className="xrd-key-background">Local background</li>
            <li className="xrd-key-width">FWHM</li>
          </ul>
          <div className="xrd-trends">
            {metrics.map((metric) => <Trend key={metric.id} metric={metric} scans={data.scans}
              temperature={temperatureDomain} peak={peak} selectedIndex={index} onSelect={selection ? undefined : setTemperature} />)}
          </div>
          {!selection && <label className="xrd-temperature">Temperature
            <input type="range" min={0} max={data.scans.length - 1} step={1} value={index} aria-valuetext={selected}
              onChange={(event) => setTemperature(data.scans[Number(event.currentTarget.value)].temperatureK)} />
          </label>}
          {!selection && readout}
          {source && (
            <figcaption className="xrd-caption">
              <a href={source.href}>{source.label}</a>
              {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
              {source.description && <p>{source.description}</p>}
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function XrdPeakTracker({ data, label = 'X-ray diffraction peak tracker', ...props }: XrdPeakTrackerProps) {
  const domains = useMemo(() => getDomains(data), [data])
  if (!domains) return <p className="chart-render-message" role="status">Provide ordered diffraction angles, aligned scans, and valid peak fits.</p>
  return <TrackerFigure {...props} data={data} domains={domains} label={label} />
}
