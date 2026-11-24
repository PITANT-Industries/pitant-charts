import { useMemo, useState } from 'react'
import { ParetoPlot } from './ParetoPlot'
import { calculatePareto, preparePareto } from './model'
import type { ParetoData, ParetoObjective, PreparedPareto } from './model'
import '../scientific-figure.css'
import './pareto-frontier.css'

export interface ParetoFrontierProps {
  data: ParetoData
  label?: string
  compact?: boolean
  initialTrial?: string
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

const valueFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, useGrouping: false })

function displayValue(value: number, objective: ParetoObjective) {
  return `${valueFormat.format(value)}${objective.unit ? ` ${objective.unit}` : ''}`
}

function ParetoFigure({ data, prepared, label, compact = false, source, initialTrial }:
  ParetoFrontierProps & { prepared: PreparedPareto; label: string }) {
  const [requestedTrial, setTrial] = useState(initialTrial)
  const [requestedThreshold, setThreshold] = useState<number>()
  const [requestedGroup, setGroup] = useState('')
  const [view, setView] = useState<'boundary' | 'section'>('boundary')
  const objective = data.objectives[2]
  const options = useMemo(() => Array.from(new Map(data.trials.map((trial, index) =>
    [prepared.positions[index][2], trial.values[2]]))).sort((a, b) => b[0] - a[0]), [data, prepared])
  const index = Math.min(requestedThreshold ?? 0, options.length - 1)
  const [threshold, actualThreshold] = options[index]
  const groups = useMemo(() => [...new Set(data.trials.flatMap(({ group }) => group ? [group] : []))], [data])
  const group = groups.includes(requestedGroup) ? requestedGroup : ''
  const indices = useMemo(() => prepared.positions.flatMap((point, offset) =>
    point[2] <= threshold && (!group || data.trials[offset].group === group) ? [offset] : []), [data, prepared, threshold, group])
  const result = useMemo(() => calculatePareto(prepared, indices), [prepared, indices])
  const selected = indices.find((index) => data.trials[index].id === requestedTrial)
    ?? result.frontier.values().next().value ?? -1
  const trial = data.trials[selected]
  const frontier = result.frontier.has(selected)
  const witness = trial && !frontier ? [...result.frontier].find((index) => {
    const candidate = prepared.losses[index]
    const active = prepared.losses[selected]
    return candidate.every((value, axis) => value <= active[axis]) &&
      candidate.some((value, axis) => value < active[axis])
  }) : undefined
  const thresholdLabel = `${objective.direction === 'maximize' ? 'Minimum' : 'Maximum'} ${objective.label.replace(/^./, (letter) => letter.toLowerCase())}`
  const context = displayValue(actualThreshold, objective)

  return (
    <figure className="pareto-frontier" data-pareto-frontier data-compact={compact} aria-label={label}>
      {!compact && <div className="pareto-controls">
        <label>View
          <select value={view} onChange={(event) => setView(event.currentTarget.value === 'section' ? 'section' : 'boundary')}>
            <option value="boundary">3D attainment boundary</option>
            <option value="section">Threshold section</option>
          </select>
        </label>
        {groups.length > 1 && (
          <label>Trial group
            <select value={group} onChange={(event) => setGroup(event.currentTarget.value)}>
              <option value="">All groups</option>
              {groups.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        )}
        <label className="pareto-threshold">
          <span>{thresholdLabel} <strong>{context}</strong></span>
          <input type="range" min={0} max={options.length - 1} step={1} value={index}
            aria-label={thresholdLabel} aria-valuetext={context} disabled={options.length === 1}
            onChange={(event) => setThreshold(event.currentTarget.valueAsNumber)} />
        </label>
      </div>}
      <ParetoPlot data={data} prepared={prepared} result={result} indices={indices} selected={selected}
        threshold={threshold} view={view} compact={compact} label={label}
        onSelect={(index) => setTrial(data.trials[index].id)} />
      {!compact && <>
        <ul className="pareto-key" aria-label="Figure key">
          <li className="pareto-key-boundary">{view === 'boundary' ? 'Measured attainment boundary' : 'Targets met by a measured trial'}</li>
          <li className="pareto-key-frontier">Nondominated trial</li>
          {result.frontier.size < indices.length && <li className="pareto-key-dominated">Dominated trial</li>}
        </ul>
        <output className="pareto-counts" data-pareto-counts data-threshold={actualThreshold}
          data-nondominated={result.frontier.size} data-eligible={indices.length}>
          <span><strong>{indices.length}</strong> of {data.trials.length} measured trials meet the filters</span>
          <span><strong>{result.frontier.size}</strong> nondominated</span>
        </output>
        {trial ? <>
          <label className="pareto-trial-picker">Inspect trial
            <select value={trial.id} onChange={(event) => setTrial(event.currentTarget.value)}>
              {indices.map((index) => {
                const option = data.trials[index]
                return <option key={option.id} value={option.id}>{option.label || option.id}</option>
              })}
            </select>
          </label>
          <output className="pareto-readout" data-pareto-readout data-trial-id={trial.id}
            data-frontier={frontier} data-dominator={witness === undefined ? undefined : data.trials[witness].id}
            data-value-x={trial.values[0]} data-value-y={trial.values[1]} data-value-z={trial.values[2]}>
            {data.objectives.map((objective, axis) => (
              <span key={axis}>{objective.label} <strong>{displayValue(trial.values[axis], objective)}</strong></span>
            ))}
          </output>
          <p className="pareto-trial-note">{witness !== undefined
            ? `Dominated by ${data.trials[witness].label || data.trials[witness].id}.`
            : frontier ? 'Nondominated among the selected trials.' : 'Dominated among the selected trials.'}
            {trial.setup && <> {trial.setup}</>}
          </p>
        </> : <p className="pareto-trial-note" role="status">No measured trial meets these filters.</p>}
        {source && <figcaption className="pareto-caption">
          <a href={source.href}>{source.label}</a>
          {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
          {source.description && <p>{source.description}</p>}
        </figcaption>}
      </>}
    </figure>
  )
}

export function ParetoFrontier({ data, label = 'Pareto frontier', ...props }: ParetoFrontierProps) {
  const prepared = useMemo(() => preparePareto(data), [data])
  if (!prepared) return <p className="chart-render-message" role="status">Supply three objectives and finite measured trials with unique IDs.</p>
  return <ParetoFigure {...props} data={data} prepared={prepared} label={label} />
}
