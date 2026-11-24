import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { matchFragments, prepareSpectra } from './model'
import type { MassSpectrumMirrorData, RelativeFragment, TandemMassSpectrum } from './model'
import '../scientific-figure.css'
import './mirror-spectrum.css'

export interface MassSpectrumMirrorProps {
  data: MassSpectrumMirrorData
  label?: string
  compact?: boolean
  initialToleranceMz?: number
  tolerancesMz?: readonly number[]
}

type Side = 'query' | 'reference'
type Selection = { side: Side; mz: number }
type PreparedSpectra = NonNullable<ReturnType<typeof prepareSpectra>>
type Pairs = ReturnType<typeof matchFragments>

const defaultTolerances = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1]
const mzFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6, useGrouping: false })
const relativeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const deltaFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6, signDisplay: 'exceptZero' })

function massTicks(min: number, max: number, desired: number) {
  const approximate = (max - min) / desired
  const base = 10 ** Math.floor(Math.log10(approximate))
  const fraction = approximate / base
  const step = base * [1, 2, 2.5, 5, 10].reduce((nearest, factor) =>
    Math.abs(factor - fraction) < Math.abs(nearest - fraction) ? factor : nearest)
  const first = Math.ceil(min / step)
  const count = Math.floor(max / step) - first + 1
  return Array.from({ length: Math.max(0, Math.min(12, count)) }, (_, i) => (first + i) * step)
}

function defaultIndex(peaks: readonly RelativeFragment[], paired: ReadonlyMap<number, number>) {
  let selected = 0
  for (let index = 1; index < peaks.length; index++) {
    const hasMatch = paired.has(index)
    const selectedHasMatch = paired.has(selected)
    if (hasMatch !== selectedHasMatch ? hasMatch : peaks[index].intensity > peaks[selected].intensity) selected = index
  }
  return selected
}

