import { Button } from '@ui-sdk/react/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs'
import { ArrowUpRight, Code2, Grid2X2 } from 'lucide-react'
import { ChartPreview } from '../charts/ChartPreview'
import type { ChartExample, ChartFamily } from '../types'
import { CodeBlock, ExampleCode, guideUrl, repositoryUrl } from './ExampleCode'
import { parityNotes } from './ParityOverview'
import cartesianDocs from './docs/cartesian.json'
import specializedDocs from './docs/specialized.json'

type FamilyNotes = {
  summary: string
  useWhen: string
  data: string
  reading: string
  notes: string[]
}

const documentation: Record<string, FamilyNotes> = { ...cartesianDocs, ...specializedDocs }
const sourceBuild = `git clone https://github.com/PITANT-Industries/pitant-charts.git
cd pitant-charts
bun install --frozen-lockfile
bun run --filter @pitant/chart-catalog build:library
cd apps/chart-catalog
npm pack --ignore-scripts`
const properties = [
  { name: 'example', type: 'ChartExample', description: 'Required. Select a registered chart with getExample(id).' },
  { name: 'data', type: 'ChartData', description: 'Optional categories, numeric series, and family-specific rows. Omit it to use the example data. Check caller-data coverage for the variant you select.' },
  { name: 'compact', type: 'boolean', description: 'Uses the compact presentation shown in gallery cards.' },
]
const extraProperties: Record<string, (typeof properties)[number]> = {
  'live-line': { name: 'liveStream', type: 'LiveLineStream', description: 'Supplies chronological batches of timestamped samples and an unsubscribe function.' },
  pie: { name: 'renderCenter', type: '(context: ChartCenterContext) => ReactNode', description: 'Supplies custom center content for donut variants using the current value, total, and share.' },
  ring: { name: 'renderCenter', type: '(context: ChartCenterContext) => ReactNode', description: 'Supplies custom center content from the current ring values and progress target when available.' },
  tooltip: { name: 'renderTooltip', type: '(context: ChartTooltipContext) => ReactNode', description: 'Supplies custom tooltip content using the active category, pin state, and series values.' },
}
const sections = [
  { id: 'docs-preview', name: 'Preview' },
  { id: 'docs-usage', name: 'Installation' },
  { id: 'docs-data', name: 'Data and usage' },
  { id: 'docs-props', name: 'Props' },
  { id: 'docs-examples', name: 'Examples' },
]

export function ExampleNotes({ example }: { example: ChartExample }) {
  const notes = parityNotes[example.id]
  return (
    <div className="variant-notes">
      <p>{example.description}</p>
      {notes && <dl>
        <dt>Checked behavior</dt>
        <dd>{notes.checked}</dd>
        <dt>Known differences</dt>
        <dd>{notes.remaining}</dd>
      </dl>}
    </div>
  )
}

export function FamilyDocumentation({ family, onOpenExample }: {
  family: ChartFamily
  onOpenExample: (example: string, tab: 'preview' | 'code' | 'notes') => void
}) {
  const doc = documentation[family.id]
  const featured = family.examples[0]
  const extra = extraProperties[family.id]
  if (!doc || !featured) return null

  return (
    <div className="family-docs-layout">
      <nav className="docs-jump" aria-label="On this page">
        <p>On this page</p>
        {sections.map(({ id, name }) => <button type="button" key={id} onClick={() => {
          const section = document.getElementById(id)
          section?.querySelector('h2')?.focus({ preventScroll: true })
          section?.scrollIntoView({ block: 'start' })
        }}>{name}</button>)}
      </nav>
      <article className="family-docs" aria-labelledby="family-docs-title">
        <header className="docs-header">
          <h1 id="family-docs-title" tabIndex={-1}>{family.name}</h1>
          <p>{doc.summary}</p>
          <a href={`${repositoryUrl}/tree/main/apps/chart-catalog`}>Catalog source <ArrowUpRight size={15} aria-hidden="true" /></a>
        </header>

        <section id="docs-preview" aria-labelledby="docs-preview-title">
          <h2 id="docs-preview-title" tabIndex={-1}>Preview</h2>
          <Tabs defaultValue="preview" activation="manual" className="docs-preview">
            <TabsList className="segmented" aria-label="Documentation example view">
              <TabsTab value="preview"><Grid2X2 size={15} aria-hidden="true" /> Preview</TabsTab>
              <TabsTab value="code"><Code2 size={15} aria-hidden="true" /> Code</TabsTab>
            </TabsList>
            <TabsPanel value="preview">
              <div className="docs-example-plot"><ChartPreview example={featured} /></div>
            </TabsPanel>
            <TabsPanel value="code"><ExampleCode example={featured} /></TabsPanel>
          </Tabs>
        </section>

        <section id="docs-usage" aria-labelledby="docs-usage-title">
          <h2 id="docs-usage-title" tabIndex={-1}>Installation</h2>
          <p>Build the catalog from source and pack it into a local tarball. The package requires React and React DOM 19.2 or a later 19.x version.</p>
          <CodeBlock language="Shell" source={sourceBuild} />
          <p>In your app’s directory, install the tarball using the path to the file named by <code>npm pack</code>.</p>
          <CodeBlock language="Shell" source={'npm install "/path/to/pitant-chart-catalog-VERSION.tgz"'} />
          <p>See the <a href={guideUrl}>integration guide</a> for importing the stylesheet and using a sized chart container.</p>
        </section>

        <section id="docs-data" aria-labelledby="docs-data-title">
          <h2 id="docs-data-title" tabIndex={-1}>Data and usage</h2>
          <dl className="docs-data">
            <dt>When to use it</dt><dd>{doc.useWhen}</dd>
            <dt>Input data</dt><dd>{doc.data}</dd>
            <dt>Reading the chart</dt><dd>{doc.reading}</dd>
          </dl>
          <ul>{doc.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <p><a href={`${repositoryUrl}/blob/main/apps/chart-catalog/CALLER_DATA.md`}>Caller-data support by variant</a></p>
        </section>

        <section id="docs-props" aria-labelledby="docs-props-title">
          <h2 id="docs-props-title" tabIndex={-1}>Props</h2>
          <div className="docs-props">
            <table>
              <thead><tr><th scope="col">Prop</th><th scope="col">Type</th><th scope="col">Usage</th></tr></thead>
              <tbody>{[...properties, ...(extra ? [extra] : [])].map(({ name, type, description }) => <tr key={name}>
                <th scope="row"><code>{name}</code></th><td><code>{type}</code></td><td>{description}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section id="docs-examples" aria-labelledby="docs-examples-title">
          <h2 id="docs-examples-title" tabIndex={-1}>Examples</h2>
          <ul className="docs-variants">
            {family.examples.map((example) => (
              <li key={example.id}>
                <div><h3>{example.title}</h3><p>{example.label}</p></div>
                <div className="docs-variant-actions">
                  <Button className="text-button" onClick={() => onOpenExample(example.id, 'preview')} aria-label={`Preview ${example.title}`}>Preview</Button>
                  <Button className="text-button" onClick={() => onOpenExample(example.id, 'code')} aria-label={`View code for ${example.title}`}>Code</Button>
                  <Button className="text-button" onClick={() => onOpenExample(example.id, 'notes')} aria-label={`Notes for ${example.title}`}>Notes</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  )
}
