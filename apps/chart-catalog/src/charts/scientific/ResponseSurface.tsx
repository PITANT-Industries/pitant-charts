import { useMemo, useState } from 'react'
import { ResponseSection } from './ResponseSection'
import { ResponseViewport } from './ResponseViewport'
import { analyseResponseSurface, responseAxisLabel, responseContains, responsePosition, responseSection } from './response-surface-model'
import type { ResponseFactor, ResponsePosition, ResponseSurfaceData, ResponseVertex } from './response-surface-model'
import './scientific-figure.css'
import './response-surface.css'

export type { ResponseAxis, ResponseFactor, ResponsePosition, ResponseSurfaceData, ResponseTrial } from './response-surface-model'

export interface ResponseSurfaceProps {
  data: ResponseSurfaceData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Analysis = NonNullable<ReturnType<typeof analyseResponseSurface>>
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const readValue = (value: number, unit?: string) => `${decimal.format(value).replace('-', '−')}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
const emptySection: readonly ResponseVertex[] = []
const noInterval = [0, 0] as const

function SurfaceFigure({ data, label, compact = false, source, analysis }: ResponseSurfaceProps & { analysis: Analysis; label: string }) {
  const [axis, setAxis] = useState<ResponseFactor>(analysis.sectionAxis)
  const [location, setLocation] = useState(analysis.initial)
  const [selectedTrialId, setSelectedTrial] = useState<string>()
  const [camera, setCamera] = useState({ yaw: .64, pitch: .57 })
  const trial = data.trials.find(({ id }) => id === selectedTrialId)
  const current: ResponsePosition = trial ? [trial.x, trial.y] : responseContains(analysis.hull, location) ? location : analysis.initial
  const fixed = axis === 'x' ? 0 : 1
  const position = current[fixed]
  const fixedAxis = axis === 'x' ? data.xAxis : data.yAxis
  const interval = useMemo(() => compact ? noInterval : responseSection(analysis.hull, axis, position) ?? noInterval,
    [analysis.hull, axis, position, compact])
  const section = useMemo(() => {
    if (compact) return emptySection
    const [start, end] = interval
    return Array.from({ length: start === end ? 1 : 81 }, (_, index): ResponseVertex => {
      const [x, y] = responsePosition(axis, position, start + (end - start) * index / 80)
      return [x, y, data.evaluate(x, y)]
    })
  }, [data, axis, position, interval, compact])
  const [min, max] = analysis.bounds[fixed]
  const fit = data.evaluate(...current)
  const marker: ResponseVertex = [current[0], current[1], fit]
  const residual = trial && trial.response - fit

  function choose(point: ResponsePosition) {
    if (!responseContains(analysis.hull, point)) return
    setSelectedTrial(undefined)
    setLocation(point)
  }

  function chooseTrial(id: string) {
    const picked = data.trials.find((candidate) => candidate.id === id)
    if (!picked) {
      setSelectedTrial(undefined)
      setLocation(current)
      return
    }
    setSelectedTrial(id)
    setLocation([picked.x, picked.y])
  }

  function moveSection(value: number) {
    const span = responseSection(analysis.hull, axis, value)
    if (!span) return
    const varying = Math.max(span[0], Math.min(span[1], current[1 - fixed]))
    choose(responsePosition(axis, value, varying))
  }

  return (
    <figure className="response-surface" data-response-surface="" data-compact={compact} aria-label={label}>
      <div className="response-surface-panel">
        {!compact && <div className="response-panel-title"><b>A</b> Fitted response surface</div>}
        <ResponseViewport data={data} bounds={analysis.bounds} mesh={analysis.mesh} range={analysis.fitRange} camera={camera}
          section={section} selected={marker} trial={trial} compact={compact} rotate={setCamera} choose={choose} chooseTrial={chooseTrial} />
        {!compact && <>
          <div className="response-axis-key">
            <span>X · {responseAxisLabel(data.xAxis)}</span>
            <span>Y · {responseAxisLabel(data.yAxis)}</span>
            <span>Z · {responseAxisLabel(data.responseAxis)}</span>
          </div>
          <div className="response-view-controls">
            <button type="button" onClick={() => setCamera(({ yaw, pitch }) => ({ yaw: yaw - .22, pitch }))}>Rotate left</button>
            <button type="button" onClick={() => setCamera(({ yaw, pitch }) => ({ yaw: yaw + .22, pitch }))}>Rotate right</button>
            {data.trials.length > 0 && <label className="response-trial-control">Trial
              <select value={trial?.id ?? ''} onChange={(event) => chooseTrial(event.currentTarget.value)}>
                <option value="">Fitted point</option>
                {data.trials.map(({ id }) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>}
          </div>
        </>}
      </div>
      {!compact && <>
        <div className="response-detail">
          <div className="response-surface-panel">
            <div className="response-panel-title"><b>B</b> Section through the surface</div>
            <ResponseSection data={data} bounds={analysis.bounds} axis={axis} position={position} interval={interval}
              section={section} selected={marker} trial={trial} choose={(value) => choose(responsePosition(axis, position, value))}
              chooseTrial={chooseTrial} />
            <div className="response-section-controls">
              <label className="response-axis-control">Fixed factor
                <select value={axis} onChange={(event) => setAxis(event.currentTarget.value as ResponseFactor)}>
                  <option value="x">{data.xAxis.label}</option>
                  <option value="y">{data.yAxis.label}</option>
                </select>
              </label>
              <label className="response-position-control">
                <span>Section position</span><span aria-hidden="true">{readValue(position, fixedAxis.unit)}</span>
                <input type="range" min={min} max={max} step="any" value={position} aria-label="Section position"
                  aria-valuetext={readValue(position, fixedAxis.unit)} onChange={(event) => moveSection(event.currentTarget.valueAsNumber)} />
              </label>
            </div>
          </div>
          <output className="response-readout" data-response-readout="" data-x={current[0]} data-y={current[1]}
            data-fitted={fit} data-trial={trial?.id} data-measured={trial?.response} data-residual={residual} data-axis={axis} data-position={position}>
            <span className="response-readout-title">Selected response</span>
            <span className="response-reading">{data.xAxis.label}<strong>{readValue(current[0], data.xAxis.unit)}</strong></span>
            <span className="response-reading">{data.yAxis.label}<strong>{readValue(current[1], data.yAxis.unit)}</strong></span>
            <span className="response-reading">Fitted<strong>{readValue(fit, data.responseAxis.unit)}</strong></span>
            {trial && residual !== undefined && <>
              <span className="response-reading">Trial<strong>{trial.id}</strong></span>
              <span className="response-reading">Observed<strong>{readValue(trial.response, data.responseAxis.unit)}</strong></span>
              <span className="response-reading">Residual<strong>{residual > 0 ? '+' : ''}{readValue(residual, data.responseAxis.unit === '%' ? 'pp' : data.responseAxis.unit)}</strong></span>
            </>}
          </output>
        </div>
        <figcaption className="response-caption">
          {data.trials.length > 0 && <p>Open circles show observed trials. Vertical segments show the difference between observed and fitted responses.</p>}
          {source && <p>
            <a href={source.href}>{source.label}</a>
            {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
            {source.description && <> · {source.description}</>}
          </p>}
        </figcaption>
      </>}
    </figure>
  )
}

export function ResponseSurface({ data, label = '3D response surface', ...props }: ResponseSurfaceProps) {
  const analysis = useMemo(() => analyseResponseSurface(data), [data])
  if (!analysis) return <p className="chart-render-message" role="status">Provide a factor domain and a finite response function over it.</p>
  return <SurfaceFigure data={data} analysis={analysis} label={label} {...props} />
}