function SpectrumPlot({ spectra, pairs, selected, label, compact, onSelect }: {
  spectra: PreparedSpectra
  pairs: Pairs
  selected: Record<Side, number | undefined>
  label: string
  compact: boolean
  onSelect: (selection: Selection) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 390 : 760, compact ? 180 : 350)
  const left = compact ? 35 : 52
  const right = Math.max(left + 1, width - 17)
  const top = compact ? 13 : 19
  const bottom = Math.max(top + 1, height - (compact ? 35 : 44))
  const center = (top + bottom) / 2
  const band = compact ? 6 : 12
  const upperZero = center - band
  const lowerZero = center + band
  const extent = spectra.massRange
  const padding = (extent[1] - extent[0]) * .035 || Math.max(extent[0] * .02, .001)
  const min = Math.max(0, extent[0] - padding)
  const max = extent[1] + padding
  const x = (mz: number) => left + (mz - min) / (max - min) * (right - left)
  const y = (side: Side, relative: number) => side === 'query'
    ? upperZero - (upperZero - top) * relative / 100
    : lowerZero + (bottom - lowerZero) * relative / 100
  const ticks = massTicks(min, max, Math.max(3, Math.min(8, Math.floor((right - left) / 63))))
  const intensityTicks = compact ? [0, 100] : [0, 50, 100]

  function pick(side: Side, event: MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width) return
    const target = min + (event.clientX - bounds.left) / bounds.width * (max - min)
    const nearest = spectra[side].reduce((peak, candidate) =>
      Math.abs(candidate.mz - target) < Math.abs(peak.mz - target) ? candidate : peak)
    onSelect({ side, mz: nearest.mz })
  }

  return (
    <div className="mirror-spectrum-plot scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} data-mirror-spectrum-plot>
        <g className="scientific-axis" aria-hidden="true">
          <rect className="mirror-spectrum-band" x={left} y={upperZero} width={right - left} height={lowerZero - upperZero} />
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="mirror-spectrum-grid" x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} />
              <line className="scientific-tick" x1={x(tick)} x2={x(tick)} y1={bottom} y2={bottom + 4} />
              <text x={x(tick)} y={bottom + 17} textAnchor="middle">{mzFormat.format(tick)}</text>
            </g>
          ))}
          <rect className="scientific-frame" data-mirror-spectrum-frame x={left} y={top} width={right - left} height={bottom - top} />
          <line className="scientific-tick" x1={left} x2={right} y1={upperZero} y2={upperZero} />
          <line className="scientific-tick" x1={left} x2={right} y1={lowerZero} y2={lowerZero} />
          {(['query', 'reference'] as const).map((side) => intensityTicks.map((tick) => (
            <g key={`${side}-${tick}`}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(side, tick)} y2={y(side, tick)} />
              <text x={left - 7} y={y(side, tick) + 4} textAnchor="end">{tick}</text>
            </g>
          )))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle">Mass-to-charge ratio, m/z</text>
          {!compact && <text className="scientific-axis-label" transform={`translate(12 ${center}) rotate(-90)`}
            textAnchor="middle">Relative intensity (%)</text>}
        </g>
        <g aria-hidden="true">
          {Array.from(pairs.queryToReference, ([query, reference]) => (
            <line key={query} className="mirror-spectrum-pair" data-mirror-pair
              data-query-mz={spectra.query[query].mz} data-reference-mz={spectra.reference[reference].mz}
              data-selected={!compact && selected.query === query}
              x1={x(spectra.query[query].mz)} y1={upperZero} x2={x(spectra.reference[reference].mz)} y2={lowerZero} />
          ))}
          {(['query', 'reference'] as const).map((side) => {
            const matches = side === 'query' ? pairs.queryToReference : pairs.referenceToQuery
            return spectra[side].map((peak, index) => (
              <line key={`${side}-${peak.mz}`} className="mirror-spectrum-peak" data-mirror-peak
                data-spectrum={side} data-mz={peak.mz} data-intensity={peak.intensity} data-matched={matches.has(index)}
                data-selected={!compact && selected[side] === index}
                x1={x(peak.mz)} x2={x(peak.mz)} y1={y(side, 0)} y2={y(side, peak.relativeIntensity)} />
            ))
          })}
        </g>
        {!compact && (['query', 'reference'] as const).map((side) => (
          <rect key={side} className="mirror-spectrum-pick" data-mirror-pick={side} fill="transparent"
            x={left} y={side === 'query' ? top : lowerZero} width={right - left}
            height={side === 'query' ? upperZero - top : bottom - lowerZero}
            onClick={(event) => pick(side, event)} />
        ))}
      </svg>
    </div>
  )
}

function SpectrumLabel({ spectrum, side, showAcquisition }: { spectrum: TandemMassSpectrum; side: Side; showAcquisition: boolean }) {
  return (
    <span className="mirror-spectrum-key-item" data-spectrum={side}>
      <strong>{side === 'query' ? 'Query' : 'Reference'} <span>{spectrum.label}</span></strong>
      {showAcquisition && spectrum.acquisition && <span>{spectrum.acquisition}</span>}
    </span>
  )
}

