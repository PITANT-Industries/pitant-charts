import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CumulativeFlowPlot } from './CumulativeFlowPlot'
import { flowPointIndex, flowStageJobs, prepareCumulativeFlow } from './model'
import type { CumulativeFlowData, PreparedCumulativeFlow } from './model'
import './cumulative-flow.css'

export interface CumulativeFlowProps {
  data: CumulativeFlowData
  title?: string
  initialTime?: number
  initialStage?: string
  caption?: ReactNode
  compact?: boolean
}

const smallTime = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
function duration(seconds: number) {
  const value = Math.round(Math.abs(seconds) * 1000) / 1000
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor(value / 60) % 60
  const remainder = value - hours * 3600 - minutes * 60
  const parts = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : '', remainder || !hours && !minutes ? `${smallTime.format(remainder)} s` : '']
  return (seconds < 0 ? '−' : '') + parts.filter(Boolean).join(' ')
}

function FlowFigure({ flow, title, initialTime, initialStage, caption, compact = false }:
  Omit<CumulativeFlowProps, 'data'> & { flow: PreparedCumulativeFlow }) {
  const [time, setTime] = useState(initialTime)
  const [pickedStage, setStage] = useState(initialStage)
  const index = flowPointIndex(flow.points, time !== undefined && Number.isFinite(time) ? time : flow.start)
  const point = flow.points[index]
  const stageIndex = flow.stages.findIndex(({ id }) => id === pickedStage)
  const peakStage = point.wip.indexOf(Math.max(...point.wip))
  const selected = stageIndex >= 0 ? stageIndex : peakStage
  const stage = flow.stages[selected]
  const jobs = useMemo(() => compact ? [] : flowStageJobs(flow, point.time, stage.id), [compact, flow, point.time, stage.id])

  function seek(cursor: number, stageId?: string) {
    setTime(flow.points[cursor].time)
    if (stageId) setStage(stageId)
  }

  return <figure className="cumulative-flow" data-cumulative-flow data-compact={compact} aria-label={title}>
    {!compact && <section className="flow-controls" aria-label="Inspect flow at an event">
      <div className="flow-heading">
        <h3>Job flow through the stages</h3>
        <span>Band thickness shows jobs in each stage</span>
      </div>
      <label className="flow-slider">
        <span>Elapsed time <output aria-live="off">{duration(point.time - flow.start)}</output></span>
        <input type="range" min="0" max={flow.points.length - 1} step="1" value={index}
          aria-label="Flow event time" aria-valuetext={duration(point.time - flow.start)}
          onChange={(event) => seek(Number(event.currentTarget.value))} />
      </label>
    </section>}
    <CumulativeFlowPlot flow={flow} index={index} stage={stage.id} compact={compact} seek={seek} />
    {!compact && <>
      <ul className="flow-legend" aria-label="Stages at the selected time">
        {flow.stages.map(({ id, label }, layer) => <li key={id}>
          <button type="button" data-color={layer % 6 + 1} data-flow-pick={id} data-wip={point.wip[layer]}
            aria-pressed={id === stage.id} onClick={() => setStage(id)}>
            <i aria-hidden="true" /><span>{label}</span><strong>{point.wip[layer]}</strong>
          </button>
        </li>)}
        <li className="flow-completed" data-color="0"><i aria-hidden="true" />Completed <strong>{point.completed}</strong></li>
      </ul>
      <section className="flow-readout" aria-label="Selected stage evidence" data-flow-readout data-time={point.time}
        data-stage={stage.id} data-admitted={point.admitted} data-completed={point.completed}
        data-entered={point.entered[selected]} data-exited={point.exited[selected]} data-wip={point.wip[selected]}>
        <div className="flow-heading"><h3>{stage.label}</h3><span>{point.admitted} admitted · {point.completed} completed overall</span></div>
        <dl className="flow-metrics">
          <div><dt>In stage</dt><dd>{point.wip[selected]}</dd></div>
          <div><dt>Entered</dt><dd>{point.entered[selected]}</dd></div>
          <div><dt>Exited</dt><dd>{point.exited[selected]}</dd></div>
        </dl>
        {jobs.length > 0 ? <table className="flow-jobs" aria-label="Jobs in the selected stage">
          <thead><tr><th scope="col">Job</th><th scope="col">Entered at</th><th scope="col">Time in stage</th></tr></thead>
          <tbody>{jobs.map(({ jobId, age, enteredAt }) => <tr key={jobId} data-flow-job={jobId} data-age={age}>
            <th scope="row">{jobId}</th><td>{duration(enteredAt - flow.start)}</td><td>{duration(age)}</td>
          </tr>)}</tbody>
        </table> : <p className="flow-empty">No jobs in this stage at the selected time.</p>}
      </section>
      {caption && <figcaption>{caption}</figcaption>}
    </>}
  </figure>
}

export function CumulativeFlow({ data, title = 'Cumulative flow diagram', ...props }: CumulativeFlowProps) {
  const flow = useMemo(() => prepareCumulativeFlow(data), [data])
  if (!flow) return <p role="status">Provide a valid time window, known stages, and complete job transitions inside the window.</p>
  return <FlowFigure {...props} title={title} flow={flow} />
}
