import { useMemo, useState } from 'react'
import { HotellingProjection, HotellingSequence } from './HotellingPlots'
import { prepareHotelling } from './model'
import type { HotellingData, HotellingRun, PreparedHotelling } from './model'
import '../scientific-figure.css'
import './hotelling-monitor.css'

export interface HotellingProcessMonitorProps {
  data: HotellingData
  label?: string
  initialRun?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

const number = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7 })
const signed = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6, signDisplay: 'exceptZero' })
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 })

function contributionOrder(run: HotellingRun) {
  return run.contributions.map((_, index) => index).sort((a, b) => Math.abs(run.contributions[b]) - Math.abs(run.contributions[a]))
}

function ContributionEvidence({ study, run }: { study: PreparedHotelling; run: HotellingRun }) {
  const order = contributionOrder(run)
  const extent = Math.max(1e-30, ...run.contributions.map(Math.abs))
  const total = run.contributions.reduce((sum, value) => sum + value, 0)
  return <section className="hotelling-contribution" aria-label="Signed channel contributions" data-hotelling-contributions={run.id}
    data-extent={extent} data-sum={total}>
    <div className="hotelling-section-head"><h3>Signed contributions</h3><span>Sum to T²</span></div>
    <div className="hotelling-contribution-axis" aria-hidden="true">
      <span>{signed.format(-extent)}</span><span>0</span><span>{signed.format(extent)}</span>
    </div>
    <ol className="hotelling-channel-list">
      {order.map((index) => {
        const channel = study.channels[index]
        const term = run.contributions[index]
        const observed = run.values[index]
        const baseline = channel.mean
        const magnitude = Math.abs(term) / extent * 50
        return <li key={channel.id} data-hotelling-contribution={channel.id} data-value={term}
          data-observed={observed} data-baseline={baseline} data-z={run.z[index]}>
          <div className="hotelling-channel-head"><strong>{channel.label}</strong><span>{signed.format(term)}</span></div>
          <div className="hotelling-contribution-track" aria-hidden="true">
            <span data-hotelling-bar data-negative={term < 0} style={{
              inlineSize: `${magnitude}%`, insetInlineStart: `${term < 0 ? 50 - magnitude : 50}%`,
            }} />
          </div>
          <p>
            Reading {number.format(observed)}{channel.unit ? ` ${channel.unit}` : ''} ·
            {' '}Reference {number.format(baseline)}{channel.unit ? ` ${channel.unit}` : ''} · z {signed.format(run.z[index])}
          </p>
        </li>
      })}
    </ol>
  </section>
}

function HotellingFigure({ study, label, initialRun, compact = false, source }:
  Omit<HotellingProcessMonitorProps, 'data'> & { study: PreparedHotelling; label: string }) {
  const fallback = study.runs.find(({ id }) => id === initialRun) ?? study.runs.find(({ flagged }) => flagged) ?? study.runs[0]
  const [selected, selectRun] = useState(initialRun)
  const [pickedAxes, setAxes] = useState<readonly [number, number]>()
  const run = study.runs.find(({ id }) => id === selected) ?? fallback
  const order = contributionOrder(fallback)
  const defaultAxes = [order[0], order[1]] as const
  const axes = pickedAxes?.every((index) => index < study.channels.length) ? pickedAxes : defaultAxes
  const flagged = study.runs.filter((item) => item.flagged)
  const within = study.runs.filter((item) => !item.flagged)

  function changeAxis(axis: 0 | 1, channel: number) {
    if (channel === axes[1 - axis]) setAxes([axes[1], axes[0]])
    else setAxes(axis === 0 ? [channel, axes[1]] : [axes[0], channel])
  }

  return <figure className="hotelling-monitor" data-hotelling-monitor data-compact={compact} aria-label={label}>
    <section aria-label="Phase II monitored run sequence">
      {!compact && <>
        <div className="hotelling-section-head"><h3>Multivariate control chart</h3>
          <span>{study.reference.length} reference · {study.runs.length} monitored · {study.channels.length} channels</span>
        </div>
        <div className="hotelling-legend">
          <span><i data-key="within" /> At or below limit</span>
          <span><i data-key="flagged" /> Above limit</span>
          <span><i data-key="limit" /> Upper control limit</span>
        </div>
      </>}
      <HotellingSequence study={study} active={run} compact={compact} onSelect={selectRun} />
    </section>
    {compact && <section aria-label="Two-channel projection of the control boundary">
      <HotellingProjection study={study} active={run} axes={axes} compact />
    </section>}
    {!compact && <>
      <section className="hotelling-inspector" aria-label="Inspect a monitored run">
        <div className="hotelling-section-head"><h3>Inspect a run</h3><span>One-sided Phase II limit · α {percent.format(study.alpha)}</span></div>
        <div className="hotelling-controls">
          <label>Run
            <select value={run.id} onChange={(event) => selectRun(event.currentTarget.value)}>
              {flagged.length > 0 && <optgroup label="Above limit">{flagged.map(({ id }) => <option key={id}>{id}</option>)}</optgroup>}
              {within.length > 0 && <optgroup label="At or below limit">{within.map(({ id }) => <option key={id}>{id}</option>)}</optgroup>}
            </select>
          </label>
        </div>
        <output className="hotelling-readout" data-hotelling-readout={run.id} data-score={run.score} data-limit={study.limit}
          data-flagged={run.flagged} data-alpha={study.alpha}>
          <span>Hotelling T² <strong>{number.format(run.score)}</strong></span>
          <span>Upper control limit <strong>{number.format(study.limit)}</strong></span>
          <span>Signal <strong>{run.flagged ? 'Above limit' : 'At or below limit'}</strong></span>
        </output>
      </section>
      <div className="hotelling-linked">
        <section aria-label="Two-channel projection of the control boundary">
          <div className="hotelling-section-head"><h3>Projected control boundary</h3></div>
          <div className="hotelling-controls">
            <label>Projection X
              <select value={axes[0]} onChange={(event) => changeAxis(0, Number(event.currentTarget.value))}>
                {study.channels.map(({ id, label }, index) => <option key={id} value={index}>{label}</option>)}
              </select>
            </label>
            <label>Projection Y
              <select value={axes[1]} onChange={(event) => changeAxis(1, Number(event.currentTarget.value))}>
                {study.channels.map(({ id, label }, index) => <option key={id} value={index}>{label}</option>)}
              </select>
            </label>
          </div>
          <HotellingProjection study={study} active={run} axes={axes} />
          <div className="hotelling-legend">
            <span><i data-key="reference" /> Reference observation</span>
            <span><i data-key={run.flagged ? 'flagged' : 'within'} /> Selected run</span>
          </div>
          <p className="hotelling-note">Both axes use reference standard deviations. The run signal uses all monitored channels.</p>
        </section>
        <ContributionEvidence study={study} run={run} />
      </div>
      {source && <figcaption className="hotelling-source">
        <div><a href={source.href}>{source.label}</a>
          {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
        </div>
        {source.description && <p>{source.description}</p>}
      </figcaption>}
    </>}
  </figure>
}

export function HotellingProcessMonitor({ data, label = 'Hotelling multivariate process monitor', ...props }: HotellingProcessMonitorProps) {
  const study = useMemo(() => prepareHotelling(data), [data])
  if (!study) return <p className="chart-render-message" role="status">Supply finite readings with enough reference rows and a full-rank covariance matrix.</p>
  return <HotellingFigure {...props} label={label} study={study} />
}
