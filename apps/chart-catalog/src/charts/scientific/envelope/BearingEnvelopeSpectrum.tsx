import { useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import '../scientific-figure.css'
import './bearing-envelope.css'

export interface EnvelopeBand {
  id: string
  label: string
  lowHz: number
  highHz: number
}

export interface EnvelopeReference {
  id: string
  label: string
  order: number
}

export interface EnvelopeRun {
  id: string
  label: string
  broadbandDb: readonly number[]
  envelopes: Readonly<Record<string, readonly number[]>>
}

export interface EnvelopeSpectrumData {
  frequencyHz: readonly number[]
  orders: readonly number[]
  bands: readonly EnvelopeBand[]
  references?: readonly EnvelopeReference[]
  runs: readonly EnvelopeRun[]
}

export interface BearingEnvelopeSpectrumProps {
  data: EnvelopeSpectrumData
  label?: string
  compact?: boolean
  levelDomainDb?: readonly [number, number]
  initialBandId?: string
  initialRunId?: string
  initialOrder?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Range = readonly [number, number]
type Limits = { carrier: Range; envelope: Range }

const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const dbFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function increasing(values: readonly number[]) {
  return values.length >= 2 && values.every((value, index) =>
    Number.isFinite(value) && value >= 0 && (index === 0 || value > values[index - 1]))
}

function dbExtent(sets: readonly (readonly number[])[], count: number): Range | null {
  let minimum = Infinity
  let maximum = -Infinity
  for (const values of sets) {
    if (values?.length !== count) return null
    for (const value of values) {
      if (!Number.isFinite(value)) return null
      minimum = Math.min(minimum, value)
      maximum = Math.max(maximum, value)
    }
  }
  const low = Math.min(minimum, maximum - 1)
  if (!Number.isFinite(maximum - low) || maximum <= low) return null
  return [low, maximum]
}

function limitsFor(data: EnvelopeSpectrumData, levelDomainDb?: Range): Limits | null {
  if (!increasing(data.frequencyHz) || !increasing(data.orders) || !data.runs.length || !data.bands.length) return null
  if (new Set(data.runs.map(({ id }) => id)).size !== data.runs.length ||
      new Set(data.bands.map(({ id }) => id)).size !== data.bands.length) return null
  const lastHz = data.frequencyHz[data.frequencyHz.length - 1]
  if (data.bands.some(({ lowHz, highHz }) =>
    !Number.isFinite(lowHz) || lowHz < 0 || lowHz >= highHz || !Number.isFinite(highHz) || highHz > lastHz ||
    highHz < data.frequencyHz[0])) return null
  if (data.references && (new Set(data.references.map(({ id }) => id)).size !== data.references.length ||
      data.references.some(({ order }) => !Number.isFinite(order) || order < 0))) return null
  const carrier = dbExtent(data.runs.map(({ broadbandDb }) => broadbandDb), data.frequencyHz.length)
  const envelope = dbExtent(data.runs.flatMap(({ envelopes }) => data.bands.map(({ id }) => envelopes[id])), data.orders.length)
  if (!carrier || !envelope) return null
  if (!levelDomainDb) return { carrier, envelope }
  if (!Number.isFinite(levelDomainDb[1] - levelDomainDb[0]) || levelDomainDb[0] >= levelDomainDb[1]) return null
  return { carrier: levelDomainDb, envelope: levelDomainDb }
}

function nearestOrder(orders: readonly number[], value: number) {
  let low = 0
  let high = orders.length - 1
  while (high > low + 1) {
    const mid = (low + high) >>> 1
    if (orders[mid] < value) low = mid
    else high = mid
  }
  return Math.abs(orders[low] - value) <= Math.abs(orders[high] - value) ? low : high
}

function tickStep([min, max]: Range, count: number) {
  const target = (max - min) / count
  const base = 10 ** Math.floor(Math.log10(target))
  const step = base * ([1, 2, 2.5, 5, 10].find((multiple) => multiple * base >= target) ?? 10)
  return Number.isFinite(step) && step > 0 ? step : (max - min)
}

function ticks([min, max]: Range, step: number) {
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  const count = Math.min(10, last - first + 1)
  return count > 1 ? Array.from({ length: count }, (_, index) => (first + index) * step) : [min, max]
}

function SpectrumPanel({ values, frequencies, range, band, references, selected, compact, label, pick }: {
  values: readonly number[]
  frequencies: readonly number[]
  range: Range
  band?: EnvelopeBand
  references?: readonly EnvelopeReference[]
  selected?: number
  compact: boolean
  label: string
  pick?: (index: number) => void
}) {
  const carrier = band !== undefined
  const clipId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 450 : 750, 228)
  const left = width < 365 ? 51 : 58
  const right = Math.max(left + 1, width - 21)
  const top = carrier ? 25 : width < 500 ? 48 : 41
  const bottom = Math.max(top + 1, height - 41)
  const lastX = frequencies[frequencies.length - 1]
  const firstX = frequencies[0] <= lastX * .02 ? 0 : frequencies[0]
  const xRange: Range = [firstX, lastX]
  const yStep = tickStep(range, width < 420 ? 4 : 5)
  const x = (value: number) => left + (value - xRange[0]) / (xRange[1] - xRange[0]) * (right - left)
  const y = (value: number) => bottom - (value - range[0]) / (range[1] - range[0]) * (bottom - top)
  const path = values.map((value, index) =>
    `${index ? 'L' : 'M'}${x(frequencies[index]).toFixed(2)} ${y(value).toFixed(2)}`).join(' ')
  const shownReferences = references?.filter(({ order }) => order >= firstX && order <= lastX)
    .sort((a, b) => a.order - b.order) ?? []
  const referenceLabelEnds = width < 500 ? [-Infinity, -Infinity] : [-Infinity]

  function select(event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = (event.clientX - bounds.left) / bounds.width
    pick?.(nearestOrder(frequencies, firstX + (lastX - firstX) * fraction))
  }

  return (
    <div className="envelope-panel scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}
        data-envelope-carrier={carrier ? '' : undefined} data-envelope-spectrum={carrier ? undefined : ''}>
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        {band && (
          <rect className="envelope-band-window" data-envelope-band="" data-low-hz={band.lowHz} data-high-hz={band.highHz}
            x={x(Math.max(firstX, band.lowHz))} y={top}
            width={x(Math.min(lastX, band.highHz)) - x(Math.max(firstX, band.lowHz))} height={bottom - top} />
        )}
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-envelope-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <text className="scientific-panel-title" x={left} y={15}>
            {carrier ? '(a) Broadband carrier spectrum' : compact ? 'Envelope order spectrum' : '(b) Envelope order spectrum'}
          </text>
          <text className="scientific-axis-label" transform={`translate(13 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
            {carrier ? 'Relative PSD (dB)' : 'Relative amplitude (dB)'}
          </text>
          {ticks(range, yStep).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{dbFormat.format(value)}</text>
            </g>
          ))}
          {ticks(xRange, tickStep(xRange, width < 420 ? 4 : 7)).map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 4} />
              <text x={x(value)} y={bottom + 17} textAnchor="middle">{format.format(value)}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">
            {carrier ? 'Carrier frequency (Hz)' : 'Order (× shaft frequency)'}
          </text>
        </g>
        {shownReferences.map((reference) => {
          const px = x(reference.order)
          const text = width < 500 ? reference.label : `${reference.label} ${format.format(reference.order)}×`
          const halfLabel = text.length * 2.8 + 2
          const labelRow = referenceLabelEnds.findIndex((end) => px - halfLabel >= end)
          if (labelRow >= 0) referenceLabelEnds[labelRow] = px + halfLabel
          const labelY = top - 10 - Math.max(0, labelRow) * 12
          return (
            <g className="envelope-reference" key={reference.id} data-envelope-reference="" data-order={reference.order}>
              <line className="scientific-reference" x1={px} x2={px} y1={labelY + 4} y2={bottom} />
              {labelRow >= 0 && <text x={px} y={labelY} textAnchor="middle">{text}</text>}
            </g>
          )
        })}
        <path className="envelope-trace" d={path} data-envelope-trace={carrier ? undefined : ''} clipPath={`url(#${clipId})`} />
        {selected !== undefined && (
          <g aria-hidden="true" className="envelope-selection">
            <line className="scientific-reference" x1={x(frequencies[selected])} x2={x(frequencies[selected])} y1={top} y2={bottom} />
            {values[selected] >= range[0] && values[selected] <= range[1] &&
              <circle cx={x(frequencies[selected])} cy={y(values[selected])} r={3.4} />}
          </g>
        )}
        {pick && (
          <rect className="envelope-plot-pick" x={left} y={top} width={right - left} height={bottom - top}
            fill="transparent" onClick={select} />
        )}
      </svg>
    </div>
  )
}

function EnvelopeFigure({ data, label, compact = false, source, initialRunId, initialBandId, initialOrder, limits }: BearingEnvelopeSpectrumProps & {
  label: string
  limits: Limits
}) {
  const [runId, setRunId] = useState(initialRunId)
  const [bandId, setBandId] = useState(initialBandId)
  const [showReferences, setShowReferences] = useState(true)
  const [order, setOrder] = useState(() =>
    initialOrder !== undefined && Number.isFinite(initialOrder) ? nearestOrder(data.orders, initialOrder) : 0)
  const run = data.runs.find(({ id }) => id === runId) ?? data.runs[0]
  const band = data.bands.find(({ id }) => id === bandId) ?? data.bands[0]
  const selected = Math.min(order, data.orders.length - 1)
  const levels = run.envelopes[band.id]
  const references = showReferences ? data.references : undefined

  return (
    <figure className="bearing-envelope" aria-label={label} data-envelope-chart="" data-compact={compact}>
      {!compact && (
        <>
          <div className="envelope-options">
            {data.runs.length > 1 && (
              <label>Bearing condition
                <select value={run.id} onChange={(event) => setRunId(event.currentTarget.value)}>
                  {data.runs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            )}
            <label>Demodulation band
              <select value={band.id} onChange={(event) => setBandId(event.currentTarget.value)}>
                {data.bands.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            {Boolean(data.references?.length) && (
              <label className="envelope-show-reference">
                <input type="checkbox" checked={showReferences} onChange={(event) => setShowReferences(event.currentTarget.checked)} />
                Show reference orders
              </label>
            )}
          </div>
          <SpectrumPanel values={run.broadbandDb} frequencies={data.frequencyHz} range={limits.carrier}
            band={band} compact={false} label="Broadband carrier power spectral density and selected demodulation band" />
        </>
      )}
      <SpectrumPanel values={levels} frequencies={data.orders} range={limits.envelope} references={references}
        compact={compact} label={`Envelope order spectrum, ${run.label}, ${band.label}`}
        selected={compact ? undefined : selected} pick={compact ? undefined : setOrder} />
      {!compact && (
        <>
          {Boolean(references?.length) && (
            <p className="envelope-reference-key">
              Expected shaft orders are {references?.map(({ label, order }) => `${label} ${format.format(order)}×`).join(', ')}.
            </p>
          )}
          <div className="envelope-inspector">
            <output data-envelope-readout="" data-order={data.orders[selected]} data-level={levels[selected]}>
              <strong>{format.format(data.orders[selected])}× shaft frequency</strong>
              <span>{dbFormat.format(levels[selected])} dB</span>
            </output>
            <label>Shaft order
              <input type="range" min={0} max={data.orders.length - 1} value={selected}
                aria-valuetext={`${format.format(data.orders[selected])} times shaft frequency`}
                onChange={(event) => setOrder(event.currentTarget.valueAsNumber)} />
            </label>
          </div>
          {source && (
            <figcaption className="envelope-caption">
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

export function BearingEnvelopeSpectrum({ data, label = 'Bearing envelope spectrum', levelDomainDb, ...props }: BearingEnvelopeSpectrumProps) {
  const limits = useMemo(() => limitsFor(data, levelDomainDb), [data, levelDomainDb])
  if (!limits) {
    return <p className="chart-render-message" role="status">Provide aligned carrier and envelope spectra, ordered frequency bins, and valid carrier bands.</p>
  }
  return <EnvelopeFigure {...props} data={data} label={label} limits={limits} />
}
