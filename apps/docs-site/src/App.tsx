import '@pitant/charts/styles/tokens.css'
import type { JSX } from 'react'
import { useMemo, useState } from 'react'
import PitantDashboardOverviewBlock from '../../../registry/pitant/dashboard-overview/dashboard-overview.js'
import PitantDataZoomBlock from '../../../registry/pitant/datazoom/datazoom.js'
import PitantDigitalChannelBlock from '../../../registry/pitant/digital-channel/digital-channel.js'
import PitantExportBlock from '../../../registry/pitant/export/export.js'
import PitantMultiAxisBlock from '../../../registry/pitant/multi-axis/multi-axis.js'
import PitantStreamingTrendBlock from '../../../registry/pitant/streaming-trend/streaming-trend.js'
import PitantSynchronizedDashboardBlock from '../../../registry/pitant/synchronized-dashboard/synchronized-dashboard.js'
import PitantTimeSeriesBlock from '../../../registry/pitant/time-series/time-series.js'

type ExampleId =
  | 'time-series'
  | 'digital-channel'
  | 'synchronized-dashboard'
  | 'datazoom'
  | 'streaming-trend'
  | 'multi-axis'
  | 'export'
  | 'dashboard-overview'

interface ExampleDefinition {
  id: ExampleId
  title: string
  maturity: 'production path' | 'composition path' | 'preview path'
  useWhen: string
  doNotUseWhen: string
  component: () => JSX.Element
}

const EXAMPLES: readonly ExampleDefinition[] = [
  {
    id: 'time-series',
    title: 'TimeSeries',
    maturity: 'production path',
    useWhen:
      'continuous historian trends, analog process values, quality/gap/provenance inspection',
    doNotUseWhen: 'the data is a discrete state lane or the shell is not React',
    component: PitantTimeSeriesBlock,
  },
  {
    id: 'digital-channel',
    title: 'DigitalChannel',
    maturity: 'production path',
    useWhen: 'interlocks, permissives, modes, alarms, binary states, and equipment lanes',
    doNotUseWhen: 'the signal needs analog interpolation or a numeric y-axis',
    component: PitantDigitalChannelBlock,
  },
  {
    id: 'synchronized-dashboard',
    title: 'Synchronized Dashboard',
    maturity: 'composition path',
    useWhen: 'one workflow needs shared x-range and cursor state across chart panels',
    doNotUseWhen: 'panels cross tenant, site, evidence, or authorization boundaries',
    component: PitantSynchronizedDashboardBlock,
  },
  {
    id: 'datazoom',
    title: 'DataZoom',
    maturity: 'composition path',
    useWhen: 'users need overview-plus-detail navigation over a large time window',
    doNotUseWhen: 'the chart is compact or already constrained to a narrow live window',
    component: PitantDataZoomBlock,
  },
  {
    id: 'streaming-trend',
    title: 'Streaming Trend',
    maturity: 'composition path',
    useWhen: 'a live historian tail appends new typed-array chunks at the right edge',
    doNotUseWhen: 'a backfill rewrites earlier timestamps or changes the schema',
    component: PitantStreamingTrendBlock,
  },
  {
    id: 'multi-axis',
    title: 'Multi-Axis Panels',
    maturity: 'preview path',
    useWhen: 'signals with different units need synchronized x-ranges and separate y-ranges',
    doNotUseWhen: 'a single-canvas dual-axis overlay is a hard requirement',
    component: PitantMultiAxisBlock,
  },
  {
    id: 'export',
    title: 'Export',
    maturity: 'preview path',
    useWhen: 'a user needs PNG screenshots for reports, tickets, or support bundles',
    doNotUseWhen: 'the workflow requires evidence-grade SVG or signed export packs',
    component: PitantExportBlock,
  },
  {
    id: 'dashboard-overview',
    title: 'Dashboard Overview',
    maturity: 'composition path',
    useWhen: 'one tenant/site/workflow needs a dense trend and state overview',
    doNotUseWhen: 'the view mixes scopes that require separate authorization or evidence context',
    component: PitantDashboardOverviewBlock,
  },
]
const DEFAULT_EXAMPLE = EXAMPLES[0] as ExampleDefinition

export function App(): JSX.Element {
  const [selectedId, setSelectedId] = useState<ExampleId>('time-series')
  const selected = useMemo(
    () => EXAMPLES.find((example) => example.id === selectedId) ?? DEFAULT_EXAMPLE,
    [selectedId],
  )
  const SelectedExample = selected.component

  return (
    <main className="docs-shell">
      <aside className="docs-nav" aria-label="Chart examples">
        <div>
          <p className="eyebrow">PITANT Charts</p>
          <h1>SciChart replacement docs</h1>
          <p className="nav-copy">
            Live registry blocks backed by typed arrays, renderer fallback, and the same public APIs
            used by PITANT applications.
          </p>
        </div>
        <nav className="example-list">
          {EXAMPLES.map((example) => (
            <button
              aria-current={example.id === selected.id ? 'page' : undefined}
              key={example.id}
              onClick={() => setSelectedId(example.id)}
              type="button"
            >
              <span>{example.title}</span>
              <small>{example.maturity}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="docs-content" aria-label={`${selected.title} live example`}>
        <header className="example-header">
          <div>
            <p className="eyebrow">{selected.maturity}</p>
            <h2>{selected.title}</h2>
          </div>
          <div className="quick-command">
            <span>Install block</span>
            <code>shadcn add pitant-{selected.id}</code>
          </div>
        </header>

        <dl className="usage-grid">
          <div>
            <dt>Use When</dt>
            <dd>{selected.useWhen}</dd>
          </div>
          <div>
            <dt>Do Not Use When</dt>
            <dd>{selected.doNotUseWhen}</dd>
          </div>
        </dl>

        <div className="example-live">
          <SelectedExample />
        </div>

        <section className="quick-start-panel" aria-label="Quick start">
          <h3>First Run</h3>
          <ol>
            <li>
              Build the industrial packages from the repository and install the{' '}
              <code>@pitant/charts</code> and <code>@pitant/charts-react</code> archives together.
              See the{' '}
              <a href="https://github.com/PITANT-Industries/pitant-charts/blob/main/docs/quick-start.md">
                industrial quick start
              </a>
              .
            </li>
            <li>
              Import <code>@pitant/charts/styles/tokens.css</code> once in the app shell.
            </li>
            <li>
              Feed <code>Float64Array</code> timestamps and column arrays. Do not convert historian
              rows on every render frame.
            </li>
            <li>
              Use <code>renderer="auto"</code> unless a diagnostic needs a forced backend.
            </li>
          </ol>
        </section>
      </section>
    </main>
  )
}
