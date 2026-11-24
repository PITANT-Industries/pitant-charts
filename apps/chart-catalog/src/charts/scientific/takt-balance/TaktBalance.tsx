import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getTaktDestinations, prepareTaktBalance, summarizeTaktBalance } from './model'
import type { PreparedTaktBalance, TaktAssignment, TaktBalanceData } from './model'
import { TaktBalancePlot } from './TaktBalancePlot'
import './takt-balance.css'

export interface TaktBalanceProps {
  data: TaktBalanceData
  title?: string
  initialTask?: string
  caption?: ReactNode
  compact?: boolean
}

const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

function TaktFigure({ study, title, initialTask, caption, compact = false }:
  Omit<TaktBalanceProps, 'data'> & { study: PreparedTaktBalance }) {
  const [picked, selectTask] = useState(initialTask)
  const [scenario, setScenario] = useState<{ study: PreparedTaktBalance; assignment: TaktAssignment }>()
  const baseline = useMemo(() => summarizeTaktBalance(study, study.initial), [study])
  const assignment = scenario?.study === study ? scenario.assignment : study.initial
  const summary = useMemo(() => summarizeTaktBalance(study, assignment), [study, assignment])
  const task = study.tasks.find(({ id }) => id === picked) ?? study.tasks[0]
  const current = assignment[task.id]
  const destinations = getTaktDestinations(study, assignment, task.id)
  const changed = study.tasks.some(({ id }) => assignment[id] !== study.initial[id])

  function move(station: string) {
    if (station === current || !destinations.includes(station)) return
    setScenario({ study, assignment: { ...assignment, [task.id]: station } })
  }

  return <figure className="takt-balance" data-takt-balance data-compact={compact} data-takt={study.takt}
    data-overloaded={summary.overloaded} data-work={summary.totalWork} aria-label={title}>
    {!compact && <section aria-label="Planned takt time">
      <div className="takt-heading"><h3>Station workload</h3><span>{format.format(study.availableSeconds / 60)} net min for {format.format(study.demand)} units</span></div>
      <dl className="takt-metrics">
        <div><dt>Takt time</dt><dd>{format.format(study.takt)} s / unit</dd></div>
        <div><dt>Highest station load</dt><dd>{format.format(summary.maxLoad)} s</dd></div>
        <div><dt>Stations above takt</dt><dd>{summary.overloaded} / {study.stations.length}</dd></div>
      </dl>
    </section>}
    <TaktBalancePlot study={study} summary={summary} baseLoad={baseline.maxLoad} taskId={task.id}
      compact={compact} select={compact ? undefined : selectTask} />
    {!compact && <>
      <section className="takt-inspect" aria-label="Reassign a work element" data-takt-selection={task.id}
        data-current-station={current} data-task-seconds={task.seconds}>
        <div className="takt-heading"><h3>Move a work element</h3>
          <button type="button" disabled={!changed} onClick={() => setScenario(undefined)}>Reset assignments</button>
        </div>
        <div className="takt-controls">
          <label>Task
            <select aria-label="Task" value={task.id} onChange={(event) => selectTask(event.currentTarget.value)}>
              {study.tasks.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>Station
            <select aria-label="Assigned station" value={current} onChange={(event) => move(event.currentTarget.value)}>
              {study.stations.map(({ id, label }) => <option key={id} value={id} disabled={!destinations.includes(id)}>{label}</option>)}
            </select>
          </label>
          <output aria-live="off"><strong>{format.format(task.seconds)} s</strong><span>per unit</span></output>
        </div>
        {destinations.length === 1 && <p className="takt-note">This task stays at its current station under the supplied constraints.</p>}
      </section>
      <table className="takt-stations" aria-label="Workload by station">
        <thead><tr><th scope="col">Station</th><th scope="col">Load</th><th scope="col">Against takt</th></tr></thead>
        <tbody>{summary.stations.map(({ station, load, margin, overloaded }) => <tr key={station.id}
          data-takt-load={station.id} data-overloaded={overloaded} data-seconds={load} data-margin={margin}>
          <th scope="row">{station.label}</th><td>{format.format(load)} s</td>
          <td>{margin === 0 ? 'At takt' : `${format.format(Math.abs(margin))} s ${overloaded ? 'over' : 'spare'}`}</td>
        </tr>)}</tbody>
      </table>
      {caption && <figcaption>{caption}</figcaption>}
    </>}
  </figure>
}

export function TaktBalance({ data, title = 'Takt-time balance chart', ...props }: TaktBalanceProps) {
  const study = useMemo(() => prepareTaktBalance(data), [data])
  if (!study) return <p role="status">Provide valid task times, ordered stations, and consistent production constraints.</p>
  return <TaktFigure {...props} title={title} study={study} />
}
