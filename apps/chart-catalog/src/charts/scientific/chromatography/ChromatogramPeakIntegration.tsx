import { useMemo, useState } from 'react'
import { IntegrationPlot } from './IntegrationPlot'
import type { IntegrationHandle } from './IntegrationPlot'
import { integrateChromatogramPeak, prepareChromatogram } from './model'
import type { ChromatogramData, ChromatogramPeak, PreparedChromatogramData } from './model'
import '../scientific-figure.css'
import './peak-integration.css'

export interface ChromatogramPeakIntegrationProps {
  data: ChromatogramData
  initialPeak?: string
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7 })
const displayInput = (value: number) => String(Number(value.toPrecision(11)))

function PeakNumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string>()
  return <label>{label}
    <input type="number" step="any" value={draft ?? displayInput(value)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
      onBlur={(event) => {
        const entered = event.currentTarget.valueAsNumber
        if (draft !== undefined && Number.isFinite(entered)) onChange(entered)
        setDraft(undefined)
      }} />
  </label>
}

function PeakIntegrationFigure({ prepared, initialPeak, label, compact = false, source }:
  Omit<ChromatogramPeakIntegrationProps, 'data'> & { prepared: PreparedChromatogramData; label: string }) {
  const [selected, setSelected] = useState(initialPeak)
  const [overrides, setOverrides] = useState<{ input: PreparedChromatogramData; peaks: ReadonlyMap<string, ChromatogramPeak> }>()
  const [mode, setMode] = useState<'above' | 'signed'>('above')
  const edits = overrides?.input === prepared ? overrides.peaks : undefined
  const regions = useMemo(() => prepared.peaks.flatMap((sourcePeak) => {
    const peak = edits?.get(sourcePeak.id) ?? sourcePeak
    const result = integrateChromatogramPeak(prepared.samples, peak)
    return result ? [{ peak, result }] : []
  }), [prepared, edits])
  const active = regions.find(({ peak }) => peak.id === selected) ?? regions[0]
  const areaUnit = `${prepared.signalUnit} × ${prepared.timeUnit}`
  const selectedIndex = active ? regions.indexOf(active) : -1
  const previousEnd = regions[selectedIndex - 1]?.peak.end ?? prepared.timeBounds[0]
  const nextStart = regions[selectedIndex + 1]?.peak.start ?? prepared.timeBounds[1]

  function store(peak: ChromatogramPeak) {
    if (!integrateChromatogramPeak(prepared.samples, peak)) return
    const next = new Map(edits)
    next.set(peak.id, peak)
    setOverrides({ input: prepared, peaks: next })
  }

  function edit(handle: IntegrationHandle, value: number) {
    if (!active || !Number.isFinite(value)) return
    const { peak, result } = active
    if (handle === 'start') {
      const start = Math.max(previousEnd, value)
      if (start < peak.end) store({ ...peak, start })
    } else if (handle === 'end') {
      const end = Math.min(nextStart, value)
      if (end > peak.start) store({ ...peak, end })
    } else {
      const baseline: [number, number] = [...result.baseline]
      baseline[handle === 'baseline-start' ? 0 : 1] = value
      store({ ...peak, baseline })
    }
  }

  return <figure className="peak-integration" aria-label={label} data-peak-integration data-compact={compact}>
    <section aria-label="Acquisition overview">
      {!compact && <div className="peak-section-header">
        <h3>Acquisition overview</h3>
        {active && <span className="peak-fill-key"><i /> Integrated regions</span>}
      </div>}
      <IntegrationPlot data={prepared} regions={regions} active={active} compact={compact} onSelect={setSelected} />
    </section>
    {!compact && active && <>
      <section className="peak-region" aria-label="Edit integration region">
        <div className="peak-section-header">
          <h3>{active.peak.label ?? active.peak.id}</h3>
          <span className="peak-fill-key"><i /> Above baseline{active.result.negativeArea < 0 && <><i data-below /> Below baseline</>}</span>
        </div>
        <IntegrationPlot key={active.peak.id} data={prepared} regions={regions} active={active} compact={false} editing onEdit={edit} />
        <div className="peak-editor-values" key={active.peak.id}>
          <PeakNumberField label={`Start (${prepared.timeUnit})`} value={active.peak.start} onChange={(value) => edit('start', value)} />
          <PeakNumberField label={`End (${prepared.timeUnit})`} value={active.peak.end} onChange={(value) => edit('end', value)} />
          <PeakNumberField label={`Baseline at start (${prepared.signalUnit})`} value={active.result.baseline[0]} onChange={(value) => edit('baseline-start', value)} />
          <PeakNumberField label={`Baseline at end (${prepared.signalUnit})`} value={active.result.baseline[1]} onChange={(value) => edit('baseline-end', value)} />
        </div>
        <div className="peak-editor-actions">
          <button type="button" onClick={() => store({ ...active.peak, baseline: undefined })}>Use signal endpoints</button>
          <button type="button" onClick={() => {
            const original = prepared.peaks.find(({ id }) => id === active.peak.id)
            if (!original) return
            // Preserve any independently edited neighboring integration window.
            const start = Math.max(previousEnd, original.start)
            const end = Math.min(nextStart, original.end)
            if (start < end) store({ ...original, start, end })
          }}>Reset region</button>
        </div>
        <output className="peak-value" data-peak-value={active.peak.id}
          data-start={active.peak.start} data-end={active.peak.end}
          data-baseline-start={active.result.baseline[0]} data-baseline-end={active.result.baseline[1]}
          data-apex-time={active.result.apex.time} data-apex-height={active.result.apex.height}
          data-positive-area={active.result.positiveArea} data-negative-area={active.result.negativeArea}
          data-signed-area={active.result.signedArea} data-area-mode={mode}>
          <span>{mode === 'above' ? 'Area above baseline' : 'Signed area'}
            <strong>{number.format(mode === 'above' ? active.result.positiveArea : active.result.signedArea)} {areaUnit}</strong>
          </span>
          <span>Apex retention <strong>{number.format(active.result.apex.time)} {prepared.timeUnit}</strong></span>
          <span>Corrected height <strong>{number.format(active.result.apex.height)} {prepared.signalUnit}</strong></span>
        </output>
      </section>
      <section className="peak-results" aria-label="Integrated peak results">
        <div className="peak-section-header">
          <h3>Peak areas</h3>
          <label>Area measure
            <select value={mode} onChange={(event) => setMode(event.currentTarget.value === 'signed' ? 'signed' : 'above')}>
              <option value="above">Above baseline</option>
              <option value="signed">Signed area</option>
            </select>
          </label>
        </div>
        <table>
          <thead><tr><th scope="col">Peak</th><th scope="col">Apex ({prepared.timeUnit})</th><th scope="col">Area ({areaUnit})</th></tr></thead>
          <tbody>{regions.map(({ peak, result }) => {
            const area = mode === 'above' ? result.positiveArea : result.signedArea
            return <tr key={peak.id} data-peak-row={peak.id} data-active={peak.id === active.peak.id} data-area={area}>
              <th scope="row"><button type="button" aria-pressed={peak.id === active.peak.id} onClick={() => setSelected(peak.id)}>{peak.label ?? peak.id}</button></th>
              <td>{number.format(result.apex.time)}</td><td>{number.format(area)}</td>
            </tr>
          })}</tbody>
        </table>
      </section>
    </>}
    {!compact && source && <figcaption className="peak-source">
      <div><a href={source.href}>{source.label}</a>
        {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
      </div>
      {source.description && <p>{source.description}</p>}
    </figcaption>}
  </figure>
}

export function ChromatogramPeakIntegration({ data, label = 'Chromatogram peak integration', ...props }: ChromatogramPeakIntegrationProps) {
  const prepared = useMemo(() => prepareChromatogram(data), [data])
  if (!prepared) return <p className="chart-render-message" role="status">Supply chronological detector readings and valid, non-overlapping peak windows.</p>
  return <PeakIntegrationFigure {...props} label={label} prepared={prepared} />
}