function MirrorFigure({ spectra, data, label, compact = false, initialToleranceMz = 0.02, tolerancesMz = defaultTolerances }:
  MassSpectrumMirrorProps & { spectra: PreparedSpectra; label: string }) {
  const choices = useMemo(() => {
    const valid = Array.from(new Set(tolerancesMz.filter((value) => Number.isFinite(value) && value >= 0))).sort((a, b) => a - b)
    return valid.length ? valid : defaultTolerances
  }, [tolerancesMz])
  const [requestedTolerance, setTolerance] = useState<number>()
  const [requestedSelection, setSelection] = useState<Selection>()
  const preferred = requestedTolerance ?? initialToleranceMz
  const tolerance = choices.includes(preferred) ? preferred : choices[0]
  const pairs = useMemo(() => matchFragments(spectra.query, spectra.reference, tolerance), [spectra, tolerance])
  const requestedIndex = requestedSelection ? spectra[requestedSelection.side].findIndex(({ mz }) => mz === requestedSelection.mz) : -1
  const side = requestedSelection && requestedIndex !== -1 ? requestedSelection.side : 'query'
  const activeIndex = requestedIndex !== -1 ? requestedIndex : defaultIndex(spectra.query, pairs.queryToReference)
  const selected = side === 'query'
    ? { query: activeIndex, reference: pairs.queryToReference.get(activeIndex) }
    : { query: pairs.referenceToQuery.get(activeIndex), reference: activeIndex }
  const query = selected.query === undefined ? undefined : spectra.query[selected.query]
  const reference = selected.reference === undefined ? undefined : spectra.reference[selected.reference]
  const delta = query && reference ? query.mz - reference.mz : undefined
  const matched = pairs.queryToReference.size
  const formatPeak = (peak?: RelativeFragment) => peak ? `${mzFormat.format(peak.mz)} m/z · ${relativeFormat.format(peak.relativeIntensity)}%` : '—'
  const hasSource = data.query.source || data.reference.source
  const sharedAcquisition = data.query.acquisition === data.reference.acquisition ? data.query.acquisition : undefined

  return (
    <figure className="mass-spectrum-mirror" aria-label={label} data-mass-spectrum-mirror data-compact={compact}>
      {!compact && (
        <div className="mirror-spectrum-key">
          <SpectrumLabel spectrum={data.query} side="query" showAcquisition={!sharedAcquisition} />
          <SpectrumLabel spectrum={data.reference} side="reference" showAcquisition={!sharedAcquisition} />
          {sharedAcquisition && <span className="mirror-spectrum-acquisition">{sharedAcquisition}</span>}
        </div>
      )}
      <SpectrumPlot spectra={spectra} pairs={pairs} selected={selected} label={label} compact={compact} onSelect={setSelection} />
      {!compact && <>
        <div className="mirror-spectrum-summary" aria-label="Fragment counts">
          <span className="mirror-spectrum-paired-count"><strong>{matched}</strong> linked pairs</span>
          <span><strong>{spectra.query.length - matched}</strong> query only</span>
          <span><strong>{spectra.reference.length - matched}</strong> reference only</span>
        </div>
        <div className="mirror-spectrum-controls">
          <label>Fragment tolerance (m/z)
            <select value={tolerance} onChange={(event) => setTolerance(Number(event.currentTarget.value))}>
              {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
          <label>Inspect fragment
            <select value={`${side}:${spectra[side][activeIndex].mz}`} onChange={(event) => {
              const [selectedSide, mz] = event.currentTarget.value.split(':')
              setSelection({ side: selectedSide === 'reference' ? 'reference' : 'query', mz: Number(mz) })
            }}>
              {(['query', 'reference'] as const).map((source) => (
                <optgroup key={source} label={data[source].label}>
                  {spectra[source].map((peak) => <option key={peak.mz} value={`${source}:${peak.mz}`}>{mzFormat.format(peak.mz)} m/z</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <output className="mirror-spectrum-readout" data-mirror-readout data-active-spectrum={side} data-status={delta === undefined ? 'unmatched' : 'paired'}
          data-tolerance={tolerance} data-match-count={matched} data-delta-mz={delta}
          data-query-mz={query?.mz} data-reference-mz={reference?.mz} data-query-intensity={query?.intensity} data-reference-intensity={reference?.intensity}>
          <span>Query fragment <strong>{formatPeak(query)}</strong></span>
          <span>Reference fragment <strong>{formatPeak(reference)}</strong></span>
          <span>Query − reference <strong>{delta === undefined ? 'Unmatched' : `${deltaFormat.format(delta)} m/z`}</strong></span>
        </output>
        {hasSource && (
          <figcaption className="mirror-spectrum-caption">
            {(['query', 'reference'] as const).map((source) => {
              const citation = data[source].source
              return citation && <a key={source} href={citation.href}>{citation.label}</a>
            })}
          </figcaption>
        )}
      </>}
    </figure>
  )
}

export function MassSpectrumMirror({ data, label = 'Tandem mass spectrum comparison', ...props }: MassSpectrumMirrorProps) {
  const spectra = useMemo(() => prepareSpectra(data), [data])
  if (!spectra) return <p className="chart-render-message" role="status">Supply two spectra with unique positive m/z positions and finite, nonnegative intensities.</p>
  return <MirrorFigure {...props} spectra={spectra} data={data} label={label} />
}
