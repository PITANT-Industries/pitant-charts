import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { EnergyMapPlot, MeterTrace } from './EnergyPlots'
import { prepareEnergyOperatingMap } from './model'
import type { EnergyOperatingMapData, PreparedEnergyMap } from './model'
import './energy-operating-map.css'

export interface EnergyOperatingMapProps {
  data: EnergyOperatingMapData
  title?: string
  initialRun?: string
  caption?: ReactNode
  compact?: boolean
}

const quantity = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 })

function OperatingFigure({ study, title, initialRun, caption, compact = false }:
  Omit<EnergyOperatingMapProps, 'data'> & { study: PreparedEnergyMap }) {
  const [picked, selectRun] = useState(initialRun)
  const [width, setWidth] = useState(560)
  const graphic = useRef<HTMLDivElement>(null)
  const run = study.runs.find(({ id }) => id === picked) ?? study.runs.find(({ energyPerUnit }) => energyPerUnit !== null) ?? study.runs[0]
  const groupIndex = study.groups.findIndex(({ speed, load }) => speed === run.speed && load === run.load)
  const group = study.groups[groupIndex]
  const complete = group.runs.filter(({ energyPerUnit }) => energyPerUnit !== null).length
  const basis = `Wh / ${study.unit}`

  useEffect(() => {
    const element = graphic.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(120, entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function selectGroup(index: number) {
    const runs = study.groups[index].runs
    selectRun((runs.find(({ energyPerUnit }) => energyPerUnit !== null) ?? runs[0]).id)
  }

  function groupLabel(speed: number, load: number) {
    return `${quantity.format(speed)} ${study.speed.unit} · ${quantity.format(load)} ${study.load.unit}`
  }

  return <figure className="energy-operating-map" data-energy-operating-map data-compact={compact} data-run-count={study.runs.length}
    aria-label={title}>
    {!compact && <div className="energy-heading"><h3>Energy across operating settings</h3>
      <span>{study.groups.length} settings · {study.runs.length} recorded trials</span></div>}
    <div ref={graphic} className="energy-graphic">
      <EnergyMapPlot study={study} selected={groupIndex} width={width} compact={compact} select={compact ? undefined : selectGroup} />
      {!compact && <div className="energy-key">
        {study.extent && <>
          <span>Median {basis}</span>
          <span className="energy-color-scale" data-range={study.extent[0] !== study.extent[1]} aria-hidden="true" />
          <span>{quantity.format(study.extent[0])}{study.extent[0] !== study.extent[1] && <> – {quantity.format(study.extent[1])}</>}</span>
        </>}
        {study.groups.some(({ median }) => median === null) && <span className="energy-gap-key">× Without full coverage</span>}
      </div>}
      {!compact && <section className="energy-inspect" aria-label="Select a recorded power trace">
        <div className="energy-heading"><h3>Inspect a trial</h3>
          <span>{group.median !== null && <>Median {quantity.format(group.median)} {basis} · </>}
            {complete} of {group.runs.length} with full coverage</span></div>
        <div className="energy-controls">
          <label>Operating setting
            <select aria-label="Operating setting" value={groupIndex}
              onChange={(event) => selectGroup(Number(event.currentTarget.value))}>
              {study.groups.map(({ speed, load }, i) => <option key={i} value={i}>{groupLabel(speed, load)}</option>)}
            </select>
          </label>
          <label>Trial
            <select aria-label="Trial" value={run.id} onChange={(event) => selectRun(event.currentTarget.value)}>
              {group.runs.map((trial) => <option key={trial.id} value={trial.id}>{trial.label}</option>)}
            </select>
          </label>
        </div>
        <dl className="energy-metrics" data-energy-readout={run.id} data-energy-per-unit={run.energyPerUnit ?? 'unavailable'}
          data-observed-wh={run.observedWh} data-covered-seconds={run.coveredSeconds} data-units={run.units}>
          <div><dt>Per {study.unit}</dt><dd>{run.energyPerUnit === null ? 'Unavailable' : `${quantity.format(run.energyPerUnit)} Wh`}</dd></div>
          <div><dt>Observed energy</dt><dd>{quantity.format(run.observedWh)} Wh</dd></div>
          <div><dt>Meter coverage</dt><dd>{percent.format(run.coveredSeconds / (run.end - run.start))}</dd></div>
          <div><dt>Output basis</dt><dd>{quantity.format(run.units)} {study.unit}</dd></div>
        </dl>
      </section>}
      {!compact && <div className="energy-heading energy-trace-heading"><h3>Power trace</h3>
        <span>Shading shows integrated energy</span></div>}
      <MeterTrace run={run} width={width} compact={compact} />
    </div>
    {!compact && caption && <figcaption>{caption}</figcaption>}
  </figure>
}

export function EnergyOperatingMap({ data, title = 'Energy per unit operating map', ...props }: EnergyOperatingMapProps) {
  const study = useMemo(() => prepareEnergyOperatingMap(data), [data])
  if (!study) return <p role="status">Provide known operating settings, output quantities, and power readings in a valid time window.</p>
  return <OperatingFigure {...props} title={title} study={study} />
}
