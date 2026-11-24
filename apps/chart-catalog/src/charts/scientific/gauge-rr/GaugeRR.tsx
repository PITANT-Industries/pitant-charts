import { useMemo, useState } from 'react'
import { GaugeMatrix } from './GaugeMatrix'
import type { GaugeCellSelection, GaugeScale } from './GaugeMatrix'
import { GaugeVariance } from './GaugeVariance'
import { prepareGaugeRR } from './model'
import type { GaugeRRData, PreparedGaugeRR } from './model'
import '../scientific-figure.css'
import './gauge-rr.css'

export interface GaugeRRProps {
  data: GaugeRRData
  label?: string
  initialCell?: GaugeCellSelection
  compact?: boolean
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

const valueNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 10, maximumFractionDigits: 10, useGrouping: false })
const deviationNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6, signDisplay: 'exceptZero', useGrouping: false })

function GaugeStudy({ study, label, initialCell, compact = false, source }:
  Omit<GaugeRRProps, 'data'> & { study: PreparedGaugeRR; label: string }) {
  const [picked, setPicked] = useState(initialCell)
  const [scale, setScale] = useState<GaugeScale>('part-centered')
  const operator = study.operators.findIndex(({ id }) => id === picked?.operator)
  const part = study.parts.findIndex(({ id }) => id === picked?.part)
  const active = study.cells[Math.max(0, operator)][Math.max(0, part)]

  return <figure className="gauge-rr" aria-label={label} data-gauge-rr data-compact={compact}>
    <section aria-label="Crossed reading matrix">
      {!compact && <>
        <div className="gauge-section-head">
          <h3>Crossed readings</h3>
          <span>{study.parts.length} parts · {study.operators.length} operators · {study.trials.length} repeats</span>
        </div>
        <div className="gauge-matrix-controls">
          <label>Scale
            <select value={scale} onChange={(event) => setScale(event.currentTarget.value === 'measured' ? 'measured' : 'part-centered')}>
              <option value="part-centered">Deviation from part mean</option>
              <option value="measured">Measured value</option>
            </select>
          </label>
          <span className="gauge-matrix-legend"><i data-mark="reading" /> Reading <i data-mark="mean" /> Cell mean</span>
        </div>
      </>}
      <GaugeMatrix study={study} active={active} scale={scale} compact={compact} onSelect={setPicked} />
    </section>
    {!compact && <>
      <section className="gauge-inspection" aria-label="Inspect crossed readings">
        <div className="gauge-section-head"><h3>Inspect readings</h3></div>
        <div className="gauge-matrix-controls">
          <label>Part
            <select value={active.part} onChange={(event) => setPicked({ ...active, part: event.currentTarget.value })}>
              {study.parts.map(({ id }) => <option key={id}>{id}</option>)}
            </select>
          </label>
          <label>Operator
            <select value={active.operator} onChange={(event) => setPicked({ ...active, operator: event.currentTarget.value })}>
              {study.operators.map(({ id }) => <option key={id}>{id}</option>)}
            </select>
          </label>
        </div>
        <output className="gauge-cell-summary" data-gauge-cell-summary data-part={active.part} data-operator={active.operator}
          data-mean={active.mean} data-part-mean={active.partMean} data-range={active.range}>
          <span>Cell mean <strong>{valueNumber.format(active.mean)} {study.unit}</strong></span>
          <span>Part mean <strong>{valueNumber.format(active.partMean)} {study.unit}</strong></span>
          <span>Repeat range <strong>{valueNumber.format(active.range)} {study.unit}</strong></span>
        </output>
        <div className="gauge-table-wrap"><table className="gauge-table">
          <thead><tr><th scope="col">Trial</th><th scope="col">Reading ({study.unit})</th><th scope="col">From part mean ({study.unit})</th></tr></thead>
          <tbody>{active.readings.map(({ trial, value }, i) => <tr key={trial} data-gauge-trial={trial} data-recorded={value} data-deviation={active.residuals[i]}>
            <th scope="row">{trial}</th><td>{valueNumber.format(value)}</td><td>{deviationNumber.format(active.residuals[i])}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <GaugeVariance study={study} />
      {source && <figcaption className="gauge-source">
        <div><a href={source.href}>{source.label}</a>
          {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
        </div>
        {source.description && <p>{source.description}</p>}
      </figcaption>}
    </>}
  </figure>
}

export function GaugeRR({ data, label = 'Gauge repeatability and reproducibility', ...props }: GaugeRRProps) {
  const study = useMemo(() => prepareGaugeRR(data), [data])
  if (!study) return <p className="chart-render-message" role="status">Supply at least two parts, operators, and shared trials with one finite reading per combination.</p>
  return <GaugeStudy {...props} label={label} study={study} />
}
