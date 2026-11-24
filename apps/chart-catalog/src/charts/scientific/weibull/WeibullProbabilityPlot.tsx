import { useMemo, useState } from 'react'
import { WeibullPaper, weibullColor } from './WeibullPaper'
import { prepareWeibull } from './model'
import type { PreparedWeibull, WeibullFailureMark } from './model'
import type { ReliabilityData } from '../kaplan-meier/model'
import '../scientific-figure.css'
import './weibull-probability.css'

export interface WeibullProbabilityPlotProps {
  data: ReliabilityData
  label?: string
  initialCohort?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })
const tableNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })
const shapeNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 })
const guides = [.01, .05, .1, .25, .5, .6321205588285577, .9, .95]

function WeibullFigure({ study, label, source, initialCohort, compact = false }:
  Omit<WeibullProbabilityPlotProps, 'data'> & { study: PreparedWeibull; label: string }) {
  const [chosenCohort, setCohort] = useState(initialCohort)
  const [chosenMark, setMark] = useState<string>()
  const [guide, setGuide] = useState(.1)
  const active = study.cohorts.find(({ id }) => id === chosenCohort) ?? study.cohorts[0]
  const mark = active.marks.find(({ id }) => id === chosenMark) ?? active.marks[0]
  const ratio = mark?.logResidual === undefined ? undefined : Math.exp(mark.logResidual)

  function select(cohort: string, mark: WeibullFailureMark) {
    setCohort(cohort)
    setMark(mark.id)
  }

  return <figure className="weibull-probability" data-weibull-probability data-compact={compact} aria-label={label}>
    <section aria-label="Weibull probability paper">
      {!compact && <>
        <div className="weibull-section-head"><h3>Weibull probability paper</h3><span>Two-parameter fit</span></div>
        <div className="weibull-legend">
          {study.cohorts.map((cohort, index) => <span key={cohort.id} style={{ color: weibullColor(index) }}>
            <i data-weibull-key={index % 3} />{cohort.label}
          </span>)}
          {study.cohorts.some(({ censors }) => censors.length > 0) && <span><i className="weibull-legend-censor" />Right-censored</span>}
        </div>
      </>}
      <WeibullPaper study={study} active={active} selected={mark} guide={guide} compact={compact} onSelect={select} />
      {!compact && <p className="weibull-caption">Markers show recorded failures at empirical plotting positions. Dashed fits extend beyond observed times.</p>}
    </section>
    {!compact && <>
      <section className="weibull-inspector" aria-label="Compare an observed failure with its fitted time">
        <div className="weibull-section-head"><h3>Inspect a failure</h3></div>
        <div className="weibull-controls">
          <label>Cohort
            <select value={active.id} onChange={(event) => {
              setCohort(event.currentTarget.value)
              setMark(undefined)
            }}>
              {study.cohorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          {active.marks.length > 0 && <label>Failure
            <select value={mark?.id} onChange={(event) => setMark(event.currentTarget.value)}>
              {active.marks.map((item) => <option key={item.id} value={item.id}>
                {item.id} · {number.format(item.time)} {study.timeUnit}
              </option>)}
            </select>
          </label>}
          <label>Lifetime guide
            <select value={guide} onChange={(event) => setGuide(Number(event.currentTarget.value))}>
              {guides.map((probability) => <option key={probability} value={probability}>
                B{shapeNumber.format(probability === guides[5] ? 63.2 : probability * 100)}
              </option>)}
            </select>
          </label>
        </div>
        {mark ? <output className="weibull-readout" data-weibull-inspection={mark.id} data-cohort={active.id} data-time={mark.time}
          data-probability={mark.probability} data-fitted={mark.fittedTime} data-ratio={ratio} data-log-residual={mark.logResidual}>
          <span>Observed time <strong>{number.format(mark.time)} {study.timeUnit}</strong></span>
          <span>Plotting position <strong>{percent.format(mark.probability)}</strong></span>
          <span>Fitted time at that probability <strong>{mark.fittedTime === undefined ? '—' : `${number.format(mark.fittedTime)} ${study.timeUnit}`}</strong></span>
          <span>Observed ÷ fitted <strong>{ratio === undefined ? '—' : `${shapeNumber.format(ratio)}×`}</strong></span>
        </output> : <p className="weibull-caption" role="status">This cohort contains right-censored observations only.</p>}
      </section>
      <section className="weibull-parameters" aria-label="Fitted Weibull lifetime statistics">
        <div className="weibull-section-head"><h3>Fitted lifetimes</h3><span>Maximum likelihood</span></div>
        <div className="weibull-table-wrap"><table className="weibull-table">
          <thead><tr><th scope="col">Cohort</th><th scope="col">Shape β</th><th scope="col">Scale η ({study.timeUnit})</th>
            <th scope="col">B10 ({study.timeUnit})</th><th scope="col">B50 ({study.timeUnit})</th></tr></thead>
          <tbody>{study.cohorts.map(({ id, label, fit, failures, censored }, index) => <tr key={id} data-weibull-fit-row={id}
            data-shape={fit?.shape} data-scale={fit?.scale} data-b10={fit?.b10} data-b50={fit?.b50}
            data-failures={failures} data-censored={censored} data-active={id === active.id}>
            <th scope="row"><span style={{ color: weibullColor(index) }}>{label}</span>
              <small>{failures} failed · {censored} censored</small></th>
            <td>{fit ? shapeNumber.format(fit.shape) : '—'}</td>
            <td>{fit?.scale !== undefined ? tableNumber.format(fit.scale) : '—'}</td>
            <td>{fit?.b10 !== undefined ? tableNumber.format(fit.b10) : '—'}</td>
            <td>{fit?.b50 !== undefined ? tableNumber.format(fit.b50) : '—'}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="weibull-caption">B10 and B50 are fitted times at 10% and 50% cumulative failure probability.</p>
      </section>
      {source && <figcaption className="weibull-source">
        <div><a href={source.href}>{source.label}</a>
          {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
        </div>
        {source.description && <p>{source.description}</p>}
      </figcaption>}
    </>}
  </figure>
}

export function WeibullProbabilityPlot({ data, label = 'Weibull probability plot', ...props }: WeibullProbabilityPlotProps) {
  const study = useMemo(() => prepareWeibull(data), [data])
  if (!study) return <p className="chart-render-message" role="status">Supply cohorts with unique specimen IDs and positive failure or right-censor times.</p>
  return <WeibullFigure {...props} label={label} study={study} />
}
