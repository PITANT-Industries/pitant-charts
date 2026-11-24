import { useMemo, useState } from 'react'
import { ReliabilityPlot, SpecimenTimeline, reliabilityColor } from './ReliabilityPlot'
import { prepareReliability, reliabilityAtTime } from './model'
import type { PreparedReliability, ReliabilityData, ReliabilityObservation } from './model'
import '../scientific-figure.css'
import './kaplan-meier.css'

export interface KaplanMeierReliabilityProps {
  data: ReliabilityData
  label?: string
  initialCohort?: string
  initialTime?: number
  compact?: boolean
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })

function KaplanMeierFigure({ study, label, initialCohort, initialTime, compact = false, source }:
  Omit<KaplanMeierReliabilityProps, 'data'> & { study: PreparedReliability; label: string }) {
  const timeChoices = useMemo(() => {
    const choices = new Set([0, ...study.eventTimes])
    if (initialTime !== undefined && Number.isFinite(initialTime) && initialTime >= 0 && initialTime <= study.followUp) choices.add(initialTime)
    return Array.from(choices).sort((a, b) => a - b)
  }, [study, initialTime])
  const [pickedTime, setTime] = useState(initialTime)
  const [pickedCohort, setCohort] = useState(initialCohort)
  const [pickedSpecimen, setSpecimen] = useState<string>()
  const timeIndex = Math.max(0, timeChoices.indexOf(pickedTime ?? study.eventTimes[0]))
  const time = timeChoices[timeIndex]
  const cohort = study.cohorts.find(({ id }) => id === pickedCohort) ?? study.cohorts[0]
  const specimen = cohort.observations.find(({ id }) => id === pickedSpecimen) ??
    cohort.observations.find(({ time: recorded }) => recorded === time)
  const activeState = reliabilityAtTime(cohort, time)

  function selectTime(value: number) {
    setTime(value)
    setSpecimen(undefined)
  }

  function selectSpecimen(value: ReliabilityObservation) {
    setSpecimen(value.id)
    setTime(value.time)
  }

  return <figure className="kaplan-meier" aria-label={label} data-km-reliability data-compact={compact}>
    <section className="km-estimate" aria-label="Reliability and risk table">
      {!compact && <>
        <div className="km-section-head"><h3>Reliability by cohort</h3></div>
        <div className="km-estimate-legend">
          {study.cohorts.map((item, index) => <span key={item.id} style={{ color: reliabilityColor(index) }}>
            <i className="km-series-key" data-pattern={index % 4} />{item.label}
          </span>)}
          <span><i className="km-censor-key" />Right-censored</span>
        </div>
      </>}
      <ReliabilityPlot study={study} active={cohort} time={time} timeChoices={timeChoices} compact={compact} onSelect={selectTime} />
      {!compact && <p className="km-plot-caption">
        At-risk counts are taken immediately before each time. Shading shows the 95% pointwise interval for {cohort.label} where defined.
      </p>}
    </section>
    {!compact && <>
      <section className="km-event-inspection" aria-label="Risk set at the selected time">
        <div className="km-section-head"><h3>Inspect a time</h3><output data-km-time={time}>{number.format(time)} {study.timeUnit}</output></div>
        <label className="km-time-control">Event time
          <input type="range" min={0} max={timeChoices.length - 1} step={1} value={timeIndex}
            aria-valuetext={`${number.format(time)} ${study.timeUnit}`}
            onChange={(event) => selectTime(timeChoices[event.currentTarget.valueAsNumber])} />
        </label>
        <div className="km-table-wrap"><table className="km-table">
          <thead><tr><th scope="col">Cohort</th><th scope="col">At risk</th><th scope="col">Failed</th><th scope="col">Censored</th>
            <th scope="col">After</th><th scope="col">Reliability</th></tr></thead>
          <tbody>{study.cohorts.map((item) => {
            const state = reliabilityAtTime(item, time)
            if (!state) return null
            return <tr key={item.id} data-km-event-row={item.id} data-at-risk={state.atRisk} data-after={state.atRiskAfter}
              data-failures={state.failedIds.length} data-censored={state.censoredIds.length}
              data-survival={state.survival} data-lower={state.confidence?.[0]} data-upper={state.confidence?.[1]}
              data-active={item.id === cohort.id}>
              <th scope="row">{item.label}</th><td>{state.atRisk}</td><td>{state.failedIds.length}</td><td>{state.censoredIds.length}</td>
              <td>{state.atRiskAfter}</td><td>{state.survival === undefined ? '—' : percent.format(state.survival)}</td>
            </tr>
          })}</tbody>
        </table></div>
        {activeState?.confidence && <p className="km-interval-readout">
          {cohort.label} · 95% pointwise interval {percent.format(activeState.confidence[0])}–{percent.format(activeState.confidence[1])}
        </p>}
      </section>
      <section className="km-specimen-section" aria-label="Individual specimen lifetimes">
        <div className="km-section-head"><h3>Specimen timelines</h3><span>Test time ({study.timeUnit})</span></div>
        <div className="km-specimen-controls">
          <label>Cohort
            <select value={cohort.id} onChange={(event) => {
              setCohort(event.currentTarget.value)
              setSpecimen(undefined)
            }}>
              {study.cohorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Specimen
            <select value={specimen?.id ?? ''} onChange={(event) => {
              const selected = cohort.observations.find(({ id }) => id === event.currentTarget.value)
              if (selected) selectSpecimen(selected)
            }}>
              <option value="" disabled>Select a specimen</option>
              {cohort.observations.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
            </select>
          </label>
          <span className="km-estimate-legend"><span><i className="km-failure-key" />Failed</span><span><i className="km-censor-key" />Right-censored</span></span>
        </div>
        <SpecimenTimeline study={study} cohort={cohort} time={time} selected={specimen} onSelect={selectSpecimen} />
        <output className="km-cohort-summary" data-km-cohort-summary={cohort.id}
          data-failures={cohort.failures} data-censored={cohort.censored} data-median={cohort.median} data-follow-up={cohort.followUp}>
          <span>{cohort.observations.length} specimens</span>
          <span>{cohort.failures} failed</span>
          <span>{cohort.censored} right-censored</span>
          <span>Median {cohort.median === undefined ? 'unreached' : `${number.format(cohort.median)} ${study.timeUnit}`}</span>
        </output>
        {specimen && <output className="km-specimen-detail" data-km-specimen-detail={specimen.id} data-time={specimen.time} data-status={specimen.status}>
          <strong>{specimen.id}</strong> · {specimen.status === 'failed' ? 'Failed' : 'Right-censored'} at {number.format(specimen.time)} {study.timeUnit}
        </output>}
      </section>
      {source && <figcaption className="km-caption">
        <div><a href={source.href}>{source.label}</a>
          {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
        </div>
        {source.description && <p>{source.description}</p>}
      </figcaption>}
    </>}
  </figure>
}

export function KaplanMeierReliability({ data, label = 'Kaplan–Meier reliability', ...props }: KaplanMeierReliabilityProps) {
  const study = useMemo(() => prepareReliability(data), [data])
  if (!study) return <p className="chart-render-message" role="status">Supply cohorts with unique specimen IDs and observed failure or right-censor times.</p>
  return <KaplanMeierFigure {...props} study={study} label={label} />
}
