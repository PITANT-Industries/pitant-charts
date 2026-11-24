import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { prepareStartupOverlay, summarizeStartupOverlay } from './model'
import type { PreparedStartupOverlay, StartupOverlayData } from './model'
import { outcomeLabels, StartupReadiness, StartupTraces } from './StartupPlots'
import './startup-overlay.css'

export interface StartupOverlayProps {
  data: StartupOverlayData
  title?: string
  initialRun?: string
  caption?: ReactNode
  compact?: boolean
}

const shortNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

function elapsed(seconds: number) {
  if (seconds < 60) return `${shortNumber.format(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds - minutes * 60
  return `${minutes} min${remainder ? ` ${shortNumber.format(remainder)} s` : ''}`
}

function StartupFigure({ study, title, initialRun, caption, compact = false }:
  Omit<StartupOverlayProps, 'data'> & { study: PreparedStartupOverlay }) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(550)
  const [chosen, selectRun] = useState(initialRun)
  const [cutoff, setCutoff] = useState(study.deadline)
  const step = study.deadline % 1 ? Math.min(study.step, .001) : 1
  const maximum = Math.ceil(study.runs.reduce((limit, run) =>
    Math.max(limit, run.readyAfter ?? run.followup), Math.max(study.window[1], study.deadline)) / step) * step
  const deadline = Math.min(cutoff, maximum)
  const summary = useMemo(() => summarizeStartupOverlay(study, deadline), [study, deadline])
  const selection = study.runs.findIndex((run) => run.id === chosen)
  const late = summary.outcomes.indexOf('late')
  const activeIndex = selection >= 0 ? selection : Math.max(0, late)
  const selected = study.runs[activeIndex]
  const outcome = summary.outcomes[activeIndex]

  useEffect(() => {
    const element = host.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(entry.contentRect.width, 120))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <figure className="startup-overlay" data-startup-overlay data-compact={compact} data-deadline={deadline}
    data-count={study.runs.length} aria-label={title}>
    {!compact && <section className="startup-controls" aria-label="Compare startup timing">
      <div className="startup-heading">
        <h3>Readiness comparison</h3>
        <span>{study.runs.length} aligned starts</span>
      </div>
      <label className="startup-cutoff">
        <span>Comparison deadline <output aria-live="off">{elapsed(deadline)}</output></span>
        <input type="range" min="0" max={maximum} step={step} value={deadline}
          aria-label="Comparison deadline" aria-valuetext={elapsed(deadline)}
          onChange={(event) => setCutoff(Number(event.currentTarget.value))} />
      </label>
      <ul className="startup-legend" aria-label="Current outcome counts">
        {summary.groups.map(({ outcome, count }) => <li key={outcome} data-startup-outcome={outcome} data-count={count}>
          <i aria-hidden="true" />{outcomeLabels[outcome]} <strong>{count}</strong>
        </li>)}
      </ul>
    </section>}
    <div className="startup-alignment" ref={host}>
      {!compact && <div className="startup-heading">
        <h3>Aligned sensor readings</h3>
        <span>Middle 50% shaded · selected run in bold</span>
      </div>}
      <StartupTraces study={study} summary={summary} selected={selected} deadline={deadline} width={width} compact={compact} />
      {!compact && <div className="startup-heading startup-readiness-heading">
        <h3>Time to readiness</h3>
        <span>One mark per run</span>
      </div>}
      <StartupReadiness study={study} summary={summary} selected={selected} deadline={deadline} width={width} compact={compact}
        select={compact ? undefined : selectRun} />
    </div>
    {!compact && <section className="startup-inspect" aria-label="Inspect a startup">
      <label>Inspect a run
        <select value={selected.id} onChange={(event) => selectRun(event.currentTarget.value)}>
          {study.runs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <output data-startup-selection={selected.id} data-ready-after={selected.readyAfter ?? 'unknown'}
        data-followup={selected.followup} data-startup-outcome={outcome} aria-live="off">
        <strong>{outcomeLabels[outcome]}</strong>
        <span>{selected.readyAfter === undefined
          ? `Observed through ${elapsed(selected.followup)}`
          : `Readiness recorded at ${elapsed(selected.readyAfter)}`}</span>
      </output>
    </section>}
    {!compact && caption && <figcaption>{caption}</figcaption>}
  </figure>
}

export function StartupOverlay({ data, title = 'Event-aligned startup overlays', ...props }: StartupOverlayProps) {
  const study = useMemo(() => prepareStartupOverlay(data), [data])
  if (!study) return <p role="status">Provide a valid time window, aligned run events, and consistent measurements.</p>
  return <StartupFigure {...props} title={title} study={study} />
}
