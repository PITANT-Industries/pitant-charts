import { useMemo, useState } from 'react'
import { BiplotPlot, ObservationMark } from './BiplotPlot'
import { analyzePca, scalePca } from './model'
import type { PcaAnalysis, PcaBiplotData, PcaObservation, PcaScaling } from './model'
import '../scientific-figure.css'
import './pca-biplot.css'

export interface PcaBiplotProps {
  data: PcaBiplotData
  label?: string
  compact?: boolean
  initialVariable?: string
  initialObservation?: string
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

const valueFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 5, useGrouping: false })
const signedFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, signDisplay: 'exceptZero' })
const pageSize = 8
const scalingOptions = {
  scores: 'Preserve score distances',
  balanced: 'Symmetric scaling',
  loadings: 'Preserve loading distances',
} satisfies Record<PcaScaling, string>

function observationLabel(observation: PcaObservation) {
  return observation.label || observation.id
}

function BiplotFigure({ analysis, data, label, compact = false, source, initialObservation, initialVariable }:
  PcaBiplotProps & { analysis: PcaAnalysis; label: string }) {
  const [scaling, setScaling] = useState<PcaScaling>('scores')
  const [chosenObservation, setObservation] = useState(initialObservation)
  const [chosenVariable, setVariable] = useState(initialVariable)
  const [brushIds, setBrush] = useState<readonly string[]>()
  const [page, setPage] = useState(0)
  const clusters = useMemo(() => [...new Set(data.observations.map(({ group }) => group || 'Ungrouped'))], [data])
  const groups = useMemo(() => data.observations.map(({ group }) => clusters.indexOf(group || 'Ungrouped')), [data, clusters])
  const { points, vectors } = useMemo(() => scalePca(analysis, scaling), [analysis, scaling])
  const active = Math.max(0, data.observations.findIndex(({ id }) => id === chosenObservation))
  const variable = Math.max(0, data.variables.findIndex(({ id }) => id === chosenVariable))
  const observation = data.observations[active]
  const feature = data.variables[variable]
  const brushing = useMemo(() => brushIds === undefined ? undefined : new Set(brushIds), [brushIds])
  const selected = brushing ? data.observations.filter(({ id }) => brushing.has(id)) : [observation]
  const lastPage = Math.max(0, Math.ceil(selected.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const loading = vectors[variable]
  const score = points[active]
  const standardized = score[0] * loading[0] + score[1] * loading[1]
  const loadingMagnitude = Math.hypot(...loading)
  const projectionLength = loadingMagnitude > 0 ? standardized / loadingMagnitude : undefined
  const estimate = analysis.means[variable] + standardized * analysis.standardDeviations[variable]
  const formatValue = (value: number) => `${valueFormat.format(value)}${feature.unit ? ` ${feature.unit}` : ''}`

  function pick(index: number) {
    setObservation(data.observations[index].id)
    setBrush(undefined)
    setPage(0)
  }

  function brush(indices: number[]) {
    const selection = indices.map((index) => data.observations[index].id)
    setBrush(selection)
    setPage(0)
    if (selection.length && !selection.includes(observation.id)) setObservation(selection[0])
  }

  return (
    <figure className="pca-biplot" data-pca-biplot data-compact={compact} aria-label={label}>
      <BiplotPlot data={data} points={points} vectors={vectors} variance={analysis.variance} groups={groups}
        active={active} variable={variable} brushing={brushing} compact={compact} label={label} onPick={pick} onBrush={brush} />
      {!compact && <>
        {clusters.length > 1 && <ul className="pca-key" aria-label="Specimen groups">
          {clusters.map((group, index) => <li key={group}>
            <svg width="11" height="11" aria-hidden="true"><ObservationMark group={index} x={5.5} y={5.5} size={3} /></svg>
            {group}
          </li>)}
        </ul>}
        <div className="pca-controls">
          <label>Scaling
            <select value={scaling} onChange={(event) => setScaling(event.currentTarget.value as PcaScaling)}>
              {Object.entries(scalingOptions).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          </label>
          <label>Variable
            <select value={feature.id} onChange={(event) => setVariable(event.currentTarget.value)}>
              {data.variables.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>Specimen
            <select value={observation.id} onChange={(event) => setObservation(event.currentTarget.value)}>
              {data.observations.map((row) => <option key={row.id} value={row.id}>{observationLabel(row)}</option>)}
            </select>
          </label>
        </div>
        <output className="pca-readout" data-pca-readout data-pca-observation={observation.id} data-pca-variable={feature.id}
          data-pca-scaling={scaling} data-pca-observed={observation.values[variable]} data-pca-estimate={estimate}
          data-pca-standardized={standardized} data-pca-projection-length={projectionLength}
          data-pca-variance-x={analysis.variance[0]} data-pca-variance-y={analysis.variance[1]}>
          <span>Measured <strong>{formatValue(observation.values[variable])}</strong></span>
          <span>Two-component estimate <strong>{formatValue(estimate)}</strong></span>
          <span>Signed standardized estimate <strong>{signedFormat.format(standardized)}</strong></span>
          {projectionLength !== undefined && (
            <span>Signed score projection <strong>{signedFormat.format(projectionLength)}</strong></span>
          )}
        </output>
        <section className="pca-selection" aria-label="Selected original observations">
          <div className="pca-selection-header">
            <strong>{brushing ? `${selected.length} brushed specimens` : 'Selected specimen'}</strong>
            {brushing && <button type="button" onClick={() => pick(active)}>Clear brush</button>}
          </div>
          <p>Drag a box over the plot to inspect source rows.</p>
          {selected.length > 0 && (
            <table>
              <thead><tr><th scope="col">Specimen</th><th scope="col">Group</th><th scope="col">{feature.label}</th></tr></thead>
              <tbody>
                {selected.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((row) => (
                  <tr key={row.id} data-pca-original-row={row.id} data-pca-original-value={row.values[variable]}>
                    <th scope="row"><button type="button" aria-pressed={row.id === observation.id}
                      onClick={() => setObservation(row.id)}>{observationLabel(row)}</button></th>
                    <td>{row.group || 'Ungrouped'}</td>
                    <td>{formatValue(row.values[variable])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lastPage > 0 && <div className="pca-pagination" aria-label="Brushed specimen pages">
            <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>{currentPage + 1} / {lastPage + 1}</span>
            <button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>}
        </section>
        {source && <figcaption className="pca-caption">
          <a href={source.href}>{source.label}</a>
          {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
          {source.description && <p>{source.description}</p>}
        </figcaption>}
      </>}
    </figure>
  )
}

export function PcaBiplot({ data, label = 'Principal component biplot', ...props }: PcaBiplotProps) {
  const analysis = useMemo(() => analyzePca(data), [data])
  if (!analysis) return <p className="chart-render-message" role="status">Supply finite measurements with unique IDs and at least two independent components.</p>
  return <BiplotFigure data={data} label={label} analysis={analysis} {...props} />
}
